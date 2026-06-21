const CONFIG = {
  FORM_RESPONSES_SPREADSHEET_ID: '1fnjQyGzoMw2m1NuZmL_TiS52cEmwyTkifS3tb_KGaMM',
  FORM_RESPONSES_SHEET_NAME: 'Form responses',
  PHOTO_UPLOAD_FOLDER_ID: '1hhNV1wCbkVZYl7hqx78fqakhdr1-cgVz',
  REDUCTION_UPLOAD_FOLDER_ID: '1JyphuC21DWvdahvKy8HEn6fQp-CNDjul',
  ADMIN_NOTIFICATION_SPREADSHEET_ID: '1eW91L6sWLs6cKg3AXi0spGc1vv6sYQ4jwiMvM-gK__E',
  WORKSPACE_DOMAIN: 'iernestlluch.cat',
  AFTER_SUBMIT_REDIRECT_URL: 'https://agora.xtec.cat/sesernestlluch-cunit/',
  ADMIN_CONSOLE_URL: ''
};

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

const FORM_REQUIRED_FIELDS = [
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

const FORM_STATUS = {
  SUBMITTED: 'Submitted'
};

const UPLOAD_FIELD_KIND = {
  PHOTO: 'foto',
  REDUCTION: 'reduccio'
};

const MIME_EXTENSION_MAP = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
};

const ADMIN_NOTIFICATION_CONFIG = {
  EMAIL_COLUMN: 'email',
  TEMPLATE_FILE: 'AdminNotificationEmail',
  SUBJECT_PREFIX: 'Nova fitxa de professorat'
};
