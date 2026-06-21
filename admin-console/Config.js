const CONFIG = {
  FORM_RESPONSES_SPREADSHEET_ID: '1fnjQyGzoMw2m1NuZmL_TiS52cEmwyTkifS3tb_KGaMM',
  FORM_RESPONSES_SHEET_NAME: 'Form responses',
  USER_DATABASE_SPREADSHEET_ID: '1InUG9G_vyZfLsgzDENqk5rO0rygEzV2ttS4I8ZoxA1A',
  USER_DATABASE_SHEET_NAME: 'Llista',
  WORKSPACE_DOMAIN: 'iernestlluch.cat',
  TEACHER_ORG_UNIT_PATH: '/Personal educatiu',
  ADMIN_ORG_UNIT_PATH: '/Administradors',
  INITIAL_PASSWORD: 'ERNEST_LLUCH'
};

const DINANTIA_CONFIG = {
  BASE_URL: 'https://app.dinantia.com',
  API_PATHS: {
    ACCOUNT_UPDATE: '/api/web/v1/accounts/update',
    ACCOUNT_VIEW: '/api/web/v1/accounts/view',
    ACCOUNTS_INDEX: '/api/web/v1/accounts/index',
    GROUPS_INDEX: '/api/web/v1/groups/index'
  },
  SCRIPT_PROPERTIES: {
    USER: 'DINANTIA_USER',
    SECRET: 'DINANTIA_SECRET'
  },
  DEFAULT_GENERAL_GROUP_IDS: ['CLA', 'ESO', 'BAT', 'CIC'],
  GENERAL_GROUP_SCOPES: [
    'attendances',
    'attitude',
    'messages',
    'newsletter',
    'wall',
    'view_students',
    'managed',
    'calendar',
    'member'
  ],
  STAFF_PERMISSIONS: ['attendances', 'attitude', 'messages', 'newsletter', 'wall'],
  DEFAULT_LANGUAGE: 'ca_ES',
  DEFAULT_GENDER: 'other',
  DEPARTMENT_CODES: {
    'Matemàtiques': 'MAT',
    'Català': 'CAT',
    'Castellà': 'CAS',
    'Llengües estrangeres': 'ANG',
    'Socials': 'CIE',
    'Ciències': 'CIE0',
    'Educació Física': 'EDU',
    'Diversitat / orientació': 'PSI',
    'Expressió': 'EXP',
    'Informàtica': 'INF',
    'Perruqueria': 'IMA'
  }
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

const ACCOUNT_CONFIG = {
  DINANTIA_STAFF_ROLE: 'Staff',
  CHANGE_PASSWORD_AT_NEXT_LOGIN: true,
  CREATED_ACTION: 'Created',
  UPDATED_ACTION: 'Updated',
  EMAIL_TEMPLATE_FILE: 'UserCreatedEmail',
  EMAIL_SUBJECT: 'Nou compte de Google Workspace'
};

const ADMIN_ACTION_LABELS = {
  'missing-dni': 'Missing DNI',
  create: 'Create Google and Dinantia users',
  update: 'Update Google and Dinantia users'
};

const FORM_RESPONSE_STATUS = {
  SUBMITTED: 'Submitted',
  SYNCED: 'Synced',
  ERROR: 'Error',
  GOOGLE_SUCCESS: 'Success'
};

const DATABASE_DEFAULTS = {
  ACTIVE: true,
  NOUS: 'TRUE'
};

const SYNC_STATUS_CONFIG = {
  GOOGLE_LABEL: 'Google user',
  DINANTIA_LABEL: 'Dinantia user',
  DATABASE_LABEL: 'User added to database',
  INITIAL: {
    google: 'Google user not created yet.',
    dinantia: 'Dinantia user not created yet.',
    database: 'User not added to database yet.'
  }
};
