# New Teacher Form GAS Endpoint Specification

## Goal

Build two Google Apps Script web apps managed locally with `clasp`:

1. A public teacher intake form web app.
2. A protected admin web app for reviewing submissions and creating/updating Google Workspace users.

The public form must be accessible without login. The admin tool must only be accessible to authorized Google Workspace users in the `/Administradors` organizational unit.

## Architecture

Use two separate Apps Script projects or two separately deployed web apps with physically separated admin code. The preferred security model is two projects:

- `public-form`: anonymous web app, contains only form rendering and submission persistence.
- `admin-console`: authenticated web app, contains spreadsheet review, authorization checks, and Google Workspace user operations.

Both projects read shared configuration values such as spreadsheet IDs and Drive folder IDs from local config files that are uploaded with `clasp`.

## Shared Configuration

Each project should define its own `Config.js`. Secrets or deployment-specific IDs must be kept centralized in this file.

Required shared values:

```js
const CONFIG = {
  FORM_RESPONSES_SPREADSHEET_ID: '1fnjQyGzoMw2m1NuZmL_TiS52cEmwyTkifS3tb_KGaMM',
  FORM_RESPONSES_SHEET_NAME: 'Form responses',

  USER_DATABASE_SPREADSHEET_ID: '1InUG9G_vyZfLsgzDENqk5rO0rygEzV2ttS4I8ZoxA1A',
  USER_DATABASE_SHEET_NAME: 'Llista',

  PHOTO_UPLOAD_FOLDER_ID: '1hhNV1wCbkVZYl7hqx78fqakhdr1-cgVz',
  REDUCTION_UPLOAD_FOLDER_ID: '1JyphuC21DWvdahvKy8HEn6fQp-CNDjul',

  WORKSPACE_DOMAIN: 'iernestlluch.cat',
  TEACHER_ORG_UNIT_PATH: '/Personal educatiu',
  ADMIN_ORG_UNIT_PATH: '/Administradors',

  INITIAL_PASSWORD: 'ERNEST_LLUCH'
};
```

`USER_DATABASE_SPREADSHEET_ID` is only required by the admin app. Upload folder IDs are only required if uploaded files are stored in Drive by the public app.

## Public Form Web App

### Deployment

The public form web app must be deployed as:

- Execute as: script owner.
- Access: anyone, including anonymous users.

This app must not expose admin functions, spreadsheet table views, or Google Workspace user creation/update logic.

### GET Behavior

`doGet(e)` renders the teacher intake HTML form.

The form should be a single-column Google Forms-like layout with:

- Catalan labels copied from the original PDF.
- Red asterisk markers for required fields.
- Helper text under labels where present.
- File input controls for upload fields.
- Text inputs, date input, textarea fields, and select controls as appropriate.

### Form Fields

| Key | Label | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `photo` | Fotografia | file | yes | Carnet-style photo. |
| `nom` | Nom | text | yes | Given name. |
| `cognoms` | Cognoms | text | yes | Full surname string. |
| `dni` | DNI | text | yes | Stable matching key. Helper: `O altres`. |
| `dataNaixement` | Data naixement | date/text | no | Original example: `7 de gener de 2019`. |
| `telefon` | Telèfon de contacte | tel/text | yes | |
| `compteXtec` | Compte @xtec | email/text | no | Later used as alternative/recovery email. |
| `correuAlternatiu` | Compte de correu alternatiu | email/text | no | |
| `adreca` | Adreça | text | no | |
| `poblacio` | Població | text | no | |
| `especialitat` | Especialitat | text | yes | Include original explanatory helper text. |
| `departament` | Departament | select | no | Options listed below. |
| `nomenament` | Nomenament | select | yes | Options listed below. |
| `previsioReduccio` | Previsió de demanar reducció de jornada? | radio/select | yes | Options: `No`, `Si`. Include link `https://mote.fyi/8s7whh5`. |
| `motiuReduccio` | Motiu de la reducció | textarea | no | Only if requesting reduction. |
| `solicitudReduccio` | Sol·licitud de reducció de jornada | file | no | |
| `jornada` | Jornada | select | yes | Options listed below. |
| `anysEnsenyament` | Anys a ensenyament | textarea/text | no | |
| `anysInstitut` | Anys a l'institut Ernest Lluch i Martín | text | no | |
| `aficions` | Aficions | textarea | no | Include original explanatory helper text. |

Department options:

```text
Matemàtiques
Català
Castellà
Llengües estrangeres
Socials
Ciències
Educació Física
Diversitat / orientació
Expressió
Informàtica
Perruqueria
```

Nomenament options:

