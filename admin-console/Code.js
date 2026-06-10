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

const DATABASE_HEADERS = [
  'ESP',
  'DEPT.',
  'NOM',
  'COGNOM1',
  'COGNOM2',
  'BAIXA?',
  'CÀRREC',
  'CAP DEPT',
  'COORD',
  'TUTORIA',
  'EQUIP',
  'FANTASMA',
  'SITUACIÓ',
  'DNI',
  'TELF',
  'CORREU XTEC',
  'CORREU INSTIT',
  'NOUS',
  'ACTIVE',
  'Nom sencer'
];

function doGet() {
  try {
    requireAdmin_();
    return HtmlService.createTemplateFromFile('Admin')
      .evaluate()
      .setTitle('Gestió professorat')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    const template = HtmlService.createTemplateFromFile('Unauthorized');
    template.message = error.message || String(error);
    return template.evaluate().setTitle('Accés no autoritzat');
  }
}

function getAdminRows() {
  requireAdmin_();

  const responseSheet = getResponsesSheet_();
  const responseData = readSheetObjects_(responseSheet);
  const databaseIndex = buildDatabaseIndex_();

  return responseData.rows.map((row) => {
    const dniNormalized = row.object['DNI Normalized'] || normalizeDni_(row.object.DNI);
    const dbMatch = dniNormalized ? databaseIndex.byDni[dniNormalized] : null;
    const lookupEmail = dbMatch
      ? clean_(dbMatch.object['CORREU INSTIT'])
      : clean_(row.object['Suggested Google Email']) || buildSuggestedEmail_(row.object.Nom, row.object.Cognoms);
    const googleUser = lookupEmail ? findGoogleUser_(lookupEmail) : null;
    const selectedEmail = clean_(row.object['Selected Google Email']) || lookupEmail;
    const action = resolveAction_(dniNormalized, dbMatch, googleUser);

    return {
      rowNumber: row.rowNumber,
      dni: clean_(row.object.DNI),
      dniNormalized,
      nom: clean_(row.object.Nom),
      cognoms: clean_(row.object.Cognoms),
      departament: clean_(row.object.Departament),
      nomenament: clean_(row.object.Nomenament),
      jornada: clean_(row.object.Jornada),
      compteXtec: clean_(row.object['Compte @xtec']),
      correuAlternatiu: clean_(row.object['Compte de correu alternatiu']),
      status: clean_(row.object.Status),
      error: clean_(row.object.Error),
      googleUserStatus: clean_(row.object['Google User Status']),
      googleUserUpdatedAt: stringifyDate_(row.object['Google User Updated At']),
      suggestedEmail: buildSuggestedEmail_(row.object.Nom, row.object.Cognoms),
      suggestedDinantiaId: buildSuggestedDinantiaId_(row.object.Cognoms, row.object.Departament),
      defaultDinantiaGeneralGroupIds: DINANTIA_CONFIG.DEFAULT_GENERAL_GROUP_IDS,
      lookupEmail,
      selectedEmail,
      databaseFound: Boolean(dbMatch),
      googleUserExists: Boolean(googleUser),
      action,
      actionLabel: actionLabel_(action),
      canRunAction: action === 'create' || action === 'update',
      photoUrl: clean_(row.object['Photo URL']),
      reductionUrl: clean_(row.object['Reducció File URL'])
    };
  }).reverse();
}

