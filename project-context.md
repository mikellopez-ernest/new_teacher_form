# Project Context: New Teacher Form

Use this file as the primary project memory before relying on conversation history.

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
- Validates required fields server-side.
- Uploads photo files to Drive folder `1hhNV1wCbkVZYl7hqx78fqakhdr1-cgVz`.
- Uploads reduction request files to Drive folder `1JyphuC21DWvdahvKy8HEn6fQp-CNDjul`.
- Appends submissions to spreadsheet `1fnjQyGzoMw2m1NuZmL_TiS52cEmwyTkifS3tb_KGaMM`, tab `Form responses`.
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
- Allows users in `/Administradors`; superadmins/delegated admins are also allowed by code.
- Reads form rows from `Form responses`.
- Checks the teacher database spreadsheet `1InUG9G_vyZfLsgzDENqk5rO0rygEzV2ttS4I8ZoxA1A`, tab `Llista`, by normalized `DNI`.
- Uses `CORREU INSTIT` from `Llista` as authoritative email when a matching DNI exists.
- Otherwise suggests institutional email as `nom + first surname + @iernestlluch.cat`, normalized.
- Button labels:
  - `Create Google and Dinantia users`
  - `Update Google and Dinantia users`
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
- Admin access org unit: `/Administradors`.
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

Important behavior:

- `CORREU XTEC` is filled from form field `Compte @xtec`.
- `ACTIVE` is written as boolean `true`.
- When appending to `Llista`, copy the previous row, clear content, then write the new teacher data. This preserves formatting, dropdown validation such as `SITUACIÓ` from `VARIABLES!A1:A20`, and checkbox validation such as `ACTIVE`.

## Dinantia Rules

Dinantia credentials are stored in admin Apps Script Script Properties:

```text
DINANTIA_USER
DINANTIA_SECRET
```

Do not store the secret in source files.

Dinantia config:

- Base URL: `https://app.dinantia.com`
- Create/update endpoint currently used: `POST /api/web/v1/accounts/update`
- Account ID uses short-code style, e.g. `AZCAT`, not DNI.
- Suggested ID: first two letters of first surname + department code.
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
