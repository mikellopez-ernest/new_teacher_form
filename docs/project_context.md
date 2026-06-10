# Project Context: New Teacher Form

This project consists of two Google Apps Script web apps for managing new teacher onboarding.

## 1. Public Form (`public-form`)

A public web form for new teachers to submit their information.

- **Functionality:**
  - Renders an HTML form (`Form.html`).
  - Collects teacher data, including personal information, department, appointment details, and file uploads (photo and reduction request).
  - On submission, it validates the data, uploads files to Google Drive, and appends a new row to a Google Sheet (`Form responses`).
  - Sends an email notification to administrators.
- **Authentication:** None. The form is publicly accessible.
- **Deployment:** Deployed as a web app accessible to anyone, including anonymous users.

## 2. Admin Console (`admin-console`)

A protected web app for administrators to review submissions and manage Google Workspace and Dinantia users.

- **Functionality:**
  - Displays a table of submitted teacher forms from the Google Sheet.
  - Allows administrators to create or update Google Workspace users based on the submitted data.
  - Synchronizes teacher data with a separate user database Google Sheet.
  - Integrates with the Dinantia API to create or update staff accounts.
  - Sends a notification email to the new teacher with their account credentials.
- **Authentication:** Restricted to users in the `/Administradors` Google Workspace organizational unit.
- **Deployment:** Deployed as a web app that requires users to be logged into their Google account and checks their organizational unit for authorization.

## Key Components

- **Google Sheets:**
  - **Form Responses:** A sheet to collect raw data from the public form.
  - **User Database:** A sheet that serves as the master list of teachers.
  - **Admin Notifications:** A sheet to list the email addresses of the administrators who will receive notifications.
- **Google Drive:** Used to store uploaded files (photos and reduction requests).
- **Google Apps Script:** The core technology used for both the public form and the admin console.
- **`clasp`:** Used for local development and deployment of the Apps Script projects.
- **Dinantia API:** An external service for managing staff accounts.

## Workflow

1. A new teacher fills out and submits the public form.
2. The submission is recorded in the Form Responses Google Sheet.
3. An administrator opens the Admin Console.
4. The Admin Console displays the new submission.
5. The administrator reviews the data and clicks Create or Update.
6. The system:
   - Creates or updates the user in Google Workspace.
   - Creates or updates the user in Dinantia.
   - Adds or updates the user's record in the User Database Google Sheet.
   - Sends the new teacher an email with their credentials.
   - Deletes the row from the Form Responses sheet.