function checkEmailAvailability(email, rowNumber) {
  requireAdmin_();

  const normalizedEmail = normalizeEmail_(email);
  if (!normalizedEmail) {
    return { ok: false, available: false, message: 'Cal indicar un correu institucional.' };
  }

  if (!normalizedEmail.endsWith(`@${CONFIG.WORKSPACE_DOMAIN}`)) {
    return {
      ok: false,
      available: false,
      message: `El correu ha de pertànyer al domini @${CONFIG.WORKSPACE_DOMAIN}.`
    };
  }

  const user = findGoogleUser_(normalizedEmail);
  if (!user) {
    return { ok: true, available: true, email: normalizedEmail, message: 'El correu està disponible.' };
  }

  const row = getResponseRowObject_(rowNumber);
  const rowDni = normalizeDni_(row.object.DNI);
  const databaseMatch = buildDatabaseIndex_().byDni[rowDni];
  const databaseEmail = databaseMatch ? normalizeEmail_(databaseMatch.object['CORREU INSTIT']) : '';
  const sameKnownUser = databaseEmail && databaseEmail === normalizedEmail;

  return {
    ok: true,
    available: sameKnownUser,
    exists: true,
    email: normalizedEmail,
    message: sameKnownUser
      ? 'Aquest correu ja existeix i coincideix amb la fitxa de la base de dades.'
      : 'Aquest correu ja existeix. Escriu-ne un altre abans de crear l\'usuari.'
  };
}

function getDinantiaGroups() {
  requireAdmin_();
  return dinantiaListGroups_();
}

function createOrUpdateGoogleUser(rowNumber, selectedEmail, dinantiaOptions) {
  requireAdmin_();

  const row = getResponseRowObject_(rowNumber);
  const form = row.object;
  const options = dinantiaOptions || {};
  const statuses = createSyncStatuses_();
  const dniNormalized = normalizeDni_(form.DNI);
  if (!dniNormalized) {
    return markResponseError_(rowNumber, 'No es pot sincronitzar una fila sense DNI.', statuses);
  }

  const databaseIndex = buildDatabaseIndex_();
  const databaseMatch = databaseIndex.byDni[dniNormalized] || null;
  const authoritativeEmail = databaseMatch ? clean_(databaseMatch.object['CORREU INSTIT']) : '';
  const requestedEmail = normalizeEmail_(selectedEmail || authoritativeEmail || form['Suggested Google Email']);

  if (!requestedEmail) {
    return markResponseError_(rowNumber, 'Cal indicar un correu institucional.', statuses);
  }

  if (!requestedEmail.endsWith(`@${CONFIG.WORKSPACE_DOMAIN}`)) {
    return markResponseError_(rowNumber, `El correu ha de pertànyer al domini @${CONFIG.WORKSPACE_DOMAIN}.`, statuses);
  }

  const existingRequestedUser = findGoogleUser_(requestedEmail);
  const existingKnownUser = authoritativeEmail ? findGoogleUser_(authoritativeEmail) : null;
  const shouldUpdate = Boolean(databaseMatch && existingKnownUser);

  if (!shouldUpdate && existingRequestedUser) {
    return markResponseError_(rowNumber, 'Aquest correu ja existeix. Escriu-ne un altre abans de crear l\'usuari.', statuses);
  }

  let result;
  const action = shouldUpdate ? 'Updated' : 'Created';

  try {
    result = shouldUpdate
      ? updateGoogleUser_(existingKnownUser.primaryEmail, form, requestedEmail)
      : createGoogleUser_(form, requestedEmail);
    statuses.google = { ok: true, message: `Google user ${action === 'Created' ? 'created' : 'updated'} correctly.` };
  } catch (error) {
    statuses.google = { ok: false, message: `Google user not created correctly. ${error.message || String(error)}` };
    return markResponseError_(rowNumber, formatSyncStatuses_(statuses), statuses);
  }

  try {
    renamePhotoToDni_(form);
    syncDatabase_(databaseMatch, form, requestedEmail);
    statuses.database = { ok: true, message: 'User added to database correctly.' };
  } catch (error) {
    statuses.database = { ok: false, message: `User added to database not correctly. ${error.message || String(error)}` };
    return markResponseError_(rowNumber, formatSyncStatuses_(statuses), statuses);
  }

  let dinantiaResult;
  try {
    dinantiaResult = syncDinantiaStaff_(form, requestedEmail, options, shouldUpdate);
    statuses.dinantia = { ok: true, message: `Dinantia user ${action === 'Created' ? 'created' : 'updated'} correctly.` };
  } catch (error) {
    statuses.dinantia = { ok: false, message: `Dinantia user not created correctly. ${error.message || String(error)}` };
    return markResponseError_(rowNumber, formatSyncStatuses_(statuses), statuses);
  }

  markResponseSuccess_(rowNumber, result.id || result.primaryEmail || requestedEmail, action, requestedEmail);
  if (action === 'Created') {
    sendUserCreatedEmail_(form, requestedEmail);
  }
  getResponsesSheet_().deleteRow(Number(rowNumber));

  return {
    ok: true,
    action,
    email: requestedEmail,
    dinantiaId: dinantiaResult.id,
    statuses,
    message: formatSyncStatuses_(statuses)
  };
}