```text
Funcionari amb plaça definitiva
Funcionari amb plaça provisional
Interinatge
Substitució
```

Jornada options:

```text
Sencera
Sencera amb reducció
Mitja
Terç
```

### Submission Behavior

The public form submits to server-side Apps Script using `google.script.run` or `doPost`.

On submit:

1. Validate required fields server-side.
2. Normalize `dni` for matching, but preserve the original value submitted by the user.
3. Upload `photo`, if present, to `PHOTO_UPLOAD_FOLDER_ID`.
4. Upload `solicitudReduccio`, if present, to `REDUCTION_UPLOAD_FOLDER_ID`.
5. Append one row to the form responses spreadsheet.
6. Return a success screen or inline success state.

File binary content must not be written directly to the spreadsheet. Store Drive file IDs and URLs.

### Form Responses Spreadsheet Columns

The form responses sheet should include these columns:

```text
Timestamp
Status
Photo File ID
Photo URL
Nom
Cognoms
DNI
Data naixement
Telèfon de contacte
Compte @xtec
Compte de correu alternatiu
Adreça
Població
Especialitat
Departament
Nomenament
Previsió reducció jornada
Motiu reducció
Reducció File ID
Reducció File URL
Jornada
Anys a ensenyament
Anys a l'institut Ernest Lluch i Martín
Aficions
Suggested Google Email
Selected Google Email
Google User ID
Google User Action
Google User Status
Google User Updated At
Error
```

Initial `Status` should be `Submitted`.

## Admin Console Web App

### Deployment

The admin web app must be deployed as:

- Execute as: user accessing the web app, if possible for identity checks.
- Access: restricted to the Workspace domain or specific users.

The admin app must fail closed. If the current user's email or organizational unit cannot be determined, access is denied.

### Authorization

Admin access is based on Google Workspace organizational unit:

```text
/Administradors
```

The admin app must check the signed-in user's email using Apps Script session identity, then retrieve that user's Admin Directory profile and verify:

```js
user.orgUnitPath === CONFIG.ADMIN_ORG_UNIT_PATH
```

If the user is not in `/Administradors`, render an unauthorized page and do not load spreadsheet data.

Server-side action functions must call the same authorization guard. It is not enough to hide buttons in HTML.

### GET Behavior

`doGet(e)` renders an admin table containing rows from the form responses spreadsheet.

For each row:

1. Read the submitted `DNI`.
2. Normalize the `DNI`.
3. Check the user database spreadsheet for a matching `DNI`.
4. If the `DNI` exists in the user database, use `CORREU INSTIT` from that database row as the authoritative institutional email for Google user lookup.
5. If the `DNI` does not exist in the user database, use the generated email suggestion from the form row for Google user lookup.
6. Compute whether the row should show a create or update action.

Dynamic row action:

```text
Missing DNI
=> no action button, show "Missing DNI"

DNI not found in user database
=> show "Create Google User"

DNI found in user database and corresponding Google user exists
=> show "Update Google User"

DNI found in user database but corresponding Google user no longer exists
=> show "Create Google User"
```

Each row should show:

- Submitted teacher name.
- DNI.
- Department.
- Nomenament.
- Jornada.
- Current status.
- Suggested institutional email.
- Editable institutional email textbox.
- Create/Update button.
- Last sync result/error.

### Suggested Email Rule

The suggested institutional email is:

```text
normalized(nom) + normalized(first surname from cognoms) + @iernestlluch.cat
```

Example:

```text
Nom: Mikel
Cognoms: López Villarroya
Suggested email: mikellopez@iernestlluch.cat
```

The first surname is the first token before any space in `cognoms`.

Normalization rules:

- Lowercase.
- Remove spaces and punctuation.
- Replace accents and special characters with plain ASCII equivalents.
- Required mappings include:
  - `á`, `à`, `ä`, `â` -> `a`
  - `é`, `è`, `ë`, `ê` -> `e`
  - `í`, `ì`, `ï`, `î` -> `i`
  - `ó`, `ò`, `ö`, `ô` -> `o`
  - `ú`, `ù`, `ü`, `û` -> `u`
  - `ñ` -> `n`
  - `ç` -> `c`

The admin table must display a tooltip explaining how the suggested email was generated. Beneath or next to the suggestion, an editable textbox must be prefilled with the suggested email. The Google user operation uses the textbox value, not the raw suggestion.

Before creating a user, the admin app must check whether the selected institutional email already exists in Google Workspace. If it exists, warn the admin and show an editable textbox to enter another institutional email. The create action must not continue with an already-existing primary email unless the flow has switched to update for that same user.

### User Creation

When creating a Google Workspace user:

