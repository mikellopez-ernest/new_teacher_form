# Project Context: New Teacher Form

Use this file as the single source of truth for project memory and endpoint behavior.

## Project Shape

The repo contains two Google Apps Script projects managed with `clasp`:

- `public-form`: anonymous public form for new teacher intake.
- `admin-console`: protected admin console for processing submissions.

Detailed specs live in:

- `docs/SPEC.md`
- `docs/DINANTIA_SPEC.md`

Configuration-like values should live in each project `Config.js`. This includes sheet IDs/names, Drive folder IDs, response/database headers, required fields, status labels, email template names, Dinantia API paths, Dinantia script property names, default groups/scopes, and default account values. Keep function-local scratch variables in the function where they are used.

## Public Form

Files:

- `public-form/Code.js`
- `public-form/Form.html`
- `public-form/Config.js`
- `public-form/AdminNotificationEmail.html`

Behavior:

- Public/anonymous web app.
- Shows the teacher intake form.
- Uses separate surname fields: `Cognom 1` and `Cognom 2`.
- Does not collect `Adreça` or `Població`.
- `Especialitat` is a required select field with the fixed configured option list.
- `Nomenament` offers `Comissió de serveis` instead of `Substitució`. `Comissió de serveis` writes database `SITUACIO = CS` and `SUBST? = false`; database validation must allow `CS`. Retain legacy `Substitució` handling for existing responses.
- Validates required fields server-side.
- Uploads photo files to Drive folder `1hhNV1wCbkVZYl7hqx78fqakhdr1-cgVz`.
- Uploads reduction request files to Drive folder `1JyphuC21DWvdahvKy8HEn6fQp-CNDjul`.
- Appends submissions by header name to spreadsheet `1fnjQyGzoMw2m1NuZmL_TiS52cEmwyTkifS3tb_KGaMM`, tab `Form responses`.
- Sends admin notification emails using addresses from spreadsheet `1eW91L6sWLs6cKg3AXi0spGc1vv6sYQ4jwiMvM-gK__E`; columns are `name`, `lastname`, `email`.
- After successful submit, redirects to `https://agora.xtec.cat/sesernestlluch-cunit/`.

## Admin Console

Files:

- `admin-console/Code.js`
- `admin-console/Admin.html`
- `admin-console/Config.js`
- `admin-console/UserCreatedEmail.html`
- `admin-console/Unauthorized.html`

Behavior:

- Authenticated web app.
- Web app access is restricted to domain users and executes as the deployer.
- Allows only users listed by the `access_granted` script property.
- `access_granted` is a comma-separated list of direct institutional emails and/or càrrecs.
- Direct email entries are allowed immediately; càrrec entries are resolved through `Càrrega lectiva`.
- `Càrrega lectiva` is resolved from the `Tables` registry. Sheet `carrecs` maps column A càrrec names to column D assigned people; sheet `professors` maps column Q full names to column L institutional emails.
- Reads form rows from `Form responses`.
- Resolves the teacher database spreadsheet ID from the admin script property `Tables`.
  - `Tables` contains the ID of a registry spreadsheet.
  - Registry sheet is `tables`.
  - Column A `name` contains `Dades de professors`.
  - Column B `id` contains the teacher database spreadsheet ID.
  - Teacher database tab remains `Llista`.
- Checks the resolved teacher database by normalized `DNI`.
- Uses `CORREU` from `Llista` as a lookup email when a matching DNI exists.
- Otherwise suggests institutional email as `nom + first surname + @iernestlluch.cat`, normalized.
- Shows and allows editing the Untis alias used for database column `REDUIT`.
- Button labels:
  - `Create Google and Dinantia users`
- Existing DNI rows show a warning and cannot be created automatically.
- Writes the teacher database row before creating Google Workspace/Dinantia accounts or sending email. If teacher DB validation fails, no external account creation begins.
- Shows per-system statuses:
  - Google user created/not created correctly
  - Dinantia user created/not created correctly
  - User added to database correctly/not correctly
- Successful lines are green; failed lines are red.
- If any step fails, the form row remains visible.
- If all steps succeed, the form row is deleted.

## Google Workspace Rules