function deleteFormRow(rowNumber) {
  requireAdmin_();
  getResponsesSheet_().deleteRow(Number(rowNumber));
  return {
    ok: true,
    message: 'Fila eliminada correctament.'
  };
}

function setupDinantiaCredentials(user, secret) {
  requireAdmin_();
  if (!user || !secret) {
    throw new Error('Cal indicar usuari i secret de Dinantia.');
  }

  PropertiesService.getScriptProperties().setProperties({
    DINANTIA_USER: String(user),
    DINANTIA_SECRET: String(secret)
  });

  return 'Credencials de Dinantia configurades.';
}

function syncDinantiaStaff_(form, institutionalEmail, options, shouldUpdate) {
  const dinantiaId = clean_(options.dinantiaId).toUpperCase();
  const generalGroupIds = normalizeGroupIds_(options.generalGroupIds);
  const teacherGroupIds = normalizeGroupIds_(options.teacherGroupIds);
  const tutorGroupId = clean_(options.tutorGroupId);

  if (!dinantiaId) {
    throw new Error('Cal indicar un ID de Dinantia.');
  }

  if (!generalGroupIds.length) {
    throw new Error('Cal seleccionar com a mínim un grup general de Dinantia.');
  }

  const existingById = dinantiaGetAccountById_(dinantiaId);
  if (existingById && !shouldUpdate) {
    throw new Error(`L'ID de Dinantia ${dinantiaId} ja existeix. Escriu-ne un altre.`);
  }

  const existingByEmail = dinantiaFindAccountByEmail_(institutionalEmail);
  if (existingByEmail && existingByEmail.id !== dinantiaId && !shouldUpdate) {
    throw new Error(`El correu ${institutionalEmail} ja existeix a Dinantia amb l'ID ${existingByEmail.id}.`);
  }

  const groups = {};
  DINANTIA_CONFIG.GENERAL_GROUP_SCOPES.forEach((scope) => {
    groups[scope] = generalGroupIds;
  });

  if (teacherGroupIds.length) {
    groups.teacher = teacherGroupIds;
  }

  if (tutorGroupId) {
    groups.tutor = [tutorGroupId];
  }

  const payload = {
    id: dinantiaId,
    name: buildDinantiaName_(form.Nom, form.Cognoms),
    email: institutionalEmail,
    phone: normalizeSpanishPhone_(form['Telèfon de contacte']) || undefined,
    gender: DINANTIA_CONFIG.DEFAULT_GENDER,
    language: DINANTIA_CONFIG.DEFAULT_LANGUAGE,
    roles: ['Staff'],
    groups,
    permissions: DINANTIA_CONFIG.STAFF_PERMISSIONS,
    fields: []
  };

  const response = dinantiaRequest_('post', '/api/web/v1/accounts/update', payload);
  if (!response || !response.data) {
    throw new Error('Dinantia no ha retornat dades de l\'usuari creat.');
  }

  return response.data;
}

