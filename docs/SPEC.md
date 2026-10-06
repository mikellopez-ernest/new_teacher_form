# New Teacher Form GAS Endpoint Specification

## Goal

Build two Google Apps Script web apps managed locally with `clasp`:

1. A public teacher intake form web app.
2. A protected admin web app for reviewing submissions and creating Google Workspace and Dinantia users.

The public form must be accessible without login. The admin tool must only be accessible to authorized Google Workspace users from the `iernestlluch.cat` domain, as defined by the admin script property `access_granted`.

## Architecture

Use two separate Apps Script projects or two separately deployed web apps with physically separated admin code. The preferred security model is two projects:

- `public-form`: anonymous web app, contains only form rendering and submission persistence.
- `admin-console`: authenticated web app, contains spreadsheet review, authorization checks, Google Workspace user creation, Dinantia user creation, and teacher database synchronization.

Both projects read shared configuration values such as spreadsheet IDs and Drive folder IDs from local config files that are uploaded with `clasp`.

## Shared Configuration

Each project should define its own `Config.js`. Secrets or deployment-specific IDs must be kept centralized in this file.

Required shared values:

```js
const CONFIG = {
  FORM_RESPONSES_SPREADSHEET_ID: '1fnjQyGzoMw2m1NuZmL_TiS52cEmwyTkifS3tb_KGaMM',
  FORM_RESPONSES_SHEET_NAME: 'Form responses',

  TABLES_SCRIPT_PROPERTY_NAME: 'Tables',
  TABLES_REGISTRY_SHEET_NAME: 'tables',
  USER_DATABASE_TABLE_NAME: 'Dades de professors',
  USER_DATABASE_SHEET_NAME: 'Llista',

  PHOTO_UPLOAD_FOLDER_ID: '1hhNV1wCbkVZYl7hqx78fqakhdr1-cgVz',
  REDUCTION_UPLOAD_FOLDER_ID: '1JyphuC21DWvdahvKy8HEn6fQp-CNDjul',

  WORKSPACE_DOMAIN: 'iernestlluch.cat',
  TEACHER_ORG_UNIT_PATH: '/Personal educatiu',
  ACCESS_GRANTED_PROPERTY_NAME: 'access_granted',
  WORKLOAD_REGISTRY_NAME: 'Càrrega lectiva',
  WORKLOAD_PROFESSORS_SHEET_NAME: 'professors',
  WORKLOAD_CARRECS_SHEET_NAME: 'carrecs',

  INITIAL_PASSWORD: 'ERNEST_LLUCH'
};
```

The admin app resolves the teacher database spreadsheet ID dynamically. It reads the Apps Script property named `Tables`; that property contains the spreadsheet ID of a registry spreadsheet. In that registry spreadsheet, sheet `tables` has column A `name` and column B `id`. The admin app must find the row where column A is exactly `Dades de professors` and use column B as the teacher database spreadsheet ID. Upload folder IDs are only required if uploaded files are stored in Drive by the public app.

If the `Tables` property, registry spreadsheet, `tables` sheet, `Dades de professors` row, or resolved spreadsheet ID is missing, the admin app must fail with a clear admin-facing configuration error.

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
| `cognom1` | Cognom 1 | text | yes | First surname. |
| `cognom2` | Cognom 2 | text | no | Second surname. |
| `dni` | DNI | text | yes | Stable matching key. Helper: `O altres`. |
| `dataNaixement` | Data naixement | date/text | no | Original example: `7 de gener de 2019`. |
| `telefon` | Telèfon de contacte | tel/text | yes | |
| `compteXtec` | Compte @xtec | email/text | no | Later used as alternative/recovery email. |
| `correuAlternatiu` | Compte de correu alternatiu | email/text | no | |
| `especialitat` | Especialitat | select | yes | Options listed below. |
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

