# Přihlášky z webu → Lourdes 2027

Every application sent on the website:

1. **becomes a line in Lourdes 2027 → Participants**, in the first empty row (the sheet keeps its own VarSym), with
   name (and title), type P / M / T, Accueil or hotel, e-mail, address, phone, travels together, passport number,
   M / F, birth year, earlier pilgrimages and registration date. **Waiting is ticked**, so the mail script sends
   only the waiting-list letter until an organiser checks the person and unticks it. A note on the name links to
   their folder and says if they ask for a subsidy. Someone who sends the form twice is not added twice.
2. **gets a folder in Drive, next to Lourdes 2027:**

   ```
   Lourdes 2027 (folder)
     Lourdes 2027 (the list)
     Lurdy – přílohy přihlášek
       Přihláška – nemocní
         Ing. Jan Novák – 20.11.26 14:05
           1-zprava_lekare.pdf
           Přihláška – Ing. Jan Novák – …        (all answers)
           Formulář – Ing. Jan Novák – …         (sick pilgrims: the paper form, filled in)
       Přihláška – poutníci
       Přihláška – tým
   ```

Health answers are only in the person's folder, never in the list. The e-mail to the organisers still carries
everything; its footer says whether the list and the folder were written.

## Setup

1. Open **Lourdes 2027** → Extensions → Apps Script. Leave `Code.gs` (the mail script) as it is.
2. Click **+ → Script**, name it `prihlasky`, paste `prihlasky.gs` into it, save.
3. Project Settings → Script Properties:
   - `SECRET` = a random string of 32+ characters (the same goes into Vercel)
   - `TEMPLATE_ID` = ID of the spreadsheet with the `Formulář` tab (the uploaded "Přihláška Lurdy" saved as Google
     Sheets), from its address `…/spreadsheets/d/<ID>/edit`. Optional: without it there is no filled-in paper form.
4. Editor → choose `testSetup` → Run → allow access. The log should say `SECRET: set`, `all columns found`, where
   the folders go and `template … found`.
5. Deploy → New deployment → Web app; Execute as **Me**; Who has access **Anyone** → Deploy; copy the URL.
6. Vercel → lurdy-pilgrimage → Settings → Environment Variables (Production): `GOOGLE_SHEETS_URL` = the URL,
   `GOOGLE_SHEETS_SECRET` = the secret → Redeploy.

After changing the script: Deploy → Manage deployments → pencil → Version: New version → Deploy (same URL).

The person who deploys needs edit access to Lourdes 2027, its folder and the template. Files are created under
their account. Share the folder only with named organisers; delete the applicant folders after the pilgrimage.