function createGoogleUser_(form, email) {
  const recoveryEmail = normalizeRecoveryEmail_(form);
  const payload = {
    primaryEmail: email,
    name: {
      givenName: clean_(form.Nom),
      familyName: clean_(form.Cognoms)
    },
    password: CONFIG.INITIAL_PASSWORD,
    changePasswordAtNextLogin: true,
    orgUnitPath: CONFIG.TEACHER_ORG_UNIT_PATH,
    recoveryEmail: recoveryEmail || undefined
  };
  return AdminDirectory.Users.insert(removeUndefined_(payload));
}

function updateGoogleUser_(currentEmail, form, requestedEmail) {
  const recoveryEmail = normalizeRecoveryEmail_(form);
  const payload = {
    name: {
      givenName: clean_(form.Nom),
      familyName: clean_(form.Cognoms)
    },
    orgUnitPath: CONFIG.TEACHER_ORG_UNIT_PATH,
    recoveryEmail: recoveryEmail || undefined
  };
  const updated = AdminDirectory.Users.update(removeUndefined_(payload), currentEmail);

  if (normalizeEmail_(currentEmail) !== normalizeEmail_(requestedEmail)) {
    return AdminDirectory.Users.update({ primaryEmail: requestedEmail }, currentEmail);
  }

  return updated;
}

function renamePhotoToDni_(form) {
  const fileId = clean_(form['Photo File ID']);
  const dni = normalizeDni_(form.DNI);
  if (!fileId || !dni) return;

  const file = DriveApp.getFileById(fileId);
  const currentName = file.getName();
  const extensionMatch = currentName.match(/\.[A-Za-z0-9]+$/);
  const extension = extensionMatch ? extensionMatch[0].toLowerCase() : '';
  file.setName(`${dni}${extension}`);
}

function sendUserCreatedEmail_(form, institutionalEmail) {
  const recipient = normalizeRecoveryEmail_(form);
  if (!recipient) return;

  const template = HtmlService.createTemplateFromFile('UserCreatedEmail');
  template.account = {
    nom: clean_(form.Nom),
    cognoms: clean_(form.Cognoms),
    username: institutionalEmail,
    password: CONFIG.INITIAL_PASSWORD
  };

  MailApp.sendEmail({
    to: recipient,
    subject: 'Nou compte de Google Workspace',
    htmlBody: template.evaluate().getContent()
  });
}

function syncDatabase_(databaseMatch, form, email) {
  const sheet = getDatabaseSheet_();
  const headerMap = headerMap_(getHeaders_(sheet));
  const values = databaseMatch
    ? sheet.getRange(databaseMatch.rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0]
    : new Array(sheet.getLastColumn()).fill('');
  const surnames = splitSurnames_(form.Cognoms);

  setColumn_(values, headerMap, 'ESP', form.Especialitat);
  setColumn_(values, headerMap, 'DEPT.', form.Departament);
  setColumn_(values, headerMap, 'NOM', form.Nom);
  setColumn_(values, headerMap, 'COGNOM1', surnames.first);
  setColumn_(values, headerMap, 'COGNOM2', surnames.rest);
  setColumn_(values, headerMap, 'DNI', form.DNI);
  setColumn_(values, headerMap, 'TELF', form['Telèfon de contacte']);
  setColumn_(values, headerMap, 'CORREU XTEC', normalizeXtecEmail_(form['Compte @xtec']));
  setColumn_(values, headerMap, 'CORREU INSTIT', email);
  setColumn_(values, headerMap, 'ACTIVE', true);
  setColumn_(values, headerMap, 'Nom sencer', `${clean_(form.Nom)} ${clean_(form.Cognoms)}`.trim());

  if (!databaseMatch) {
    setColumn_(values, headerMap, 'NOUS', 'TRUE');
    setColumn_(values, headerMap, 'SITUACIÓ', defaultValidationValue_(sheet, headerMap, 'SITUACIÓ') || values[headerMap['SITUACIÓ']]);
    appendValidatedDatabaseRow_(sheet, values);
    return;
  }

  sheet.getRange(databaseMatch.rowNumber, 1, 1, values.length).setValues([values]);
}

