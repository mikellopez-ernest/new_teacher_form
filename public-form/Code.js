const RESPONSE_HEADERS = [
  'Timestamp',
  'Status',
  'Photo File ID',
  'Photo URL',
  'Nom',
  'Cognoms',
  'DNI',
  'Data naixement',
  'Telèfon de contacte',
  'Compte @xtec',
  'Compte de correu alternatiu',
  'Adreça',
  'Població',
  'Especialitat',
  'Departament',
  'Nomenament',
  'Previsió reducció jornada',
  'Motiu reducció',
  'Reducció File ID',
  'Reducció File URL',
  'Jornada',
  'Anys a ensenyament',
  "Anys a l'institut Ernest Lluch i Martín",
  'Aficions',
  'Suggested Google Email',
  'Selected Google Email',
  'Google User ID',
  'Google User Action',
  'Google User Status',
  'Google User Updated At',
  'Error'
];

function doGet() {
  return HtmlService.createTemplateFromFile('Form')
    .evaluate()
    .setTitle('Fitxa de professorat')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitTeacherForm(payload) {
  const data = payload || {};
  const errors = validateSubmission_(data);

  if (errors.length) {
    throw new Error(errors.join('\n'));
  }

  const photo = saveUpload_(data.photo, CONFIG.PHOTO_UPLOAD_FOLDER_ID, data.dni, 'foto');
  const reduction = saveUpload_(
    data.solicitudReduccio,
    CONFIG.REDUCTION_UPLOAD_FOLDER_ID,
    data.dni,
    'reduccio'
  );
  const suggestedEmail = buildSuggestedEmail_(data.nom, data.cognoms);
  const sheet = getResponsesSheet_();
  ensureHeaders_(sheet, RESPONSE_HEADERS);
  sheet.appendRow([
    new Date(),
    'Submitted',
    photo.id,
    photo.url,
    clean_(data.nom),
    clean_(data.cognoms),
    clean_(data.dni),
    clean_(data.dataNaixement),
    clean_(data.telefon),
    clean_(data.compteXtec),
    clean_(data.correuAlternatiu),
    clean_(data.adreca),
    clean_(data.poblacio),
    clean_(data.especialitat),
    clean_(data.departament),
    clean_(data.nomenament),
    clean_(data.previsioReduccio),
    clean_(data.motiuReduccio),
    reduction.id,
    reduction.url,
    clean_(data.jornada),
    clean_(data.anysEnsenyament),
    clean_(data.anysInstitut),
    clean_(data.aficions),
    suggestedEmail,
    '',
    '',
    '',
    '',
    '',
    ''
  ]);
  sendAdminNotification_(data, suggestedEmail);

  return {
    ok: true,
    message: 'La fitxa s\'ha enviat correctament.',
    redirectUrl: CONFIG.AFTER_SUBMIT_REDIRECT_URL
  };
}

function validateSubmission_(data) {
  const required = [
    ['photo', 'Fotografia'],
    ['nom', 'Nom'],
    ['cognoms', 'Cognoms'],
    ['dni', 'DNI'],
    ['telefon', 'Telèfon de contacte'],
    ['especialitat', 'Especialitat'],
    ['nomenament', 'Nomenament'],
    ['previsioReduccio', 'Previsió de reducció de jornada'],
    ['jornada', 'Jornada']
  ];

  return required
    .filter(([key]) => !hasValue_(data[key]))
    .map(([, label]) => `${label} és obligatori.`);
}

function hasValue_(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'object') return Boolean(value.dataUrl);
  return true;
}

function saveUpload_(upload, folderId, dni, kind) {
  if (!upload || !upload.dataUrl) {
    return { id: '', url: '' };
  }

  const match = String(upload.dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error(`El fitxer ${kind} no té un format vàlid.`);
  }

  const mimeType = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const extension = extensionFromMime_(mimeType, upload.name);
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const safeDni = normalizeDni_(dni) || 'sense-dni';
  const fileName = `${safeDni}-${kind}-${timestamp}${extension}`;
  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const file = DriveApp.getFolderById(folderId).createFile(blob);

  return {
    id: file.getId(),
    url: file.getUrl()
  };
}

function extensionFromMime_(mimeType, originalName) {
  const original = String(originalName || '');
  const originalMatch = original.match(/\.[A-Za-z0-9]+$/);
  if (originalMatch) return originalMatch[0].toLowerCase();

  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf'
  };
  return map[mimeType] || '';
}

function getResponsesSheet_() {
  return SpreadsheetApp
    .openById(CONFIG.FORM_RESPONSES_SPREADSHEET_ID)
    .getSheetByName(CONFIG.FORM_RESPONSES_SHEET_NAME);
}

function sendAdminNotification_(data, suggestedEmail) {
  const recipients = getAdminNotificationRecipients_();
  if (!recipients.length) return;

  const template = HtmlService.createTemplateFromFile('AdminNotificationEmail');
  template.submission = {
    nom: clean_(data.nom),
    cognoms: clean_(data.cognoms),
    dni: clean_(data.dni),
    departament: clean_(data.departament),
    nomenament: clean_(data.nomenament),
    jornada: clean_(data.jornada),
    suggestedEmail
  };
  template.adminUrl = CONFIG.ADMIN_CONSOLE_URL || '';
  const htmlBody = template.evaluate().getContent();

  MailApp.sendEmail({
    to: recipients.join(','),
    subject: `Nova fitxa de professorat: ${clean_(data.nom)} ${clean_(data.cognoms)}`.trim(),
    htmlBody
  });
}

function getAdminNotificationRecipients_() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.ADMIN_NOTIFICATION_SPREADSHEET_ID);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const recipients = new Set();

  spreadsheet.getSheets().forEach((sheet) => {
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return;

    const headers = values[0].map((value) => clean_(value).toLowerCase());
    const emailIndex = headers.indexOf('email');
    if (emailIndex === -1) return;

    values.slice(1).forEach((row) => {
      const value = row[emailIndex];
      const text = clean_(value).toLowerCase();
      if (emailPattern.test(text)) recipients.add(text);
    });
  });

  return Array.from(recipients);
}

function ensureHeaders_(sheet, headers) {
  if (!sheet) {
    throw new Error(`No s'ha trobat la pestanya ${CONFIG.FORM_RESPONSES_SHEET_NAME}.`);
  }

  const range = sheet.getRange(1, 1, 1, headers.length);
  const current = range.getValues()[0];
  const isBlank = current.every((value) => value === '');
  if (isBlank) {
    range.setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function buildSuggestedEmail_(nom, cognoms) {
  const firstSurname = String(cognoms || '').trim().split(/\s+/)[0] || '';
  const localPart = `${normalizeForEmail_(nom)}${normalizeForEmail_(firstSurname)}`;
  return localPart ? `${localPart}@${CONFIG.WORKSPACE_DOMAIN}` : '';
}

function normalizeForEmail_(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'n')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeDni_(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function clean_(value) {
  return String(value || '').trim();
}
