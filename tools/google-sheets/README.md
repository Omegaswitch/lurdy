# Přihlášky z webu do Google tabulky

Every application sent on the website is also written to a Google Sheet:

- **one tab per form** ("Přihláška – nemocní", "Přihláška – poutníci", "Přihláška – tým"), one row per application;
- for **sick pilgrims**, also **a copy of the paper form** (tab `Formulář`), filled in, on its own tab named after the
  pilgrim (e.g. `Ing. Novák Jan 20.11.26 14:05`). It reads and prints like the paper form;
- **a Google Drive folder per applicant**, sorted by form, with the files they attached (medical report, photos):

  ```
  (the folder with the spreadsheet)
    Lurdy – přílohy přihlášek
      Přihláška – nemocní
        Ing. Jan Novák – 20.11.26 14:05
      Přihláška – poutníci
      Přihláška – tým
  ```
 Every applicant gets
  a folder, even without attachments, so a report that arrives later by post or e-mail can be dropped in. The row
  (column "Složka s přílohami") and the form tab (cell B92) link to it.

- **a new row in the registration list** ("Lourdes 2027" → tab `Participants`), **on the waiting list**: name
  (with the title), type P / M / T, Accueil or hotel, e-mail, address, phone, travels together, passport number,
  M / F, birth year, earlier pilgrimages, registration date. A note on the name says it came from the website (and
  whether they ask for a subsidy). The VarSym is the sheet's own. Someone who sends the form twice is not added twice.

  The **waiting list tick is on purpose**: the registration list's mail script sends the flight and payment letter to
  every row that is not on the waiting list, so new applicants get only the waiting-list letter until an organiser
  checks them and unticks "Waiting".

The main folder is created automatically the first time, in the same Drive folder as the spreadsheet. To use a folder
you already have (e.g. on a shared drive), put its ID (the last part of its address) in Script Properties as
`FOLDER_ID`.

The e-mail to the organisers still goes out as before; it is the record. Its footer says whether the sheet saved the
application ("zapsáno do Google tabulky" / "NEZAPSÁNO … – doplňte ručně") and its attachments ("přílohy uloženy na
Google Disk" / "NEULOŽENY … – uložte je z tohoto e-mailu").

## Setup (about 10 minutes)

1. **Upload the form to Google Drive.** Upload `Přihláška Lurdy.xlsx` and open it with Google Sheets
   (File → Save as Google Sheets). Keep the tab `Formulář` (it is the template) and `Ciselniky`. You can delete
   `Formulář vyplněný`.
2. **Add the script.** In that sheet: Extensions → Apps Script. Delete what is there, paste the contents of
   `prihlasky.gs`, and save.
3. **Set the secret.** In Apps Script: Project Settings (gear) → Script Properties → Add property:
   `SECRET` = a long random string (at least 32 characters). You can generate one with `openssl rand -hex 32`.
3b. **Connect the registration list.** Open "Lourdes 2027" and copy its ID from the address bar: the part between
   `/d/` and `/edit`. Add it in Script Properties as `REGISTER_ID`. The person who deploys the script (step 5) needs
   edit access to that spreadsheet.
4. **Check it.** Select `testSetup` in the toolbar and click Run. Allow the access Google asks for (Sheets and
   Drive: the script saves the attachments). The log should say `Template "Formulář": found`, `SECRET: set` and
   where the attachment folders will go, and `Register "Lourdes 2027": all columns found`.
5. **Publish it.** Deploy → New deployment → type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone** (the secret is what protects it; Google login cannot be used by the website)

   Click Deploy and copy the **Web app URL** (ends in `/exec`).
6. **Connect the website.** In Vercel → the website project → Settings → Environment Variables (Production):
   - `GOOGLE_SHEETS_URL` = the Web app URL
   - `GOOGLE_SHEETS_SECRET` = the same secret as in step 3

   Then redeploy the website (Deployments → … → Redeploy).
7. **Test.** Send a test application on the website. A new row and (for the sick form) a new tab appear.

If you set this up before the attachment folders existed: paste the new `prihlasky.gs`, run `testSetup` once to allow
Drive access, then publish a new version as below.

After you change the script later: Deploy → Manage deployments → edit (pencil) → Version: **New version** → Deploy.
The URL stays the same.

## Privacy – please read

The sick pilgrims' form carries **health data and the rodné číslo** (special-category data under GDPR).

- Use a Google account **of the organisation** (Google Workspace), not a personal Gmail, so a data-processing
  agreement with Google covers it.
- Share the sheet and the **Lurdy – přílohy přihlášek** folder **only with named organisers**; never "anyone with the link". Turn on 2-step verification for
  everyone who has access.
- Delete the sheet's data and the applicant folders after the pilgrimage, as the privacy policy says (the website's "Ochrana osobních údajů").
- The organisers' e-mail already contains the same data, so the mailbox needs the same care.

## What goes where

| | E-mail to organisers | Google Sheet | Správa pouti (admin) |
|---|---|---|---|
| Name, contact, ID number, emergency contact | yes | yes | yes |
| Health answers, rodné číslo | yes | yes | **never** |
| Attachments | yes | yes, in the applicant's Drive folder | **never** |
| Subsidy request | yes | yes | yes ("žádá o příspěvek") |

Notes on the paper form copy: the website lets people tick several hygiene aids, so cell D46 may hold more than one
(Sheets then marks it as not matching its drop-down; the text is right). Answers the paper form has no cell for (stay,
subsidy) are written under the form, in B91. The title is written in front of the first name.
