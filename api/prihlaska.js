// Online application for the pilgrimage: validates the form against content/forms.json and emails it
// to the organisers through Resend; the applicant gets a confirmation in their language (no application data in it).
// Env: RESEND_API_KEY, MAIL_TO, MAIL_FROM, LURDY_ADMIN_URL (default https://lurdy.vercel.app).
// With LURDY_INTAKE_URL + LURDY_INTAKE_SECRET set, the identity, contact and emergency-contact fields also go to the
// management platform (admin → Přihlášky); health answers and attachments never do. The platform
// replies with the addresses chosen to be told about new applications, and they get a short notice.
const FORMS = require("../content/forms.json");
const SITE = require("../content/site.json");
// listed one by one so the bundler sees every file the function needs
const TEXT = { cs: require("../content/cs.json"), en: require("../content/en.json"), fr: require("../content/fr.json"), it: require("../content/it.json"), de: require("../content/de.json") };
const CS = TEXT.cs;
const MAIL = require("./_email");
// where the website really is (its .vercel.app address until lurdy.eu moves over), as build.py does for the preview image
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : SITE.baseUrl;
const ADMIN_URL = (process.env.LURDY_ADMIN_URL || "https://lurdy.vercel.app").replace(/\/$/, "");

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const MAX_BODY = 4.4 * 1024 * 1024; // Vercel refuses request bodies over 4.5 MB
const MAX_FILES = 5;
const MAGIC = [[[0x25, 0x50, 0x44, 0x46], "application/pdf"], [[0xff, 0xd8, 0xff], "image/jpeg"], [[0x89, 0x50, 0x4e, 0x47], "image/png"], [[0x52, 0x49, 0x46, 0x46], "image/webp"]];
const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+$/;  // what the browser's type=email accepts

function clean(def, body) {
  // returns [rows, applicantEmail] or null when anything is missing or out of range
  const rows = [];
  let group = "";
  for (const f of def) {
    if (f.g) { group = CS.fields[f.g]; continue; }
    let v = body[f.k];
    if (f.t === "check") {
      v = (Array.isArray(v) ? v : v ? [v] : []).map(String);
      if (v.some((x) => !f.o.includes(x))) return null;
      v = v.map((x) => CS.opts[x]).join(", ");
    } else if (f.t === "date") {
      // day, month and year arrive as three selects; checked to be a real calendar date
      const [d, m, y] = ["d", "m", "y"].map((p) => Number(body[`${f.k}_${p}`]) || 0);
      const dt = new Date(Date.UTC(y, m - 1, d));
      if ((d || m || y) && !(y > 1900 && dt.getUTCDate() === d && dt.getUTCMonth() === m - 1)) return null;
      v = d && m && y ? `${d}. ${m}. ${y}` : "";
    } else {
      v = typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim() : "";  // browsers count a line break as 1, the post sends CRLF
      if (f.t !== "area") v = v.replace(/[\x00-\x1f\x7f]+/g, " ");  // single lines stay single (the name goes into the subject)
      if (v.length > (f.t === "area" ? 2000 : 200)) return null;
      if (f.t === "radio" && v && !f.o.includes(v)) return null;
      if (f.t === "email" && v && !EMAIL.test(v)) return null;
      if (f.t === "radio" && v) v = CS.opts[v];
    }
    if (f.r && !v) return null;
    rows.push([group, CS.fields[f.k], v]);
  }
  return rows;
}

async function send(mail) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM || "Pouť do Lurd <prihlasky@lurdy.eu>", ...mail }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

// what the platform receives: identity, gender, contact, emergency contact, the ID / passport number (for the flight
// list), who they travel with, earlier pilgrimages; never health answers or files
const INTAKE_FORM = { poutnici: "pilgrim", nemocni: "malade", tym: "team" };
const INTAKE_FIELDS = ["name", "gender", "email", "mobile", "phone", "address", "idnum", "relname", "relmobile", "relphone", "times", "companion"];
async function intake(form, lang, body) {
  const url = process.env.LURDY_INTAKE_URL, secret = process.env.LURDY_INTAKE_SECRET;
  if (!url || !secret) return null;  // not connected: e-mail only
  const [d, m, y] = ["d", "m", "y"].map((p) => Number(body[`birth_${p}`]) || 0);
  const payload = { form: INTAKE_FORM[form], lang, birth: d && m && y ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null };
  for (const k of INTAKE_FIELDS) if (typeof body[k] === "string") payload[k] = body[k];
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-intake-secret": secret }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`intake ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const reply = await r.json().catch(() => ({}));
    return { notify: Array.isArray(reply.notify) ? reply.notify.filter((a) => typeof a === "string" && EMAIL.test(a)) : [] };
  } catch (e) {
    console.error(e.message);
    return false;  // the e-mail still goes out: it is the record, the organisers re-enter the person by hand
  }
}

