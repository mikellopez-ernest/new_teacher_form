# Dinantia Integration Specification

## Goal

Add Dinantia account synchronization to the teacher onboarding workflow.

The current project already collects teacher data, creates/updates Google Workspace users, updates the teacher database, sends notification emails, and removes processed form rows. Dinantia must be integrated as an additional external system from the admin console.

When the admin creates a Google Workspace user, the system must also create the corresponding Dinantia staff account in the same workflow.

This spec is based on the local PDF:

```text
/Users/mikellopez/Downloads/Dinantia API.pdf
```

## API Basics

Dinantia exposes a REST API under the school's Dinantia domain:

```text
https://yourdomain.dinantia.com/api/web/...
```

Required headers:

```http
Accept: application/vnd.api+json
Content-Type: application/vnd.api+json
```

Authentication is Basic Authentication.

Credentials are configured in Dinantia web app:

```text
General Settings -> User
General Settings -> Secret
```

Apps Script should store non-secret API settings in `admin-console/Config.js`:

```js
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
  DEFAULT_GENDER: 'other'
};
```

Store Dinantia credentials in Apps Script Properties, not in tracked source files or spreadsheets.

Required script properties:

```text
DINANTIA_USER
DINANTIA_SECRET
```

The API user has been provided by the school and should be stored as `DINANTIA_USER`. The API secret has also been provided and must be stored as `DINANTIA_SECRET`.

The real base URL is:

```text
https://app.dinantia.com
```

## Relevant Dinantia Endpoints

### Create Or Update Account

Use this endpoint for teacher/staff synchronization:

```http
POST /api/web/v1/accounts/update
```

Full URL:

```text
https://app.dinantia.com/api/web/v1/accounts/update
```

The endpoint updates an account if it exists, or creates one when a new ID is supplied in the JSON payload. This is the endpoint currently used by the admin script.

Relevant request fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String` | Unique identifier for the account. Required on creation. |
| `name` | `String` | Required on creation for `Staff`. |
| `email` | `String` | Unique email. Required on creation for `Staff`. |
| `phone` | `String` | E.164 format if used. |
| `gender` | `String` | `female`, `male`, or `other`. |
| `roles` | `String[]` | Must include `Staff` for teachers. Required on creation. |
| `groups` | `Object` | Group membership by scope. Updating a scope replaces existing groups for that scope. |
| `permissions` | `String[]` | Module permissions. |
| `fields` | `Field[]` | Custom fields configured in Dinantia. |

Allowed account roles include:

```text
Administrator
Staff
Student
Parent
Candidate
CandidateParent
```

Valid group scopes include:

```text
member
tutor
teacher
managed
view_students
attendances
attitude
calendar
messages
newsletter
nursery
payments
wall
```

Allowed permission/module names include:

```text
attendances
attitude
calendar
crm
messages
newsletter
nursery
payments
wall
```

### Get Account

Use this endpoint when checking a known Dinantia account ID:

```http
GET /api/web/v1.2/accounts/view/:id
```

### Get Accounts

Use this endpoint when checking whether an institutional email already exists in Dinantia:

```http
GET /api/web/v1.2/accounts/index?email=<email>
```

Parameters:

| Field | Type | Notes |
| --- | --- | --- |
| `email` | `String` | Optional filter by email. |
| `limit` | `Number` | Defaults to 20, max 100. |
| `page` | `Number` | Defaults to first page. |

### Delete Account

Available but not part of v1 onboarding:

```http
DELETE /api/web/v1/accounts/delete/:id
```

Do not call this from the current admin console unless a later requirement explicitly asks for Dinantia deletion.

### Get Groups

Use this endpoint to discover valid group IDs:

```http
GET /api/web/v1/groups/index
```

Parameters:

| Field | Type | Notes |
| --- | --- | --- |
| `parent` | `String` | Optional parent group ID filter. |
| `limit` | `Number` | Defaults to 20, max 100. |
| `page` | `Number` | Defaults to first page. |

Group objects include:

| Field | Type |
| --- | --- |
| `id` | `String` |
| `name` | `String` |
| `tag` | `String` |
| `parent` | `String` |
| `types` | `String[]` |
| `created` | `String` |

### Get Fields

Use this endpoint to discover API-ready custom fields:

```http
GET /api/web/v1.2/fields/index?roles[]=Staff
```

Parameters:

| Field | Type | Notes |
| --- | --- | --- |
| `roles` | `String[]` | Filter by `Student`, `Candidate`, `CandidateParent`, or `Staff`. |
| `limit` | `Number` | Defaults to 20, max 100. |
| `page` | `Number` | Defaults to first page. |

Custom field objects include:

| Field | Type |
| --- | --- |
| `id` | `String` |
| `name` | `String` |
| `roles` | `String[]` |
| `scope` | `String|null` |
| `data_type` | `String` |
| `multiple` | `Boolean` |
| `has_options` | `Boolean` |
| `options` | `String[]` |
| `allow_custom` | `Boolean` |

## Proposed Onboarding Flow

V1 should integrate Dinantia from the admin console, not from the public form.

Recommended sequence when admin clicks create/update:

```text
1. Validate admin authorization.
2. Read form row.
3. Create/update Google Workspace user.
4. Rename photo file to DNI.
5. Sync local teacher database spreadsheet.
6. Fetch current Dinantia groups from the API and let the admin choose:
   - multiple general groups
   - one optional tutor group
