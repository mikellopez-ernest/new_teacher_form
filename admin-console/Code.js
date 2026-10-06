function doGet() {
  const access = getAccessDecision_();
  if (!access.allowed) {
    const template = HtmlService.createTemplateFromFile('Unauthorized');
    template.message = access.message;
    template.email = access.email || '';
    return template.evaluate().setTitle('Accés no autoritzat');
  }

  const template = HtmlService.createTemplateFromFile('Admin');
  template.clientConfig = JSON.stringify({
    submittedStatus: FORM_RESPONSE_STATUS.SUBMITTED
  });
  return template.evaluate()
    .setTitle('Gestió professorat')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getAdminRows() {
  requireAdmin_();

  const responseSheet = getResponsesSheet_();
  const responseData = readSheetObjects_(responseSheet);
  const databaseIndex = buildDatabaseIndex_();

  return responseData.rows.map((row) => {
    const cognom1 = getCognom1_(row.object);
    const cognom2 = getCognom2_(row.object);
    const cognoms = buildCognoms_(cognom1, cognom2);
    const dniNormalized = row.object['DNI Normalized'] || normalizeDni_(row.object.DNI);
    const dbMatch = dniNormalized ? databaseIndex.byDni[dniNormalized] : null;
    const lookupEmail = dbMatch
      ? getDatabaseEmail_(dbMatch.object)
      : clean_(row.object['Suggested Google Email']) || buildSuggestedEmail_(row.object.Nom, cognom1);
    const googleUser = lookupEmail ? findGoogleUser_(lookupEmail) : null;
    const selectedEmail = clean_(row.object['Selected Google Email']) || lookupEmail;
    const action = resolveAction_(dniNormalized, dbMatch, googleUser);
    const suggestedTeacherAlias = buildTeacherCode_(cognom1, row.object.Departament);

    return {
      rowNumber: row.rowNumber,
      dni: clean_(row.object.DNI),
      dniNormalized,
      nom: clean_(row.object.Nom),
      cognom1,
      cognom2,
      cognoms,
      departament: clean_(row.object.Departament),
      nomenament: clean_(row.object.Nomenament),
      jornada: clean_(row.object.Jornada),
      compteXtec: clean_(row.object['Compte @xtec']),
      correuAlternatiu: clean_(row.object['Compte de correu alternatiu']),
      status: clean_(row.object.Status),
      error: clean_(row.object.Error),
      googleUserStatus: clean_(row.object['Google User Status']),
      googleUserUpdatedAt: stringifyDate_(row.object['Google User Updated At']),
      suggestedEmail: buildSuggestedEmail_(row.object.Nom, cognom1),
      suggestedTeacherAlias,
      suggestedDinantiaId: suggestedTeacherAlias,
      defaultDinantiaGeneralGroupIds: DINANTIA_CONFIG.DEFAULT_GENERAL_GROUP_IDS,
      lookupEmail,
      selectedEmail,
      databaseFound: Boolean(dbMatch),
      databaseWarning: dbMatch ? 'Aquest DNI ja existeix a la base de dades. Revisa la fila abans de continuar.' : '',
      googleUserExists: Boolean(googleUser),
      action,
      actionLabel: actionLabel_(action),
      canRunAction: action === 'create',
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
  const databaseEmail = databaseMatch ? normalizeEmail_(getDatabaseEmail_(databaseMatch.object)) : '';
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

function checkAliasAvailability(alias) {
  requireAdmin_();

  const normalizedAlias = normalizeAlias_(alias);
  if (!normalizedAlias) {
    return { ok: false, available: false, message: 'Cal indicar un àlies.' };
  }

  const databaseMatch = buildDatabaseIndex_().byAlias[normalizedAlias] || null;
  const dinantiaMatch = dinantiaGetAccountById_(normalizedAlias);
  const messages = [];

  if (databaseMatch) messages.push('ja existeix a la base de dades');
  if (dinantiaMatch) messages.push('ja existeix a Dinantia');

  return {
    ok: true,
    available: !messages.length,
    alias: normalizedAlias,
    existsInDatabase: Boolean(databaseMatch),
    existsInDinantia: Boolean(dinantiaMatch),
    message: messages.length
      ? `L'àlies ${normalizedAlias} ${messages.join(' i ')}. Escriu-ne un altre.`
      : `L'àlies ${normalizedAlias} està disponible.`
  };
}

function createOrUpdateGoogleUser(rowNumber, selectedEmail, dinantiaOptions) {
  requireAdmin_();

  const row = getResponseRowObject_(rowNumber);
  const form = row.object;
  const options = dinantiaOptions || {};
  const selectedAlias = normalizeAlias_(options.teacherAlias || options.dinantiaId);
  const statuses = createSyncStatuses_();
  const dniNormalized = normalizeDni_(form.DNI);
  if (!dniNormalized) {
    return markResponseError_(rowNumber, 'No es pot sincronitzar una fila sense DNI.', statuses);
  }

  const databaseIndex = buildDatabaseIndex_();
  const databaseMatch = databaseIndex.byDni[dniNormalized] || null;
  if (databaseMatch) {
    return markResponseError_(rowNumber, 'Aquest DNI ja existeix a la base de dades. No s\'actualitzarà automàticament.', statuses);
  }

  const authoritativeEmail = databaseMatch ? getDatabaseEmail_(databaseMatch.object) : '';
  const requestedEmail = normalizeEmail_(selectedEmail || authoritativeEmail || form['Suggested Google Email']);

  if (!requestedEmail) {
    return markResponseError_(rowNumber, 'Cal indicar un correu institucional.', statuses);
  }

  if (!requestedEmail.endsWith(`@${CONFIG.WORKSPACE_DOMAIN}`)) {
    return markResponseError_(rowNumber, `El correu ha de pertànyer al domini @${CONFIG.WORKSPACE_DOMAIN}.`, statuses);
  }

  const existingRequestedUser = findGoogleUser_(requestedEmail);
  const shouldUpdate = false;

  if (!shouldUpdate && existingRequestedUser) {
    return markResponseError_(rowNumber, 'Aquest correu ja existeix. Escriu-ne un altre abans de crear l\'usuari.', statuses);
  }

  if (!selectedAlias) {
    return markResponseError_(rowNumber, 'Cal indicar un àlies Untis / ID Dinantia.', statuses);
  }

  const aliasAvailability = checkAliasAvailability_(selectedAlias);
  if (!aliasAvailability.available) {
    return markResponseError_(rowNumber, aliasAvailability.message, statuses);
  }

  let result;
  const action = ACCOUNT_CONFIG.CREATED_ACTION;

  try {
    syncDatabase_(databaseMatch, form, requestedEmail, selectedAlias);
    statuses.database = { ok: true, message: 'User added to database correctly.' };
  } catch (error) {
    statuses.database = { ok: false, message: `User added to database not correctly. ${error.message || String(error)}` };
    return markResponseError_(rowNumber, formatSyncStatuses_(statuses), statuses);
  }

  try {
    result = createGoogleUser_(form, requestedEmail);
    addGoogleUserToDefaultGroup_(requestedEmail);
    statuses.google = { ok: true, message: `Google user created correctly and added to ${CONFIG.DEFAULT_GOOGLE_GROUP_EMAIL}.` };
  } catch (error) {
    statuses.google = { ok: false, message: `Google user not created correctly. ${error.message || String(error)}` };
    return markResponseError_(rowNumber, formatSyncStatuses_(statuses), statuses);
  }

  try {
    renamePhotoToDni_(form);
  } catch (error) {
    statuses.google = { ok: false, message: `Google user created, but photo was not renamed correctly. ${error.message || String(error)}` };
    return markResponseError_(rowNumber, formatSyncStatuses_(statuses), statuses);
  }

  let dinantiaResult;
  try {
    dinantiaResult = syncDinantiaStaff_(form, requestedEmail, options, shouldUpdate);
    statuses.dinantia = { ok: true, message: `Dinantia user ${action === ACCOUNT_CONFIG.CREATED_ACTION ? 'created' : 'updated'} correctly.` };
  } catch (error) {
    statuses.dinantia = { ok: false, message: `Dinantia user not created correctly. ${error.message || String(error)}` };
    return markResponseError_(rowNumber, formatSyncStatuses_(statuses), statuses);
  }

  markResponseSuccess_(rowNumber, result.id || result.primaryEmail || requestedEmail, action, requestedEmail);
  if (action === ACCOUNT_CONFIG.CREATED_ACTION) {
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
    [DINANTIA_CONFIG.SCRIPT_PROPERTIES.USER]: String(user),
    [DINANTIA_CONFIG.SCRIPT_PROPERTIES.SECRET]: String(secret)
  });

  return 'Credencials de Dinantia configurades.';
}

function grantRequiredPermissions() {
  PropertiesService.getScriptProperties().getProperty(CONFIG.TABLES_SCRIPT_PROPERTY_NAME);
  PropertiesService.getScriptProperties().getProperty(CONFIG.ACCESS_GRANTED_PROPERTY_NAME);
  Session.getActiveUser().getEmail();
  getWorkloadCarrecsSheet_().getRange(1, 1).getValue();
  getWorkloadProfessorsSheet_().getRange(1, 1).getValue();

  return {
    ok: true,
    message: 'Permisos concedits correctament.'
  };
}

function syncDinantiaStaff_(form, institutionalEmail, options, shouldUpdate) {
  const dinantiaId = normalizeAlias_(options.dinantiaId || options.teacherAlias);
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
    name: buildDinantiaName_(form.Nom, getFullCognoms_(form)),
    email: institutionalEmail,
    phone: normalizeSpanishPhone_(form['Telèfon de contacte']) || undefined,
    gender: DINANTIA_CONFIG.DEFAULT_GENDER,
    language: DINANTIA_CONFIG.DEFAULT_LANGUAGE,
    roles: [ACCOUNT_CONFIG.DINANTIA_STAFF_ROLE],
    groups,
    permissions: DINANTIA_CONFIG.STAFF_PERMISSIONS,
    fields: []
  };

  const response = dinantiaRequest_('post', DINANTIA_CONFIG.API_PATHS.ACCOUNT_UPDATE, payload);
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
      familyName: getFullCognoms_(form)
    },
    password: CONFIG.INITIAL_PASSWORD,
    changePasswordAtNextLogin: ACCOUNT_CONFIG.CHANGE_PASSWORD_AT_NEXT_LOGIN,
    orgUnitPath: CONFIG.TEACHER_ORG_UNIT_PATH,
    recoveryEmail: recoveryEmail || undefined
  };
  return AdminDirectory.Users.insert(removeUndefined_(payload));
}

function addGoogleUserToDefaultGroup_(email) {
  const groupEmail = CONFIG.DEFAULT_GOOGLE_GROUP_EMAIL;
  if (!groupEmail) return;

  try {
    AdminDirectory.Members.insert({
      email,
      role: 'MEMBER'
    }, groupEmail);
  } catch (error) {
    if (isAlreadyMember_(error)) return;
    throw error;
  }
}

function updateGoogleUser_(currentEmail, form, requestedEmail) {
  const recoveryEmail = normalizeRecoveryEmail_(form);
  const payload = {
    name: {
      givenName: clean_(form.Nom),
      familyName: getFullCognoms_(form)
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

  const template = HtmlService.createTemplateFromFile(ACCOUNT_CONFIG.EMAIL_TEMPLATE_FILE);
  template.account = {
    nom: clean_(form.Nom),
    cognoms: getFullCognoms_(form),
    username: institutionalEmail,
    password: CONFIG.INITIAL_PASSWORD
  };

  MailApp.sendEmail({
    to: recipient,
    subject: ACCOUNT_CONFIG.EMAIL_SUBJECT,
    htmlBody: template.evaluate().getContent()
  });
}

function syncDatabase_(databaseMatch, form, email, teacherAlias) {
  if (databaseMatch) {
    throw new Error('Aquest DNI ja existeix a la base de dades. No s\'actualitzarà automàticament.');
  }

  const sheet = getDatabaseSheet_();
  const headerMap = headerMap_(getHeaders_(sheet));
  const values = new Array(sheet.getLastColumn()).fill('');
  const surnames = {
    first: getCognom1_(form),
    rest: getCognom2_(form)
  };
  const departmentCode = mapDepartmentCode_(form.Departament);
  const resolvedTeacherAlias = normalizeAlias_(teacherAlias) || buildTeacherCode_(surnames.first, form.Departament);

  setColumn_(values, headerMap, 'ESP', form.Especialitat);
  setColumn_(values, headerMap, 'DEPT.', departmentCode);
  setColumn_(values, headerMap, 'NOM', form.Nom);
  setColumn_(values, headerMap, 'COGNOM1', surnames.first);
  setColumn_(values, headerMap, 'COGNOM2', surnames.rest);
  setColumnAny_(values, headerMap, DATABASE_HEADER_ALIASES.REDUIT, resolvedTeacherAlias);
  setColumnAny_(values, headerMap, DATABASE_HEADER_ALIASES.SITUACIO, mapSituacio_(form.Nomenament));
  setColumn_(values, headerMap, 'JORNADA', mapJornada_(form.Jornada));
  setColumn_(values, headerMap, 'DNI', form.DNI);
  setColumn_(values, headerMap, 'TELF', form['Telèfon de contacte']);
  setColumnAny_(values, headerMap, DATABASE_HEADER_ALIASES.XTEC, normalizeXtecEmail_(form['Compte @xtec']));
  setColumnAny_(values, headerMap, DATABASE_HEADER_ALIASES.CORREU, email);
  setColumn_(values, headerMap, 'NOUS', DATABASE_DEFAULTS.NOUS);
  setColumnAny_(values, headerMap, DATABASE_HEADER_ALIASES.ACTIU, DATABASE_DEFAULTS.ACTIU);
  setColumn_(values, headerMap, 'BAIXA?', DATABASE_DEFAULTS.BAIXA);
  setColumn_(values, headerMap, 'SUBST?', isSubstituteNomenament_(form.Nomenament));

  appendValidatedDatabaseRow_(sheet, values);
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
  setResponseCell_(sheet, map, rowNumber, 'Status', FORM_RESPONSE_STATUS.SYNCED);
  setResponseCell_(sheet, map, rowNumber, 'Selected Google Email', selectedEmail);
  setResponseCell_(sheet, map, rowNumber, 'Google User ID', userId);
  setResponseCell_(sheet, map, rowNumber, 'Google User Action', action);
  setResponseCell_(sheet, map, rowNumber, 'Google User Status', FORM_RESPONSE_STATUS.GOOGLE_SUCCESS);
  setResponseCell_(sheet, map, rowNumber, 'Google User Updated At', new Date());
  setResponseCell_(sheet, map, rowNumber, 'Error', '');
}

function markResponseError_(rowNumber, message, statuses) {
  const sheet = getResponsesSheet_();
  const map = headerMap_(getHeaders_(sheet));
  setResponseCell_(sheet, map, rowNumber, 'Status', FORM_RESPONSE_STATUS.ERROR);
  setResponseCell_(sheet, map, rowNumber, 'Google User Status', FORM_RESPONSE_STATUS.ERROR);
  setResponseCell_(sheet, map, rowNumber, 'Error', message);
  return { ok: false, message, statuses };
}

function createSyncStatuses_() {
  return {
    google: { ok: null, message: SYNC_STATUS_CONFIG.INITIAL.google },
    dinantia: { ok: null, message: SYNC_STATUS_CONFIG.INITIAL.dinantia },
    database: { ok: null, message: SYNC_STATUS_CONFIG.INITIAL.database }
  };
}

function formatSyncStatuses_(statuses) {
  return [
    formatOneSyncStatus_(SYNC_STATUS_CONFIG.GOOGLE_LABEL, statuses.google),
    formatOneSyncStatus_(SYNC_STATUS_CONFIG.DINANTIA_LABEL, statuses.dinantia),
    formatOneSyncStatus_(SYNC_STATUS_CONFIG.DATABASE_LABEL, statuses.database)
  ].join('\n');
}

function formatOneSyncStatus_(label, status) {
  if (label === SYNC_STATUS_CONFIG.DATABASE_LABEL) {
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
  const byAlias = {};
  data.rows.forEach((row) => {
    const normalized = normalizeDni_(row.object.DNI);
    if (normalized) byDni[normalized] = row;
    const alias = normalizeAlias_(row.object['REDUIT'] || row.object['REDUÏT']);
    if (alias) byAlias[alias] = row;
  });
  return { byDni, byAlias };
}

function checkAliasAvailability_(alias) {
  const normalizedAlias = normalizeAlias_(alias);
  if (!normalizedAlias) {
    return { available: false, message: 'Cal indicar un àlies.' };
  }

  const databaseMatch = buildDatabaseIndex_().byAlias[normalizedAlias] || null;
  const dinantiaMatch = dinantiaGetAccountById_(normalizedAlias);
  const messages = [];

  if (databaseMatch) messages.push('ja existeix a la base de dades');
  if (dinantiaMatch) messages.push('ja existeix a Dinantia');

  return {
    available: !messages.length,
    alias: normalizedAlias,
    message: messages.length
      ? `L'àlies ${normalizedAlias} ${messages.join(' i ')}. Escriu-ne un altre.`
      : `L'àlies ${normalizedAlias} està disponible.`
  };
}

function dinantiaListGroups_() {
  const groups = [];
  let page = 1;

  while (true) {
    const response = dinantiaRequest_('get', DINANTIA_CONFIG.API_PATHS.GROUPS_INDEX, null, {
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
    const response = dinantiaRequest_('get', `${DINANTIA_CONFIG.API_PATHS.ACCOUNT_VIEW}/${encodeURIComponent(id)}`);
    return response.data || null;
  } catch (error) {
    if (isDinantiaNotFound_(error)) return null;
    throw error;
  }
}

function dinantiaFindAccountByEmail_(email) {
  if (!email) return null;
  const response = dinantiaRequest_('get', DINANTIA_CONFIG.API_PATHS.ACCOUNTS_INDEX, null, {
    email,
    limit: 5
  });
  const matches = response.data || [];
  return matches.length ? matches[0] : null;
}

function dinantiaRequest_(method, path, payload, query) {
  const user = getRequiredScriptProperty_(DINANTIA_CONFIG.SCRIPT_PROPERTIES.USER);
  const secret = getRequiredScriptProperty_(DINANTIA_CONFIG.SCRIPT_PROPERTIES.SECRET);
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
  if (databaseMatch) return 'existing-dni';
  if (!databaseMatch) return 'create';
  if (!googleUser) return 'create';
  return 'update';
}

function actionLabel_(action) {
  return ADMIN_ACTION_LABELS[action] || '';
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
  if (typeof value === 'boolean') {
    values[index] = value;
    return;
  }
  values[index] = clean_(value);
}

function setColumnAny_(values, headerMap, headers, value) {
  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index];
    if (headerMap[header] !== undefined) {
      setColumn_(values, headerMap, header, value);
      return;
    }
  }
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
    .openById(resolveDatabaseSpreadsheetId_())
    .getSheetByName(CONFIG.USER_DATABASE_SHEET_NAME);
  if (!sheet) throw new Error(`No s'ha trobat la pestanya ${CONFIG.USER_DATABASE_SHEET_NAME}.`);
  return sheet;
}

function getWorkloadSpreadsheet_() {
  return getRegisteredSpreadsheet_(CONFIG.WORKLOAD_REGISTRY_NAME);
}

function getWorkloadProfessorsSheet_() {
  const sheet = getWorkloadSpreadsheet_().getSheetByName(CONFIG.WORKLOAD_PROFESSORS_SHEET_NAME);
  if (!sheet) {
    throw new Error(`No s'ha trobat el full "${CONFIG.WORKLOAD_PROFESSORS_SHEET_NAME}" a ${CONFIG.WORKLOAD_REGISTRY_NAME}.`);
  }
  return sheet;
}

function getWorkloadCarrecsSheet_() {
  const sheet = getWorkloadSpreadsheet_().getSheetByName(CONFIG.WORKLOAD_CARRECS_SHEET_NAME);
  if (!sheet) {
    throw new Error(`No s'ha trobat el full "${CONFIG.WORKLOAD_CARRECS_SHEET_NAME}" a ${CONFIG.WORKLOAD_REGISTRY_NAME}.`);
  }
  return sheet;
}

function resolveDatabaseSpreadsheetId_() {
  return resolveRegisteredSpreadsheetId_(CONFIG.USER_DATABASE_TABLE_NAME);
}

function getRegisteredSpreadsheet_(registryName) {
  return SpreadsheetApp.openById(resolveRegisteredSpreadsheetId_(registryName));
}

function resolveRegisteredSpreadsheetId_(registryName) {
  const registrySpreadsheetId = getRequiredScriptProperty_(CONFIG.TABLES_SCRIPT_PROPERTY_NAME);
  const registrySheet = SpreadsheetApp
    .openById(registrySpreadsheetId)
    .getSheetByName(CONFIG.TABLES_REGISTRY_SHEET_NAME);

  if (!registrySheet) {
    throw new Error(`No s'ha trobat la pestanya ${CONFIG.TABLES_REGISTRY_SHEET_NAME} al registre de taules.`);
  }

  const values = registrySheet.getDataRange().getValues();
  for (let index = 0; index < values.length; index += 1) {
    const tableName = clean_(values[index][0]);
    if (tableName === registryName) {
      const spreadsheetId = clean_(values[index][1]);
      if (!spreadsheetId) {
        throw new Error(`La taula ${registryName} no té cap ID configurat.`);
      }
      return spreadsheetId;
    }
  }

  throw new Error(`No s'ha trobat la taula ${registryName} al registre.`);
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

function isAlreadyMember_(error) {
  const message = String(error && error.message ? error.message : error).toLowerCase();
  return message.includes('member already exists') || message.includes('duplicate') || message.includes('already exists');
}

function requireAdmin_() {
  const context = getAccessDecision_();
  if (context.allowed) return context;

  throw new Error(context.message);
}

function getAccessDecision_() {
  try {
    const userEmail = normalizeEmail_(Session.getActiveUser().getEmail());
    if (!userEmail) {
      return {
        allowed: false,
        email: '',
        message: 'No s\'ha pogut identificar el correu de l\'usuari actiu.'
      };
    }

    const accessEntries = getAccessGrantedEntries_();
    if (!accessEntries.length) {
      return {
        allowed: false,
        email: userEmail,
        message: `Falta configurar la propietat de script "${CONFIG.ACCESS_GRANTED_PROPERTY_NAME}".`
      };
    }

    const directEmails = accessEntries
      .map(normalizeEmail_)
      .filter((entry) => entry.indexOf('@') !== -1);
    const roles = accessEntries.filter((entry) => normalizeEmail_(entry).indexOf('@') === -1);
    const people = [];

    if (roles.length) {
      const peopleByRole = getPeopleByAccessRole_();
      roles.forEach((role) => {
        const assignedPeople = peopleByRole.get(normalizeText_(role)) || [];
        assignedPeople.forEach((person) => people.push(person));
      });
    }

    const authorizedEmails = roles.length ? getEmailsForPeople_(people) : new Set();
    directEmails.forEach((email) => authorizedEmails.add(email));

    const allowed = authorizedEmails.has(userEmail);
    return {
      allowed,
      email: userEmail,
      accessEntries,
      roles,
      directEmails,
      people,
      message: allowed
        ? 'Accés autoritzat.'
        : 'No tens permisos per accedir a aquesta aplicació.'
    };
  } catch (error) {
    return {
      allowed: false,
      email: normalizeEmail_(Session.getActiveUser().getEmail()),
      message: error && error.message ? error.message : String(error)
    };
  }
}

function getAccessGrantedEntries_() {
  return splitCommaList_(
    PropertiesService.getScriptProperties().getProperty(CONFIG.ACCESS_GRANTED_PROPERTY_NAME)
  );
}

function getPeopleByAccessRole_() {
  const sheet = getWorkloadCarrecsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return new Map();

  const values = sheet.getRange(2, 1, lastRow - 1, CARRECS_COLUMNS.ASIGNADO).getValues();
  const peopleByRole = new Map();

  values.forEach((row) => {
    const roleName = clean_(row[CARRECS_COLUMNS.CARREC - 1]);
    if (!roleName) return;

    peopleByRole.set(
      normalizeText_(roleName),
      splitCommaList_(row[CARRECS_COLUMNS.ASIGNADO - 1])
    );
  });

  return peopleByRole;
}

function getEmailsForPeople_(people) {
  const sheet = getWorkloadProfessorsSheet_();
  const lastRow = sheet.getLastRow();
  const emails = new Set();
  if (lastRow < 2 || !people.length) return emails;

  const peopleSet = new Set(people.map((person) => normalizeText_(person)));
  const values = sheet.getRange(2, 1, lastRow - 1, WORKLOAD_PROFESSORS_COLUMNS.TEACHER_KEY).getValues();

  values.forEach((row) => {
    const teacherKey = normalizeText_(row[WORKLOAD_PROFESSORS_COLUMNS.TEACHER_KEY - 1]);
    if (!peopleSet.has(teacherKey)) return;

    const email = normalizeEmail_(row[WORKLOAD_PROFESSORS_COLUMNS.CORREU_INSTIT - 1]);
    if (email) emails.add(email);
  });

  people.forEach((person) => {
    const directEmail = normalizeEmail_(person);
    if (directEmail.indexOf('@') !== -1) emails.add(directEmail);
  });

  return emails;
}

function buildSuggestedEmail_(nom, cognoms) {
  const localPart = `${normalizeForEmail_(nom)}${normalizeForEmail_(cognoms)}`;
  return localPart ? `${localPart}@${CONFIG.WORKSPACE_DOMAIN}` : '';
}

function buildSuggestedDinantiaId_(cognoms, departament) {
  return buildTeacherCode_(cognoms, departament);
}

function buildTeacherCode_(cognoms, departament) {
  const firstSurname = splitSurnames_(cognoms).first;
  const prefix = normalizeForEmail_(firstSurname).slice(0, 2).toUpperCase();
  const departmentCode = mapDepartmentCode_(departament) || 'PRO';
  return `${prefix}${departmentCode}`;
}

function mapDepartmentCode_(departament) {
  const value = clean_(departament);
  if (!value) return '';
  return DINANTIA_CONFIG.DEPARTMENT_CODES[value] || value;
}

function mapSituacio_(nomenament) {
  const cleanNomenament = clean_(nomenament);
  if (cleanNomenament === 'Interinatge') return 'INT';
  return NOMENAMENT_SITUACIO_MAP[cleanNomenament] || cleanNomenament;
}

function mapJornada_(jornada) {
  const normalized = normalizeForComparison_(jornada);
  if (normalized === 'MITJA') return 'MITJA';
  if (normalized.includes('TERC') || normalized.includes('REDUCCIO')) return 'REDUCCIÓ UN TERÇ';
  return 'SENCERA';
}

function isSubstituteNomenament_(nomenament) {
  return clean_(nomenament) === 'Substitució';
}

function buildDinantiaName_(nom, cognoms) {
  return `${clean_(cognoms)}, ${clean_(nom)}`.replace(/^,\s*/, '').trim();
}

function getCognom1_(object) {
  return clean_(object['Cognom 1']) || splitSurnames_(object.Cognoms).first;
}

function getCognom2_(object) {
  return clean_(object['Cognom 2']) || splitSurnames_(object.Cognoms).rest;
}

function getFullCognoms_(object) {
  return buildCognoms_(getCognom1_(object), getCognom2_(object));
}

function buildCognoms_(cognom1, cognom2) {
  return [clean_(cognom1), clean_(cognom2)].filter(Boolean).join(' ');
}

function getDatabaseEmail_(object) {
  return clean_(object['CORREU']) || clean_(object['CORREU INSTIT']);
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

function normalizeForComparison_(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function normalizeText_(value) {
  return clean_(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('ca');
}

function normalizeAlias_(value) {
  return clean_(value).toUpperCase();
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function splitCommaList_(value) {
  return clean_(value)
    .split(',')
    .map(clean_)
    .filter(Boolean);
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
