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

  const photo = saveUpload_(data.photo, CONFIG.PHOTO_UPLOAD_FOLDER_ID, data.dni, UPLOAD_FIELD_KIND.PHOTO);
  const reduction = saveUpload_(
    data.solicitudReduccio,
    CONFIG.REDUCTION_UPLOAD_FOLDER_ID,
    data.dni,
    UPLOAD_FIELD_KIND.REDUCTION
  );
  const cognoms = buildCognoms_(data.cognom1, data.cognom2);
  const suggestedEmail = buildSuggestedEmail_(data.nom, data.cognom1);
  const sheet = getResponsesSheet_();
  appendResponse_(sheet, {
    'Timestamp': new Date(),
    'Status': FORM_STATUS.SUBMITTED,
    'Photo File ID': photo.id,
    'Photo URL': photo.url,
    'Nom': clean_(data.nom),
    'Cognom 1': clean_(data.cognom1),
    'Cognom 2': clean_(data.cognom2),
    'DNI': clean_(data.dni),
    'Data naixement': clean_(data.dataNaixement),
    'Telèfon de contacte': clean_(data.telefon),
    'Compte @xtec': clean_(data.compteXtec),
    'Compte de correu alternatiu': clean_(data.correuAlternatiu),
    'Especialitat': clean_(data.especialitat),
    'Departament': clean_(data.departament),
    'Nomenament': clean_(data.nomenament),
    'Previsió reducció jornada': clean_(data.previsioReduccio),
    'Motiu reducció': clean_(data.motiuReduccio),
    'Reducció File ID': reduction.id,
    'Reducció File URL': reduction.url,
    'Jornada': clean_(data.jornada),
    'Anys a ensenyament': clean_(data.anysEnsenyament),
    "Anys a l'institut Ernest Lluch i Martín": clean_(data.anysInstitut),
    'Aficions': clean_(data.aficions),
    'Suggested Google Email': suggestedEmail,
    'Selected Google Email': '',
    'Google User ID': '',
    'Google User Action': '',
    'Google User Status': '',
    'Google User Updated At': '',
    'Error': ''
  });
  sendAdminNotification_(data, suggestedEmail, cognoms);

  return {
    ok: true,
    message: 'La fitxa s\'ha enviat correctament.',
    redirectUrl: CONFIG.AFTER_SUBMIT_REDIRECT_URL
  };
}

function validateSubmission_(data) {
  return FORM_REQUIRED_FIELDS
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

  return MIME_EXTENSION_MAP[mimeType] || '';
}

function getResponsesSheet_() {
  return SpreadsheetApp
    .openById(CONFIG.FORM_RESPONSES_SPREADSHEET_ID)
    .getSheetByName(CONFIG.FORM_RESPONSES_SHEET_NAME);
}

function sendAdminNotification_(data, suggestedEmail, cognoms) {
  const recipients = getAdminNotificationRecipients_();
  if (!recipients.length) return;

  const template = HtmlService.createTemplateFromFile(ADMIN_NOTIFICATION_CONFIG.TEMPLATE_FILE);
  template.submission = {
    nom: clean_(data.nom),
    cognoms: cognoms,
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
    subject: `${ADMIN_NOTIFICATION_CONFIG.SUBJECT_PREFIX}: ${clean_(data.nom)} ${cognoms}`.trim(),
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
    const emailIndex = headers.indexOf(ADMIN_NOTIFICATION_CONFIG.EMAIL_COLUMN);
    if (emailIndex === -1) return;

    values.slice(1).forEach((row) => {
      const value = row[emailIndex];
      const text = clean_(value).toLowerCase();
      if (emailPattern.test(text)) recipients.add(text);
    });
  });

  return Array.from(recipients);
}

function appendResponse_(sheet, object) {
  const headers = ensureHeaders_(sheet, RESPONSE_HEADERS);
  const row = headers.map((header) => Object.prototype.hasOwnProperty.call(object, header) ? object[header] : '');
  sheet.appendRow(row);
}

function ensureHeaders_(sheet, headers) {
  if (!sheet) {
    throw new Error(`No s'ha trobat la pestanya ${CONFIG.FORM_RESPONSES_SHEET_NAME}.`);
  }

  const lastColumn = Math.max(sheet.getLastColumn(), headers.length, 1);
  const range = sheet.getRange(1, 1, 1, lastColumn);
  const current = range.getValues()[0].map(clean_);
  const isBlank = current.every((value) => value === '');
  if (isBlank) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return headers;
  }

  const missing = headers.filter((header) => current.indexOf(header) === -1);
  if (missing.length) {
    sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }

  return current.concat(missing);
}

function buildSuggestedEmail_(nom, cognom1) {
  const localPart = `${normalizeForEmail_(nom)}${normalizeForEmail_(cognom1)}`;
  return localPart ? `${localPart}@${CONFIG.WORKSPACE_DOMAIN}` : '';
}

function buildCognoms_(cognom1, cognom2) {
  return [clean_(cognom1), clean_(cognom2)].filter(Boolean).join(' ');
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
