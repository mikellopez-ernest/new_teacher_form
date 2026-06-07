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
  DEFAULT_GENERAL_GROUP_IDS: ['CLA', 'ESO', 'BAT', 'CIC'],
  GENERAL_GROUP_SCOPES: [
    'attendances',
    'attitude',
    'messages',
    'newsletter',
    'wall',
    'view_students',
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