function appendValidatedDatabaseRow_(sheet, values) {
  const lastRow = sheet.getLastRow();
  if (lastRow >= sheet.getMaxRows()) {
    sheet.insertRowAfter(lastRow);
  }

  const rowNumber = lastRow + 1;
  const columnCount = values.length;

  if (rowNumber > 2) {
    const source = sheet.getRange(rowNumber - 1, 1, 1, columnCount);
    const target = sheet.getRange(rowNumber, 1, 1, columnCount);
    source.copyTo(target);
    target.clearContent();
  }

  sheet.getRange(rowNumber, 1, 1, columnCount).setValues([values]);
}

function defaultValidationValue_(sheet, headerMap, header) {
  const columnIndex = headerMap[header];
  if (columnIndex === undefined) return '';

  const lastRow = Math.max(sheet.getLastRow(), 2);
  const rule = sheet.getRange(lastRow, columnIndex + 1).getDataValidation()
    || sheet.getRange(2, columnIndex + 1).getDataValidation();
  if (!rule) return '';

  const criteria = rule.getCriteriaType();
  const values = rule.getCriteriaValues();

  if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    return values[0] && values[0][0] ? values[0][0] : '';
  }

  if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
    const range = values[0];
    const rangeValues = range.getValues().flat().map(clean_).filter(Boolean);
    return rangeValues[0] || '';
  }

  return '';
}

function markResponseSuccess_(rowNumber, userId, action, selectedEmail) {
  const sheet = getResponsesSheet_();
  const map = headerMap_(getHeaders_(sheet));
  setResponseCell_(sheet, map, rowNumber, 'Status', 'Synced');
  setResponseCell_(sheet, map, rowNumber, 'Selected Google Email', selectedEmail);
  setResponseCell_(sheet, map, rowNumber, 'Google User ID', userId);
  setResponseCell_(sheet, map, rowNumber, 'Google User Action', action);
  setResponseCell_(sheet, map, rowNumber, 'Google User Status', 'Success');
  setResponseCell_(sheet, map, rowNumber, 'Google User Updated At', new Date());
  setResponseCell_(sheet, map, rowNumber, 'Error', '');
}

function markResponseError_(rowNumber, message, statuses) {
  const sheet = getResponsesSheet_();
  const map = headerMap_(getHeaders_(sheet));
  setResponseCell_(sheet, map, rowNumber, 'Status', 'Error');
  setResponseCell_(sheet, map, rowNumber, 'Google User Status', 'Error');
  setResponseCell_(sheet, map, rowNumber, 'Error', message);
  return { ok: false, message, statuses };
}

function createSyncStatuses_() {
  return {
    google: { ok: null, message: 'Google user not created yet.' },
    dinantia: { ok: null, message: 'Dinantia user not created yet.' },
    database: { ok: null, message: 'User not added to database yet.' }
  };
}

function formatSyncStatuses_(statuses) {
  return [
    formatOneSyncStatus_('Google user', statuses.google),
    formatOneSyncStatus_('Dinantia user', statuses.dinantia),
    formatOneSyncStatus_('User added to database', statuses.database)
  ].join('\n');
}

function formatOneSyncStatus_(label, status) {
  if (label === 'User added to database') {
    if (!status || status.ok === null) return `${label}: not correctly. ${status ? status.message : ''}`.trim();
    return `${label}: ${status.ok ? 'correctly' : 'not correctly'}. ${status.message || ''}`.trim();
  }

  if (!status || status.ok === null) return `${label}: not created correctly. ${status ? status.message : ''}`.trim();
  return `${label}: ${status.ok ? 'created correctly' : 'not created correctly'}. ${status.message || ''}`.trim();
}

