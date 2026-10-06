const CONFIG = {
  FORM_RESPONSES_SPREADSHEET_ID: '1fnjQyGzoMw2m1NuZmL_TiS52cEmwyTkifS3tb_KGaMM',
  FORM_RESPONSES_SHEET_NAME: 'Form responses',
  TABLES_SCRIPT_PROPERTY_NAME: 'Tables',
  ACCESS_GRANTED_PROPERTY_NAME: 'access_granted',
  TABLES_REGISTRY_SHEET_NAME: 'tables',
  USER_DATABASE_TABLE_NAME: 'Dades de professors',
  USER_DATABASE_SHEET_NAME: 'Llista',
  WORKLOAD_REGISTRY_NAME: 'Càrrega lectiva',
  WORKLOAD_PROFESSORS_SHEET_NAME: 'professors',
  WORKLOAD_CARRECS_SHEET_NAME: 'carrecs',
  WORKSPACE_DOMAIN: 'iernestlluch.cat',
  TEACHER_ORG_UNIT_PATH: '/Personal educatiu',
  DEFAULT_GOOGLE_GROUP_EMAIL: 'claustre@iernestlluch.cat',
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
    'Llengües estrangeres': 'ANG',
    'Llengua castellana': 'CAS',
    'Llengua catalana': 'CAT',
    'Comerç': 'COM',
    'Diversitat': 'DIV',
    'Educació física': 'EFI',
    'Ciències experimentals': 'EXP',
    'Informàtica': 'INF',
    'Matemàtiques': 'MAT',
    'Orientació': 'ORI',
    'Perruqueria': 'PCC',
    'Socials': 'SOC',
    'Tecnologia': 'TEC',
    'Expressió artística': 'VIP',
    'Català': 'CAT',
    'Castellà': 'CAS',
    'Ciències': 'EXP',
    'Educació Física': 'EFI',
    'Diversitat / orientació': 'DIV',
    'Expressió': 'VIP'
  }
};

const RESPONSE_HEADERS = [
  'Timestamp',
  'Status',
  'Photo File ID',
  'Photo URL',
  'Nom',
  'Cognom 1',
  'Cognom 2',
  'DNI',
  'Data naixement',
  'Telèfon de contacte',
  'Compte @xtec',
  'Compte de correu alternatiu',
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
  'REDUIT',
  'SITUACIO',
  'JORNADA',
  'DNI',
  'TELF',
  'XTEC',
  'CORREU',
  'NOUS',
  'ACTIU',
  'BAIXA?',
  'SUBST?'
];

const DATABASE_HEADER_ALIASES = {
  REDUIT: ['REDUIT', 'REDUÏT'],
  SITUACIO: ['SITUACIO', 'SITUACIÓ'],
  XTEC: ['XTEC', 'CORREU XTEC'],
  CORREU: ['CORREU', 'CORREU INSTIT'],
  ACTIU: ['ACTIU', 'ACTIVE']
};

const WORKLOAD_PROFESSORS_COLUMNS = {
  CORREU_INSTIT: 12,
  TEACHER_KEY: 17
};

const CARRECS_COLUMNS = {
  CARREC: 1,
  ASIGNADO: 4
};

const ACCOUNT_CONFIG = {
  DINANTIA_STAFF_ROLE: 'Staff',
  CHANGE_PASSWORD_AT_NEXT_LOGIN: true,
  CREATED_ACTION: 'Created',
  UPDATED_ACTION: 'Updated',
  EMAIL_TEMPLATE_FILE: 'UserCreatedEmail',
  EMAIL_SUBJECT: 'Nou compte de Google Workspace'
};

const ADMIN_ACTION_LABELS = {
  'missing-dni': 'Falta DNI',
  'existing-dni': 'DNI ja existeix a la base de dades',
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
  ACTIU: true,
  BAIXA: false,
  NOUS: true,
  SUBST: false
};

const NOMENAMENT_SITUACIO_MAP = {
  'Comissió de serveis': 'CS',
  'Funcionari amb plaça definitiva': 'FUNC. DEF',
  'Funcionari amb plaça provisional': 'FUNC. SNS PLAÇA',
  'Funcionari amb plaça perfilada': 'FUNC. PERFIL',
  'Interinatge amb plaça perfilada': 'INT. PERF',
  'Substitució': 'INT',
  'Laboral': 'LABORAL'
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