function fail(res, lang, form, status) {
  const t = TEXT[lang] || CS;
  const back = form ? t.pages[form].url : t.pages.prihlasky.url;
  const why = { 403: t.ui.onlineClosed, 413: t.ui.filesTooBig, 502: t.ui.errorServer }[status] || t.ui.errorText;
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html><html lang="${lang}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">` +
    `<title>${esc(t.ui.errorTitle)}</title><link rel="stylesheet" href="/css/site.css"><main class="wrap page page--simple"><h1 class="display">${esc(t.ui.errorTitle)}</h1>` +
    `<p>${esc(why)}</p><p><a class="link-strong" href="${back}">${esc(t.ui.back)}</a></p></main></html>`);
}

// urlencoded bodies are parsed by Vercel; multipart (with attachments) is read and parsed here
async function readBody(req) {
  const type = req.headers["content-type"] || "";
  if (!type.startsWith("multipart/form-data")) return [typeof req.body === "object" && req.body ? req.body : {}, []];
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) return [null, []];
    chunks.push(c);
  }
  const data = await new Request("http://localhost/", { method: "POST", headers: { "content-type": type }, body: Buffer.concat(chunks) }).formData();
  const body = {}, files = [];
  for (const [k, v] of data) {
    if (typeof v !== "string") { if (k === "files" && v.size) files.push(v); continue; }
    body[k] = k in body ? [].concat(body[k], v) : v;
  }
  return [body, files];
}

// files are checked by their first bytes, not by the name or type the browser claims
async function attachments(files) {
  if (files.length > MAX_FILES) return null;
  const out = [];
  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    const kind = MAGIC.find(([sig]) => sig.every((b, i) => buf[i] === b));
    if (!kind || (kind[1] === "image/webp" && buf.toString("latin1", 8, 12) !== "WEBP")) return null;
    const ext = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[kind[1]];
    const base = (f.name || "priloha").replace(/\.[^.]*$/, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w-]+/g, "_").slice(0, 60) || "priloha";
    out.push({ filename: `${out.length + 1}-${base}.${ext}`, content: buf.toString("base64") });
  }
  return out;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.statusCode = 405; res.setHeader("Allow", "POST"); return res.end(); }
  const [body, files] = await readBody(req).catch(() => [null, []]);
  if (!body) return fail(res, "cs", null, 413);
  const lang = Object.hasOwn(TEXT, body.lang) ? body.lang : "cs";  // own keys only: "constructor" is not a language
  const form = Object.hasOwn(FORMS, body.form) ? body.form : null;
  const origin = req.headers.origin;
  let host = null;
  try { host = new URL(origin).host; } catch (e) {}
  if (origin && host !== req.headers.host) return fail(res, lang, form, 403);
  if (!SITE.registrationOpen || !form) return fail(res, lang, form, 403);
  const done = () => { res.statusCode = 303; res.setHeader("Location", TEXT[lang].pages.odeslano.url); res.end(); };
  if (body.web) return done();  // honeypot: bots fill every field; pretend it worked
  const rows = clean(FORMS[form].filter((f) => f.t !== "file"), body);
  const attached = await attachments(files);
  if (!rows || !attached || body.declaration !== "yes" || body.consent !== "yes") return fail(res, lang, form, 400);

  const name = rows.find((r) => r[1] === CS.fields.name)[2];
  const email = rows.find((r) => r[1] === CS.fields.email)[2];
  const formTitle = CS.pages[form].title;
  const title = `${formTitle}: ${name}`;
  const sent = new Date().toLocaleString("cs-CZ", { timeZone: "Europe/Prague", dateStyle: "short", timeStyle: "short" });
  let table = "", text = `${title}\n`, group = null;
  for (const [g, label, v] of rows) {
    if (g !== group) {
      group = g;
      table += `<tr><td colspan="2" style="padding:18px 0 6px;font:600 13px Asap,Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:#e31818">${esc(g || formTitle)}</td></tr>`;
      text += `\n== ${g || formTitle} ==\n`;
    }
    table += `<tr><td style="padding:6px 12px 6px 0;border-bottom:1px solid #e2e2e2;font:14px Asap,Arial,sans-serif;color:#5f5f5f;vertical-align:top;width:38%">${esc(label)}</td>` +
      `<td style="padding:6px 0;border-bottom:1px solid #e2e2e2;font:15px/1.5 Asap,Arial,sans-serif;color:#111;white-space:pre-wrap">${esc(v || "–")}</td></tr>`;
    text += `${label}: ${v || "–"}\n`;
  }
  if (attached.length) {
    table += `<tr><td colspan="2" style="padding:18px 0 6px;font:600 13px Asap,Arial,sans-serif;text-transform:uppercase;color:#e31818">${esc(CS.fields.attachments)}</td></tr>` +
      `<tr><td colspan="2" style="font:14px/1.6 Asap,Arial,sans-serif">${attached.map((a) => esc(a.filename)).join("<br>")}</td></tr>`;
    text += `\n== ${CS.fields.attachments} ==\n${attached.map((a) => a.filename).join("\n")}\n`;
  }
  const filed = await intake(form, lang, body);
  const stamp = `Prohlášení a souhlas se zpracováním osobních a zdravotních údajů: ano · jazyk webu: ${lang} · odesláno ${sent}` +
    (filed === null ? "" : filed ? " · uloženo ve správě pouti (Přihlášky)" : " · NEULOŽENO ve správě pouti – zadejte ručně");
  text += `\n${stamp}\n`;
  const html = MAIL.shell({ lang: "cs", alt: CS.ui.lockup, heading: CS.ui.mailHeader, title,
    body: `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 18px">${table}</table>` +
      (filed ? MAIL.button(`${ADMIN_URL}/#/prihlasky`, "Otevřít Přihlášky") : ""),
    footer: esc(stamp) });

  try {
    await send({ to: [process.env.MAIL_TO || SITE.contact.email], reply_to: email, subject: title, html, text,
      attachments: [MAIL.logo("cs"), ...attached] });
  } catch (e) {
    console.error(e.message);
    return fail(res, lang, form, 502);
  }
  const later = [];
  // the people chosen in the admin (Přihlášky → Upozornění) get a short notice: who and which form, nothing else
  if (filed && filed.notify.length) {
    later.push(send({ to: filed.notify, subject: `Nová přihláška: ${name} (${formTitle})`,
      text: `Na webu pouti přišla nová přihláška.\n\nJméno: ${name}\nPřihláška: ${formTitle}\nOdesláno: ${sent}\n\nPosoudit: ${ADMIN_URL}/#/prihlasky\n`,
      html: MAIL.shell({ lang: "cs", alt: CS.ui.lockup, heading: CS.ui.mailHeader, title: "Nová přihláška",
        body: MAIL.p("Na webu pouti přišla nová přihláška. Čeká v administraci na posouzení.") +
          MAIL.rows([["Jméno", name], ["Přihláška", formTitle], ["Odesláno", sent]]) +
          MAIL.button(`${ADMIN_URL}/#/prihlasky`, "Otevřít Přihlášky") +
          MAIL.p(`<span style="font-size:14px;color:#5f5f5f">Celá přihláška (i se zdravotními údaji a přílohami) šla jen na adresu přihlášek, ne v tomto upozornění.</span>`),
        footer: `Toto upozornění dostáváte, protože vás správce pouti zařadil mezi příjemce upozornění na nové přihlášky.` }),
      attachments: [MAIL.logo("cs")] }).catch((e) => console.error(e.message)));
  }
  // the applicant gets a confirmation without any of the data, so a mistyped address leaks nothing
  const t = TEXT[lang], u = t.ui, contact = SITE.contact.email, home = `${SITE_URL}${t.pages.home.url}`;
  const contactLine = esc(u.receiptContact).replace("{email}", `<a href="mailto:${contact}" style="color:#c80e00">${contact}</a>`);
  later.push(send({ to: [email], reply_to: contact, subject: `${u.site}: ${u.receiptTitle}`,
    text: `${u.receiptTitle}\n\n${u.receiptLead}\n${u.receiptNext}\n\n${t.pages[form].title}\n\n${u.receiptContact.replace("{email}", contact)}\n\n${u.siteFull || u.site}\n${home}\n\n${u.receiptNote}\n`,
    html: MAIL.shell({ lang, alt: u.lockup, heading: u.mailHeader, title: u.receiptTitle,
      body: MAIL.p(esc(u.receiptLead)) + MAIL.p(esc(u.receiptNext)) +
        MAIL.rows([[t.pages.prihlasky.title, t.pages[form].title]]) + MAIL.p(contactLine),
      footer: `<a href="${esc(home)}" style="color:#5f5f5f;text-decoration:none"><strong style="color:#111">${esc(u.siteFull || u.site)}</strong></a><br>${esc(u.lockup)}<br><br>${esc(u.receiptNote)}` }),
    attachments: [MAIL.logo(lang)] }).catch((e) => console.error(e.message)));
  Promise.all(later).finally(done);
};