function setResponseCell_(sheet, map, rowNumber, header, value) {
  const index = map[header];
  if (index === undefined) return;
  sheet.getRange(rowNumber, index + 1).setValue(value);
}

function buildDatabaseIndex_() {
  const sheet = getDatabaseSheet_();
  const data = readSheetObjects_(sheet);
  const byDni = {};
  data.rows.forEach((row) => {
    const normalized = normalizeDni_(row.object.DNI);
    if (normalized) byDni[normalized] = row;
  });
  return { byDni };
}

function dinantiaListGroups_() {
  const groups = [];
  let page = 1;

  while (true) {
    const response = dinantiaRequest_('get', '/api/web/v1/groups/index', null, {
      limit: 100,
      page
    });
    groups.push.apply(groups, response.data || []);

    if (!response.pagination || !response.pagination.has_next_page) break;
    page += 1;
  }

  return groups
    .filter((group) => group && group.id)
    .map((group) => ({
      id: clean_(group.id),
      name: clean_(group.name),
      tag: clean_(group.tag),
      parent: clean_(group.parent),
      types: group.types || []
    }))
    .sort((a, b) => String(a.tag || a.name || a.id).localeCompare(String(b.tag || b.name || b.id), 'ca'));
}

function dinantiaGetAccountById_(id) {
  if (!id) return null;
  try {
    const response = dinantiaRequest_('get', `/api/web/v1/accounts/view/${encodeURIComponent(id)}`);
    return response.data || null;
  } catch (error) {
    if (isDinantiaNotFound_(error)) return null;
    throw error;
  }
}

function dinantiaFindAccountByEmail_(email) {
  if (!email) return null;
  const response = dinantiaRequest_('get', '/api/web/v1/accounts/index', null, {
    email,
    limit: 5
  });
  const matches = response.data || [];
  return matches.length ? matches[0] : null;
}

