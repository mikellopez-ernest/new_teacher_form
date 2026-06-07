# New Teacher Form

Two Google Apps Script web apps managed locally with `clasp`:

- `public-form`: anonymous teacher intake form.
- `admin-console`: protected admin table for creating/updating Google Workspace users.

See [SPEC.md](SPEC.md) for the full requirements.

## Project Setup

Create or link two Apps Script projects, one per directory.

Public form:

```sh
cd public-form
cp .clasp.json.example .clasp.json
# Replace PUBLIC_FORM_SCRIPT_ID with the Apps Script project ID.
clasp push -f
clasp deploy
```

Admin console:

```sh
cd admin-console
cp .clasp.json.example .clasp.json
# Replace ADMIN_CONSOLE_SCRIPT_ID with the Apps Script project ID.
clasp push -f
clasp deploy
```

## Deployment Settings

Public form deployment:

- Execute as: script owner.
- Access: anyone, including anonymous users.

Admin console deployment:

- Execute as: user accessing the web app.
- Access: domain users.
- The signed-in user must belong to `/Administradors`.

## Google Services

The admin Apps Script project must enable the Admin SDK Directory advanced service:

- Service identifier: `AdminDirectory`
- Version: `directory_v1`

The backing Google Cloud project must also have the Admin SDK API enabled.

## Dinantia Credentials

The admin console reads Dinantia API credentials from Apps Script Script Properties.

In the admin Apps Script project, open:

```text
Project Settings -> Script properties
```

Add:

```text
DINANTIA_USER
DINANTIA_SECRET
```

The credentials are intentionally not stored in tracked source files.

## Spreadsheet Tabs

Form submissions:

- Spreadsheet ID: `1fnjQyGzoMw2m1NuZmL_TiS52cEmwyTkifS3tb_KGaMM`
- Tab name: `Form responses`

Teacher database:

- Spreadsheet ID: `1InUG9G_vyZfLsgzDENqk5rO0rygEzV2ttS4I8ZoxA1A`
- Tab name: `Llista`

## Upload Folders

- Photos: `1hhNV1wCbkVZYl7hqx78fqakhdr1-cgVz`
- Reduction files: `1JyphuC21DWvdahvKy8HEn6fQp-CNDjul`

## Notes

- The public project intentionally does not include admin functions.
- The admin project checks authorization server-side on page load and before actions.
- V1 sends admin notification emails on public form submission.
- V1 sends the teacher an email after Google Workspace account creation.
- After a full successful admin workflow, the processed form response row is deleted.