- Primary email: selected institutional email from the admin textbox.
- Domain: `iernestlluch.cat`.
- Given name: submitted `Nom`.
- Family name: submitted `Cognoms`.
- Password: `ERNEST_LLUCH`.
- Force password change on first login: yes.
- Organization unit: `/Personal educatiu`.
- Alternative/recovery email: submitted `Compte @xtec`, when present.

Required Admin Directory user payload fields:

```js
{
  primaryEmail: selectedEmail,
  name: {
    givenName: nom,
    familyName: cognoms
  },
  password: CONFIG.INITIAL_PASSWORD,
  changePasswordAtNextLogin: true,
  orgUnitPath: CONFIG.TEACHER_ORG_UNIT_PATH
}
```

Additional email fields should be added only where supported by the Admin Directory API. `Compte @xtec` must not be used as the account username.

### User Update

When updating an existing Google Workspace user:

- Match the user database row by normalized `DNI`.
- Use the selected institutional email as the intended institutional account.
- Update relevant user profile fields where safe:
  - name
  - org unit path
  - recovery/alternate email if supported and present
- Do not reset password during ordinary update unless explicitly requested later.

### Database Synchronization

After create/update succeeds, update the teacher database spreadsheet. The form response row is deleted after Google Workspace, teacher database, and Dinantia synchronization all succeed.

V1 sends the user an email after account creation with the institutional username and initial password. The admin UI displays per-system status for Google Workspace, Dinantia, and database synchronization.

Form responses row before deletion:

```text
Status = Synced
Selected Google Email = selected email
Google User ID = returned Google user ID
Google User Action = Created or Updated
Google User Status = Success
Google User Updated At = current timestamp
Error = blank
```

If create/update fails at any step:

```text
Status = Error
Google User Status = Error
Error = error message
```

The row remains visible in the admin table when a step fails. Successful step statuses are shown in green and failed step statuses are shown in red.

User database spreadsheet:

Existing columns are fixed:

```text
ESP
DEPT.
NOM
COGNOM1
COGNOM2
BAIXA?
CÀRREC
CAP DEPT
COORD
TUTORIA
EQUIP
FANTASMA
SITUACIÓ
DNI
TELF
CORREU XTEC
CORREU INSTIT
NOUS
ACTIVE
Nom sencer
```

When no matching `DNI` exists, append a new database row.

Suggested mappings:

| Database column | Source |
| --- | --- |
| `ESP` | Submitted `Especialitat` |
| `DEPT.` | Submitted `Departament` |
| `NOM` | Submitted `Nom` |
| `COGNOM1` | First token of submitted `Cognoms` |
| `COGNOM2` | Remaining surname tokens |
| `DNI` | Submitted `DNI` |
| `TELF` | Submitted `Telèfon de contacte` |
| `CORREU XTEC` | Submitted `Compte @xtec`, normalized to an `@xtec.cat` address when needed |
| `CORREU INSTIT` | Selected institutional email |
| `NOUS` | `TRUE` or `Sí` for newly appended rows |
| `ACTIVE` | Checkbox value `TRUE` |
| `Nom sencer` | `Nom + " " + Cognoms` |

Columns without a direct source should be preserved on update and left blank on insert unless later specified.

When appending a new row to `Llista`, copy the previous row, clear its contents, and then write the new teacher values. This preserves formatting, dropdown validations such as `SITUACIÓ` from `VARIABLES!A1:A20`, and checkbox validation such as `ACTIVE`.

## Apps Script Services And Scopes

The public app needs:

- Spreadsheet service.
- Drive service for uploads.

The admin app needs:

- Spreadsheet service.
- Admin SDK Directory advanced service.

Required OAuth scopes should include:

```json
[
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/admin.directory.user"
]
```

The admin app may need additional Admin Directory scopes if future requirements include group or alias management.

## Security Requirements

- Public project must not contain admin user creation/update functions.
- Admin authorization must be enforced server-side for every admin page and action.
- Admin page must deny access if identity lookup fails.
- Spreadsheet IDs and folder IDs are config values, not hardcoded throughout business logic.
- The initial password is currently fixed by requirement; avoid logging it.
- Error messages shown to public users should not expose internal spreadsheet IDs, Drive IDs, or Admin Directory payloads.

## Open Implementation Decisions

- Whether uploaded files should be renamed using `DNI`, timestamp, and field name.
- Whether the public form should use `doPost` or `google.script.run`.
- Whether the admin update action should support changing a user's primary email or only update metadata/database rows.
- Whether `Compte @xtec` maps to recovery email, external ID, notes, or custom schema in Google Workspace.