7. Create/update Dinantia Staff account using the institutional `iernestlluch.cat` email and selected group configuration.
8. Send user email with Google account credentials.
9. Delete form response row.
```

The form row should only be deleted after Google Workspace and Dinantia synchronization both succeed, unless we later decide Dinantia failures should be non-blocking.

## Admin Notification Email

The public form must include a link to the admin console in the notification email body, when `ADMIN_CONSOLE_URL` is configured in `public-form/Config.js`.

## Dinantia Account Identity

Use the existing short-code style as the Dinantia account `id`.

Observed example:

```text
Aznar Mendieta, Lídia
Department: Català
Dinantia id: AZCAT
```

Suggested generation rule:

```text
first 2 letters of first surname + department code
```

Example:

```text
Aznar + Català -> AZCAT
```

The admin table should show:

- Suggested Dinantia ID.
- Tooltip explaining how it was generated.
- Editable textbox prefilled with the suggestion.

Before creating the Dinantia user, check whether the selected Dinantia ID already exists:

```http
GET /api/web/v1/accounts/view/:id
```

If it exists, warn the admin and require a different ID unless the flow is intentionally updating that same Dinantia account.

## Dinantia Staff Payload

For a teacher, create/update an account with role `Staff`.

Suggested payload:

```json
{
  "id": "12345678Z",
  "name": "Lopez Villarroya, Mikel",
  "email": "mikellopez@iernestlluch.cat",
  "phone": "+34600111222",
  "gender": "other",
  "roles": ["Staff"],
  "language": "ca_ES",
  "groups": {
    "attendances": ["CLA", "ESO", "BAT", "CIC"],
    "attitude": ["CLA", "ESO", "BAT", "CIC"],
    "messages": ["CLA", "ESO", "BAT", "CIC"],
    "newsletter": ["CLA", "ESO", "BAT", "CIC"],
    "wall": ["CLA", "ESO", "BAT", "CIC"],
    "view_students": ["CLA", "ESO", "BAT", "CIC"],
    "member": ["CLA", "ESO", "BAT", "CIC"]
  },
  "permissions": ["attendances", "attitude", "messages", "newsletter", "wall"],
  "fields": []
}
```

Field mapping:

| Dinantia field | Source |
| --- | --- |
| `id` | Admin-selected Dinantia short-code ID. |
| `name` | Dinantia style: `Cognoms + ", " + Nom`. |
| `email` | Selected institutional email / `CORREU INSTIT`. |
| `phone` | `Telèfon de contacte`, only if converted to E.164 format. |
| `gender` | Default `other`. |
| `language` | Default `ca_ES`. |
| `roles` | Always `["Staff"]` for teachers. |
| `groups` | Configured Dinantia group IDs. |
| `permissions` | Configured Dinantia permissions. |
| `fields` | Empty for now; `fields/index?roles[]=Staff` returned no custom staff fields. |

Phone note:

Dinantia expects phone numbers in E.164 format. For Spanish local mobile/phone values, v1 can normalize plain 9-digit numbers to:

```text
+34XXXXXXXXX
```

If the phone cannot be normalized safely, omit `phone` rather than failing account creation.

## Google/Dinantia Email Rule

Use the same institutional email selected in the admin console as the main Dinantia email:

```text
selectedEmail
```

This is the `iernestlluch.cat` Google Workspace account created or selected during the admin workflow.

Do not use `Compte @xtec` as the Dinantia staff account email. XTEC is only a recovery/contact email in the Google Workspace flow.

## Groups And Permissions

Dinantia groups must be fetched live from the API whenever the admin console loads. Do not use a static CSV or stored group list for the picker.

Use:

```http
GET /api/web/v1/groups/index?limit=100&page=N
```

Paginate until `pagination.has_next_page` is false.

Ignore groups whose `id` is empty or null.

### General Groups Picker

The admin UI must provide a searchable textbox for general Dinantia groups.

Behavior:

- Search by `id`, `name`, or `tag`.
- Show matching options while typing.
- Allow selecting multiple groups.
- Show selected groups as removable chips.
- Fetch group options fresh from Dinantia on each admin console load.

Default selected general groups for new teachers:

```json
["CLA", "ESO", "BAT", "CIC"]
```

When creating/updating the Dinantia staff account, apply the selected general groups to these scopes:

```js
groups: {
  attendances: selectedGeneralGroupIds,
  attitude: selectedGeneralGroupIds,
  messages: selectedGeneralGroupIds,
  newsletter: selectedGeneralGroupIds,
  wall: selectedGeneralGroupIds,
  view_students: selectedGeneralGroupIds,
  managed: selectedGeneralGroupIds,
  calendar: selectedGeneralGroupIds,
  member: selectedGeneralGroupIds
};
```

Permissions:

```js
permissions: [
  'attendances',
  'attitude',
  'messages',
  'newsletter',
  'wall'
]
```

Note: Dinantia currently rejects `payments` as a valid scope/permission value, so it cannot be applied via this integration.

### Teacher Group Picker

The admin UI must also provide a third searchable textbox labeled `Professor de` in the Dinantia section.

Behavior:

- Search by `id`, `name`, or `tag`.
- Allow selecting multiple teacher groups.
- Show selected teacher groups as removable chips.
- The teacher groups are optional.
- When creating/updating the Dinantia staff account, add:

```js
groups: {
  ...,
  teacher: selectedTeacherGroupIds
};
```

### Tutor Group Picker

The admin UI must provide a second searchable textbox for the tutor group.

Behavior:

- Search by `id`, `name`, or `tag`.
- Allow selecting only one group.
- Selecting a new tutor group replaces the old one.
- The tutor group is optional.

If selected, add:

```js
groups: {
  ...,
  tutor: [selectedTutorGroupId]
};
```

Discovered relevant groups:

| ID | Name | Tag |
| --- | --- | --- |
| `CLA` | Claustre | Claustre |
| `CLA-PRO` | Professors | Claustre:Professors |
| `CLA-TUT` | Tutors | Claustre:Tutors |
| `CLA-COO` | Coordinadors | Claustre:Coordinadors |
| `CLA-CAP` | Caps Departament | Claustre:Caps Departament |
| `CLA-DEP` | Departaments | Claustre:Departaments |
| `CLA-DEP-CAT` | Català | Claustre:Departaments:Català |
| `CLA-DEP-CAS` | Castellà | Claustre:Departaments:Castellà |
| `CLA-DEP-ANG` | Anglès | Claustre:Departaments:Anglès |
| `CLA-DEP-CIE` | Ciències Socials | Claustre:Departaments:Ciències Socials |
| `CLA-DEP-CIE0` | Ciències | Claustre:Departaments:Ciències |
| `CLA-DEP-MAT` | Matemàtiques | Claustre:Departaments:Matemàtiques |
| `CLA-DEP-PSI` | Psicopedagogia | Claustre:Departaments:Psicopedagogia |
| `CLA-DEP-EDU` | Educacio Física | Claustre:Departaments:Educacio Física |
| `CLA-DEP-EXP` | Expressió | Claustre:Departaments:Expressió |
| `CLA-DEP-INF` | Informàtica | Claustre:Departaments:Informàtica |
| `CLA-DEP-IMA` | Imatge Personal | Claustre:Departaments:Imatge Personal |

Important API behavior:

When updating `groups` for a scope, existing groups for that scope are overwritten. Therefore, the script must send the complete desired list for each scope it touches.

## Apps Script Client

Implement a small Dinantia API client in the admin project.

Required helper functions:

```js
function dinantiaRequest_(method, path, payload, query)
function dinantiaGetAccountById_(id)
function dinantiaFindAccountByEmail_(email)
function syncDinantiaStaff_(form, selectedEmail, options, shouldUpdate)
function dinantiaListGroups_()
```

Request details:

```js
const response = UrlFetchApp.fetch(url, {
  method,
  contentType: 'application/vnd.api+json',
  headers: {
    Accept: 'application/vnd.api+json',
    Authorization: `Basic ${Utilities.base64Encode(`${getDinantiaUser_()}:${getDinantiaSecret_()}`)}`
  },
  payload: payload ? JSON.stringify(payload) : undefined,
  muteHttpExceptions: true
});
```

Credential helpers:

```js
function getDinantiaUser_() {
  return PropertiesService.getScriptProperties().getProperty('DINANTIA_USER');
}