| Form label | Teacher DB `DEPT.` |
| --- | --- |
| `Llengües estrangeres` | `ANG` |
| `Llengua castellana` | `CAS` |
| `Llengua catalana` | `CAT` |
| `Comerç` | `COM` |
| `Diversitat` | `DIV` |
| `Educació física` | `EFI` |
| `Ciències experimentals` | `EXP` |
| `Informàtica` | `INF` |
| `Matemàtiques` | `MAT` |
| `Orientació` | `ORI` |
| `Perruqueria` | `PCC` |
| `Socials` | `SOC` |
| `Tecnologia` | `TEC` |
| `Expressió artística` | `VIP` |

Especialitat options:

```text
505 - Formació i Orientació Laboral
507 - Informàtica
510 - Organització i gestió comercial
618 - Perruqueria
621 - Processos comerecials
627 - Sistemes i aplicacions informàtiques
A. Acoll
Ang
as
Bio/Geo
Cast
Cast.
Cat
Dib.
E. Fís
Econ
F82 - P.gestió admi.
Filos.
FiQ
FPS - Or.educativa
Francès
Geo/Hª
Llat
Mat
Mús.
PAES
Ps-Orient
Ps-Orient (SIEI)
Rel
Tecn
```

Nomenament options:

```text
Funcionari amb plaça definitiva
Funcionari amb plaça provisional
Funcionari amb plaça perfilada
Interinatge
Interinatge amb plaça perfilada
Comissió de serveis
Laboral
```

`Substitució` is no longer offered for new submissions. Its existing admin mapping remains available for previously submitted responses. `Comissió de serveis` writes `CS` to database `SITUACIO`; the database validation must allow `CS`.

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
5. Append one row to the form responses spreadsheet by header name. Existing legacy columns such as `Cognoms`, `Adreça`, and `Població` may remain in older spreadsheets, but new submissions should not write them.
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
Cognom 1
Cognom 2
DNI
Data naixement
Telèfon de contacte
Compte @xtec
Compte de correu alternatiu
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

- Execute as: user deploying the web app.
- Access: restricted to the Workspace domain.

The admin app must fail closed. If the current user's email cannot be determined, access is denied.

### Authorization

Admin access is based on a reusable role/email allowlist. The admin app reads the Apps Script property:

```text
access_granted
```

The property value is a comma-separated list of direct institutional emails and/or càrrecs. Entries containing `@` are direct allowed emails. Other entries are resolved as càrrecs through `Càrrega lectiva`.

Example:

```text
Coord. 3ESO,COCOBE,mikellopez@iernestlluch.cat
```

To resolve càrrecs, the admin app uses the same `Tables` registry mechanism:

- Script property `Tables` contains the registry spreadsheet ID.
- Registry sheet `tables` has logical names in column A and spreadsheet IDs in column B.
- The row named `Càrrega lectiva` provides the workload spreadsheet ID.
- Sheet `carrecs`: column A is the càrrec name, column D is the assigned person or comma-separated people.
- Sheet `professors`: column Q is the full teacher name / lookup key, column L is `CORREU INSTIT`.

Access is allowed only if the signed-in user's email matches a direct email from `access_granted` or an institutional email resolved from one of the configured càrrecs.

Server-side action functions must call the same authorization guard. It is not enough to hide buttons in HTML.

### GET Behavior

`doGet(e)` renders an admin table containing rows from the form responses spreadsheet.

For each row:

1. Read the submitted `DNI`.
2. Normalize the `DNI`.
3. Check the user database spreadsheet for a matching `DNI`.
4. If the `DNI` exists in the user database, use `CORREU` from that database row as the Google lookup email, then stop the automatic create flow and warn the admin.
5. If the `DNI` does not exist in the user database, use the generated email suggestion from the form row for Google user lookup.
6. Compute whether the row can be created or must be stopped for admin review.

Dynamic row action:

```text
Missing DNI
=> no action button, show "Missing DNI"

DNI not found in user database
=> show "Create Google and Dinantia users"

DNI found in user database
=> no create button, warn that the DNI already exists in the teacher database
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
- Suggested Untis alias / Dinantia ID.
- One editable textbox for the shared Untis alias and Dinantia ID.
- Alias check button that verifies the alias is not already present in teacher DB column `REDUIT` and not already used as a Dinantia account ID.
- Create button when the DNI is not already present in the teacher database.
- Last sync result/error.

### Suggested Email Rule

The suggested institutional email is:

```text
normalized(nom) + normalized(cognom1) + @iernestlluch.cat
```

Example:

```text
Nom: Mikel
Cognom 1: López
Cognom 2: Villarroya
Suggested email: mikellopez@iernestlluch.cat
```

The first surname is submitted explicitly as `cognom1`.

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
- Family name: submitted `Cognom 1` + optional `Cognom 2`.
- Password: `ERNEST_LLUCH`.
- Force password change on first login: yes.
- Organization unit: `/Personal educatiu`.
- Add the new user to Google Group `claustre@iernestlluch.cat`.
- Alternative/recovery email: submitted `Compte @xtec`, when present.

Required Admin Directory user payload fields:

```js
{
  primaryEmail: selectedEmail,
  name: {
    givenName: nom,
    familyName: cognom1 + " " + cognom2
  },
  password: CONFIG.INITIAL_PASSWORD,
  changePasswordAtNextLogin: true,
  orgUnitPath: CONFIG.TEACHER_ORG_UNIT_PATH
}
```

Additional email fields should be added only where supported by the Admin Directory API. `Compte @xtec` must not be used as the account username.

### Existing DNI Behavior

The current workflow does not automatically update existing teacher database rows or existing Google Workspace users. When a submitted `DNI` already exists in `Llista`, the admin table must warn the admin and disable the create action for that row.

### Creation Sequence And Database Synchronization

After validation succeeds and before creating external accounts, append to the teacher database spreadsheet. Google Workspace creation, Dinantia creation, and user email notification must not start unless the teacher database write succeeds. This makes spreadsheet validation errors stop the workflow before any external user accounts are created.

The form response row is deleted after teacher database, Google Workspace, and Dinantia synchronization all succeed.

V1 sends the user an email after account creation with the institutional username and initial password. The admin UI displays per-system status for Google Workspace, Dinantia, and database synchronization.

Form responses row before deletion:

```text
Status = Synced
Selected Google Email = selected email
Google User ID = returned Google user ID
Google User Action = Created
Google User Status = Success
Google User Updated At = current timestamp
Error = blank
```

If creation fails at any step:

```text
Status = Error
Google User Status = Error
Error = error message
```

The row remains visible in the admin table when a step fails. Successful step statuses are shown in green and failed step statuses are shown in red.

User database spreadsheet:

The teacher database spreadsheet ID is not a fixed source value. The admin app resolves it through the `Tables` script property registry:

- Script property: `Tables`
- Registry spreadsheet sheet: `tables`
- Registry column A: `name`
- Registry column B: `id`
- Lookup name: `Dades de professors`
- Resolved spreadsheet tab: `Llista`

Existing columns are fixed:

```text
ESP
DEPT.
NOM
COGNOM1
COGNOM2
REDUIT
SITUACIO
JORNADA
DNI
TELF
XTEC
CORREU
NOUS
ACTIU
BAIXA?
SUBST?
```

Current live sheets may keep Catalan/accented or legacy header names. The admin writer must accept both forms for these destinations:

| Canonical header | Accepted live aliases |
| --- | --- |
| `REDUIT` | `REDUIT`, `REDUÏT` |
| `SITUACIO` | `SITUACIO`, `SITUACIÓ` |
| `XTEC` | `XTEC`, `CORREU XTEC` |
| `CORREU` | `CORREU`, `CORREU INSTIT` |
| `ACTIU` | `ACTIU`, `ACTIVE` |

When no matching `DNI` exists, append a new database row. When a matching `DNI` already exists, warn the admin and do not update the existing database row automatically.

Suggested mappings:

| Database column | Source |
| --- | --- |
| `ESP` | Submitted `Especialitat` |
| `DEPT.` | Submitted `Departament`, mapped to the corresponding teacher DB department code |
| `NOM` | Submitted `Nom` |
| `COGNOM1` | Submitted `Cognom 1` |
| `COGNOM2` | Submitted `Cognom 2` |
| `REDUIT` | Editable admin-selected Untis alias / Dinantia ID; default is generated from first two normalized letters of first surname + department code |
| `SITUACIO` | Mapped from submitted `Nomenament` |
| `JORNADA` | Mapped from submitted `Jornada` |
| `DNI` | Submitted `DNI` |
| `TELF` | Submitted `Telèfon de contacte` |
| `XTEC` | Submitted `Compte @xtec`, normalized to an `@xtec.cat` address when needed |
| `CORREU` | Selected institutional email |
| `NOUS` | Boolean `TRUE` for newly appended rows |
| `ACTIU` | Boolean `TRUE` |
| `BAIXA?` | Boolean `FALSE` |
| `SUBST?` | Boolean `TRUE` only when submitted `Nomenament` is `Substitució`; otherwise `FALSE` |

`SITUACIO` mapping:

| Form `Nomenament` | Database `SITUACIO` |
| --- | --- |
| `Funcionari amb plaça definitiva` | `FUNC. DEF` |
| `Funcionari amb plaça provisional` | `FUNC. SNS PLAÇA` |
| `Funcionari amb plaça perfilada` | `FUNC. PERFIL` |
| `Interinatge` | `INT` |
| `Interinatge amb plaça perfilada` | `INT. PERF` |
| `Comissió de serveis` | `CS` |
| `Substitució` | `INT` |
| `Laboral` | `LABORAL` |

`JORNADA` mapping:

| Form `Jornada` | Database `JORNADA` |
| --- | --- |
| `Sencera` | `SENCERA` |
| `Mitja` | `MITJA` |
| `Terç` | `REDUCCIÓ UN TERÇ` |
| `Sencera amb reducció` | `REDUCCIÓ UN TERÇ` |

Boolean columns are `NOUS`, `ACTIU`, `BAIXA?`, and `SUBST?`. Reads should treat both boolean `true` and string `TRUE` as true. Writes should use real booleans.

Substitute eligibility must be based on `SUBST? === true` and `ACTIU === true`; do not infer substitute status from `SITUACIO`.

Removed legacy columns are not written anymore: `CÀRREC`, `CAP DEPT`, `COORD`, `TUTORIA`, `EQUIP`, `FANTASMA`, and `Nom sencer`. Full name is calculated on the fly from `NOM`, `COGNOM1`, and `COGNOM2` when needed.

When appending a new row to `Llista`, copy the previous row, clear its contents, and then write the new teacher values. This preserves formatting, dropdown validations such as `SITUACIO` and `JORNADA`, and checkbox validation such as `ACTIU`, `BAIXA?`, and `SUBST?`.

If leave-of-absence logic is added or used, the DB spreadsheet also has a `leave_absence` sheet:

```text
row_id
teacher_code
substitute_code
start_date
end_date
comments
```

`row_id` is the original row number in `Llista`; `teacher_code` is `ESP`; `substitute_code` is the substitute teacher `REDUIT`. Starting a leave sets `BAIXA?` to `true`; ending a leave fills `end_date` and sets `BAIXA?` to `false`.

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
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/script.send_mail",
  "https://www.googleapis.com/auth/script.external_request",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/admin.directory.user",
  "https://www.googleapis.com/auth/admin.directory.user.readonly",
  "https://www.googleapis.com/auth/admin.directory.group.member"
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

## Settled Implementation Decisions

- Public form submission uses `google.script.run`.
- Uploaded files are initially saved with normalized `DNI`, upload kind, and timestamp. Photos are renamed to the normalized `DNI` during admin processing.
- Existing DNI rows are not updated automatically; the admin UI warns and disables creation for that row.
- `Compte @xtec` maps to Google Workspace recovery email. If it is missing, `Compte de correu alternatiu` is used.