- Domain: `iernestlluch.cat`
- New users go to org unit `/Personal educatiu`.
- New users are added to Google Group `claustre@iernestlluch.cat`.
- Admin access is controlled by `access_granted`, not by organizational unit.
- Initial password: `ERNEST_LLUCH`.
- Force password change on first login.
- `Compte @xtec` is used as recovery email; if missing, use `Compte de correu alternatiu`.
- `Compte @xtec` may be typed as username only; normalize to `username@xtec.cat`.
- Created-user notification email goes to XTEC email if available, otherwise alternative email.

## Teacher Database Rules

Database columns:

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

Live header compatibility:

- The writer accepts `REDUIT` or `REDUÏT` for the generated/admin-selected teacher alias.
- The writer accepts `SITUACIO` or `SITUACIÓ` for the mapped `Nomenament` value.
- The writer accepts `XTEC` or `CORREU XTEC` for the XTEC email.
- The writer accepts `CORREU` or `CORREU INSTIT` for the selected `@iernestlluch.cat` email.
- The writer accepts `ACTIU` or `ACTIVE` for active status.

Important behavior:

- `REDUIT` is the admin-selected Untis alias. It defaults to the generated teacher code: first two normalized letters of the first surname plus the department code. The same textbox value is also used as the Dinantia account ID.
- `DEPT.` is written as the teacher database validation code, mapped from the public form department label: `Llengües estrangeres -> ANG`, `Llengua castellana -> CAS`, `Llengua catalana -> CAT`, `Comerç -> COM`, `Diversitat -> DIV`, `Educació física -> EFI`, `Ciències experimentals -> EXP`, `Informàtica -> INF`, `Matemàtiques -> MAT`, `Orientació -> ORI`, `Perruqueria -> PCC`, `Socials -> SOC`, `Tecnologia -> TEC`, `Expressió artística -> VIP`.
- `SITUACIO` is mapped from form field `Nomenament`; `Substitució` writes `SITUACIO = INT` and `SUBST? = true`.
- `JORNADA` is mapped from form field `Jornada` to `SENCERA`, `MITJA`, or `REDUCCIÓ UN TERÇ`.
- `BAIXA?` is written as boolean `false` for new teachers.
- `NOUS`, `ACTIU`, `BAIXA?`, and `SUBST?` are written as real booleans.
- `XTEC` is filled from form field `Compte @xtec`.
- `CORREU` is filled from the selected institutional email.
- If a DNI already exists in `Llista`, warn the admin and do not update the existing database row automatically.
- Removed legacy columns are no longer written: `CÀRREC`, `CAP DEPT`, `COORD`, `TUTORIA`, `EQUIP`, `FANTASMA`, and `Nom sencer`.
- When appending to `Llista`, copy the previous row, clear content, then write the new teacher data. This preserves formatting, dropdown validation and checkbox validation.

## Dinantia Rules

Dinantia credentials are stored in admin Apps Script Script Properties:

```text
DINANTIA_USER
DINANTIA_SECRET
```

Do not store the secret in source files.

Dinantia config:

- Base URL: `https://app.dinantia.com`
- Create endpoint currently used: `POST /api/web/v1/accounts/update`
- Account ID uses short-code style, e.g. `AZCAT`, not DNI.
- Suggested ID: first two letters of first surname + department code. This is the same admin-edited value as the Untis alias.
- Main Dinantia email is the institutional `@iernestlluch.cat` email.
- Role: `Staff`
- Default language: `ca_ES`
- Default gender: `other`
- Default general groups: `CLA`, `ESO`, `BAT`, `CIC`
- Staff permissions: `attendances`, `attitude`, `messages`, `newsletter`, `wall`
- General group scopes: `attendances`, `attitude`, `messages`, `newsletter`, `wall`, `view_students`, `managed`, `calendar`, `member`
- There is a live multi-select group picker. Groups are fetched from Dinantia on each admin console load, not from the static CSV.
- There is a separate single-select tutor group picker. If selected, it adds `tutor: [selectedTutorGroupId]`.

Local fetched group snapshots exist for reference only:

- `dinantia-groups.json`
- `dinantia-groups.csv`

## Deployment

Use `clasp push -f` and `clasp deploy` from the relevant project directory.

Current known script IDs:

- Public form: `1AuQbRhx9tP8-CgFBgm3V4L3dxe8G6_vW2OqAcCq8X56h7n8qnTpHB3FC`
- Admin console: `16Ls3HJFqV5x0DIDkMekWUcNugQUjbjMJ8bnW4sH8_AvP-w3OEm1sDPG-`

After scope changes, the user may need to reauthorize the Apps Script project manually.