function getDinantiaSecret_() {
  return PropertiesService.getScriptProperties().getProperty('DINANTIA_SECRET');
}
```

Required Apps Script OAuth scope:

```json
"https://www.googleapis.com/auth/script.external_request"
```

## Spreadsheet Tracking

The current form response row is deleted after all three steps succeed:

```text
Google user created/updated
Teacher database row added/updated
Dinantia user created/updated
```

If any step fails, the form response row remains in the admin table and the admin UI displays separate statuses for Google, Dinantia, and the database. No separate sync log sheet is currently implemented.

## Error Handling

Dinantia responses may return HTTP 200 with `success: false` and an `errors` array. Treat that as failure.

Failure cases:

- HTTP status is not 2xx.
- JSON cannot be parsed.
- Response has `success === false`.
- Response contains an `errors` array.
- Required response `data` is missing after create/update.

On failure:

- Do not delete the form response row.
- Show per-system status in the admin table, with successful steps in green and failed steps in red.

## Security

- Dinantia credentials must only exist in the admin project Script Properties.
- Public form project must not include Dinantia credentials or API calls.
- Admin authorization still runs before every Dinantia action.
- Do not include the Dinantia Basic Auth secret in logs, spreadsheet cells, or error messages.

## Open Questions

1. Should Dinantia account updates ever remove groups/permissions, or only set the scopes we explicitly manage?
