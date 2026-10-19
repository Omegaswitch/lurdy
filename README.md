# lurdy.eu

The website for the pilgrimage with the sick to Lourdes, organised by the Czech Grand Priory of the Order of Malta.
The site is in Czech, English, French, Italian and German.
It is built with the same engine as maltezskyrad.cz: a static generator in plain Python (standard library only), the Grand Magistry frame, and Vercel hosting.

```
python3 build.py              # preview build → dist/ (noindex, content-status labels)
python3 build.py serve 8000   # preview on http://127.0.0.1:8000 (form posts go to the thank-you page)
python3 check.py              # checks the build: links, one <h1> per page, titles, descriptions, brand files
node api/test.js              # checks the application function, with the email service stubbed
```

## Content

| File | What |
|---|---|
| `content/site.json` | Facts: pilgrimage dates, **`registrationOpen`**, contact, organiser (IČO), bank account, gallery years, downloads |
| `content/cs.json` | All Czech text: pages, FAQ, gallery, form labels, privacy notice |
| `content/en.json` … `de.json` | The same keys, translated. A key missing from a language breaks the build, so add every key in all five files. |
| `content/forms.json` | The fields of the online applications (sick, pilgrims, team). It is shared by the page generator and the email function. |
| `static/files/` | Downloadable applications (Word/RTF), poster and travel information |
| `static/media/` | Photos, WebP at 800 and 1600 px |

**Opening registration for a new year:**
1. Update `pilgrimage` (number, start, end) and `last` in `site.json`.
2. Set `"registrationOpen": true`.
3. Commit; Vercel rebuilds.

While `registrationOpen` is false, the form pages show the closed notice plus the download link, and the function refuses submissions.

## Online applications (`api/prihlaska.js`)

The function is a Vercel serverless function. It validates the submission against `content/forms.json`, sends it by email through [Resend](https://resend.com) to the organisers, and redirects to the thank-you page. Nothing is stored.

Attachments: up to 5 photos or PDFs, 4 MB in total. `static/js/site.js` shrinks them on the visitor's device before upload, so nothing goes to any outside service:
- photos are redrawn on a canvas at 2000 px as JPEG;
- PDFs over 1 MB go through Ghostscript compiled to WebAssembly (`static/js/pdf-worker.js`, `static/js/vendor/ghostscript-1.1.0/`), loaded only when such a PDF is attached.

The upload then runs with a progress bar. The server checks each file by its first bytes and attaches it to the email.

Ghostscript is AGPL-licensed. Its licence and source links are in `static/js/vendor/ghostscript-1.1.0/`. The footer links to this repository's source, which keeps the site compliant. The CSP allows `'wasm-unsafe-eval'` for this; it lets WebAssembly compile, not JavaScript `eval`.

The applicant gets only a receipt, with none of their data in it. A mistyped address therefore leaks no health data.

Spam protection:
- a hidden honeypot field;
- an Origin check;
- strict server-side validation: required fields, allowed options, length limits.

Set these environment variables in Vercel (Project → Settings → Environment Variables):

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | the Resend API key (secret, never in the repo) |
| `MAIL_TO` | where applications go (default `lurdy@lurdy.eu`) |
| `MAIL_FROM` | sender, on a domain verified in Resend (default `Pouť do Lurd <prihlasky@lurdy.eu>`) |

In Resend, verify the `lurdy.eu` domain: add the DNS records that Resend gives you at the lurdy.eu DNS host. Until the domain is verified, Resend refuses the sender address.

## Hosting

`vercel.json` holds the build command, the security headers (CSP, HSTS and others), cache rules, and the redirects from the old WordPress URLs. `build.py` also writes `_headers` and `_redirects` for other hosts.