function dinantiaRequest_(method, path, payload, query) {
  const user = getRequiredScriptProperty_('DINANTIA_USER');
  const secret = getRequiredScriptProperty_('DINANTIA_SECRET');
  const url = buildDinantiaUrl_(path, query);
  const options = {
    method,
    contentType: 'application/vnd.api+json',
    headers: {
      Accept: 'application/vnd.api+json',
      Authorization: `Basic ${Utilities.base64Encode(`${user}:${secret}`)}`
    },
    muteHttpExceptions: true
  };

  if (payload) {
    options.payload = JSON.stringify(removeUndefined_(payload));
  }

  const httpResponse = UrlFetchApp.fetch(url, options);
  const status = httpResponse.getResponseCode();
  const text = httpResponse.getContentText();
  let body;

  try {
    body = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Dinantia ha retornat una resposta no JSON (${status}).`);
  }

  if (status < 200 || status >= 300 || body.success === false || (body.errors && body.errors.length)) {
    const message = formatDinantiaError_(body, status);
    throw new Error(message);
  }

  return body;
}

function buildDinantiaUrl_(path, query) {
  const base = DINANTIA_CONFIG.BASE_URL.replace(/\/$/, '');
  const cleanPath = path.charAt(0) === '/' ? path : `/${path}`;
  const params = [];

  Object.keys(query || {}).forEach((key) => {
    if (query[key] !== null && query[key] !== undefined && query[key] !== '') {
      params.push(`${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`);
    }
  });

  return `${base}${cleanPath}${params.length ? `?${params.join('&')}` : ''}`;
}

function formatDinantiaError_(body, status) {
  if (body && body.errors && body.errors.length) {
    return body.errors
      .map((error) => `${error.field || 'Dinantia'}: ${error.message || error.code || 'error'}`)
      .join('; ');
  }

  if (body && body.message) {
    return `Dinantia (${status}): ${body.message}`;
  }

  return `Dinantia ha retornat un error (${status}).`;
}

function isDinantiaNotFound_(error) {
  const message = String(error && error.message ? error.message : error);
  return message.toLowerCase().includes('dinantia (404)') || message.toLowerCase().includes('not found');
}

function getRequiredScriptProperty_(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) {
    throw new Error(`Falta configurar la propietat de script ${key}.`);
  }
  return value;
}

function resolveAction_(dniNormalized, databaseMatch, googleUser) {
  if (!dniNormalized) return 'missing-dni';
  if (!databaseMatch) return 'create';
  if (!googleUser) return 'create';
  return 'update';
}

function actionLabel_(action) {
  const labels = {
    'missing-dni': 'Missing DNI',
    create: 'Create Google and Dinantia users',
    update: 'Update Google and Dinantia users'
  };
  return labels[action] || '';
}

function getResponseRowObject_(rowNumber) {
  const sheet = getResponsesSheet_();
  const headers = getHeaders_(sheet);
  const values = sheet.getRange(Number(rowNumber), 1, 1, headers.length).getValues()[0];
  return {
    rowNumber: Number(rowNumber),
    object: objectFromRow_(headers, values)
  };
}

function readSheetObjects_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) {
    return { headers: getHeaders_(sheet), rows: [] };
  }

  const headers = getHeaders_(sheet);
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return {
    headers,
    rows: values.map((row, index) => ({
      rowNumber: index + 2,
      object: objectFromRow_(headers, row)
    }))
  };
}

function getHeaders_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(clean_);
}

function objectFromRow_(headers, row) {
  return headers.reduce((object, header, index) => {
    if (header) object[header] = row[index];
    return object;
  }, {});
}

function headerMap_(headers) {
  return headers.reduce((map, header, index) => {
    map[header] = index;
    return map;
  }, {});
}

function setColumn_(values, headerMap, header, value) {
  const index = headerMap[header];
  if (index === undefined) return;
  values[index] = clean_(value);
}

function getResponsesSheet_() {
  const sheet = SpreadsheetApp
    .openById(CONFIG.FORM_RESPONSES_SPREADSHEET_ID)
    .getSheetByName(CONFIG.FORM_RESPONSES_SHEET_NAME);
  if (!sheet) throw new Error(`No s'ha trobat la pestanya ${CONFIG.FORM_RESPONSES_SHEET_NAME}.`);
  return sheet;
}

function getDatabaseSheet_() {
  const sheet = SpreadsheetApp
    .openById(CONFIG.USER_DATABASE_SPREADSHEET_ID)
    .getSheetByName(CONFIG.USER_DATABASE_SHEET_NAME);
  if (!sheet) throw new Error(`No s'ha trobat la pestanya ${CONFIG.USER_DATABASE_SHEET_NAME}.`);
  return sheet;
}

function findGoogleUser_(email) {
  if (!email) return null;
  try {
    return AdminDirectory.Users.get(email);
  } catch (error) {
    if (isNotFound_(error)) return null;
    throw error;
  }
}

function isNotFound_(error) {
  const message = String(error && error.message ? error.message : error);
  return message.includes('Resource Not Found') || message.includes('notFound') || message.includes('Not Found');
}

function requireAdmin_() {
  const context = getAdminContext_();
  if (context.allowed) return context.user;

  throw new Error(context.message);
}

function getAdminContext_() {
  const email = Session.getActiveUser().getEmail();
  if (!email) {
    return {
      allowed: false,
      message: 'No s\'ha pogut identificar l\'usuari actiu. Revisa que el desplegament de l\'admin s\'executi com a usuari que accedeix i que requereixi inici de sessió.'
    };
  }

  let user;
  try {
    user = AdminDirectory.Users.get(email);
  } catch (error) {
    return {
      allowed: false,
      email,
      message: `No s'ha pogut llegir l'usuari ${email} amb Admin Directory: ${error.message || String(error)}`
    };
  }

  const allowedByOrgUnit = user && user.orgUnitPath === CONFIG.ADMIN_ORG_UNIT_PATH;
  const allowedByAdminRole = Boolean(user && (user.isAdmin || user.isDelegatedAdmin));

  if (allowedByOrgUnit || allowedByAdminRole) {
    return {
      allowed: true,
      email,
      user,
      orgUnitPath: user.orgUnitPath,
      isAdmin: Boolean(user.isAdmin),
      isDelegatedAdmin: Boolean(user.isDelegatedAdmin)
    };
  }

  return {
    allowed: false,
    email,
    orgUnitPath: user && user.orgUnitPath,
    isAdmin: Boolean(user && user.isAdmin),
    isDelegatedAdmin: Boolean(user && user.isDelegatedAdmin),
    message: `No tens permisos per accedir a aquesta eina. Usuari detectat: ${email}. OU: ${user && user.orgUnitPath ? user.orgUnitPath : 'desconeguda'}. Admin: ${Boolean(user && user.isAdmin)}. Admin delegat: ${Boolean(user && user.isDelegatedAdmin)}.`
  };
}

function buildSuggestedEmail_(nom, cognoms) {
  const firstSurname = String(cognoms || '').trim().split(/\s+/)[0] || '';
  const localPart = `${normalizeForEmail_(nom)}${normalizeForEmail_(firstSurname)}`;
  return localPart ? `${localPart}@${CONFIG.WORKSPACE_DOMAIN}` : '';
}

function buildSuggestedDinantiaId_(cognoms, departament) {
  const firstSurname = splitSurnames_(cognoms).first;
  const prefix = normalizeForEmail_(firstSurname).slice(0, 2).toUpperCase();
  const departmentCode = DINANTIA_CONFIG.DEPARTMENT_CODES[clean_(departament)] || 'PRO';
  return `${prefix}${departmentCode}`;
}

function buildDinantiaName_(nom, cognoms) {
  return `${clean_(cognoms)}, ${clean_(nom)}`.replace(/^,\s*/, '').trim();
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

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeGroupIds_(groupIds) {
  const seen = {};
  return (groupIds || [])
    .map(clean_)
    .filter(Boolean)
    .filter((id) => {
      if (seen[id]) return false;
      seen[id] = true;
      return true;
    });
}

function normalizeSpanishPhone_(value) {
  const raw = clean_(value);
  if (!raw) return '';

  if (/^\+\d{8,15}$/.test(raw.replace(/\s/g, ''))) {
    return raw.replace(/\s/g, '');
  }

  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9) return `+34${digits}`;
  if (digits.length > 9 && digits.startsWith('34')) return `+${digits}`;
  return '';
}

function normalizeRecoveryEmail_(form) {
  const xtec = normalizeXtecEmail_(form['Compte @xtec']);
  if (xtec) return xtec;
  return normalizePlainEmail_(form['Compte de correu alternatiu']);
}

function normalizeXtecEmail_(value) {
  const raw = clean_(value).toLowerCase();
  if (!raw) return '';

  return normalizePlainEmail_(raw.includes('@') ? raw : `${raw}@xtec.cat`);
}

function normalizePlainEmail_(value) {
  const email = clean_(value).toLowerCase();
  if (!email) return '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`El correu de recuperació no és vàlid: ${email}`);
  }

  return email;
}

function normalizeDni_(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function splitSurnames_(cognoms) {
  const parts = String(cognoms || '').trim().split(/\s+/).filter(Boolean);
  return {
    first: parts[0] || '',
    rest: parts.slice(1).join(' ')
  };
}

function stringifyDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  }
  return String(value);
}

function removeUndefined_(object) {
  Object.keys(object).forEach((key) => {
    if (object[key] === undefined) delete object[key];
    if (object[key] && typeof object[key] === 'object' && !Array.isArray(object[key])) {
      removeUndefined_(object[key]);
    }
  });
  return object;
}

function clean_(value) {
  return String(value || '').trim();
}
