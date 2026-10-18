// Online application for the pilgrimage: validates the form against content/forms.json and emails it
// to the organisers through Resend. Nothing is stored. Env: RESEND_API_KEY, MAIL_TO, MAIL_FROM.
const FORMS = require("../content/forms.json");
const SITE = require("../content/site.json");
// listed one by one so the bundler sees every file the function needs
const TEXT = { cs: require("../content/cs.json"), en: require("../content/en.json"), fr: require("../content/fr.json"), it: require("../content/it.json"), de: require("../content/de.json") };
const CS = TEXT.cs;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

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
    } else {
      v = typeof v === "string" ? v.trim() : "";
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

function fail(res, lang, form, status) {
  const t = TEXT[lang] || CS;
  const back = form && t.pages[form] ? t.pages[form].url : t.pages.prihlasky.url;
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html><html lang="${lang}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">` +
    `<title>${esc(t.ui.errorTitle)}</title><link rel="stylesheet" href="/css/site.css"><main class="wrap page page--simple"><h1 class="display">${esc(t.ui.errorTitle)}</h1>` +
    `<p>${esc(t.ui.errorText)}</p><p><a class="link-strong" href="${back}">${esc(t.ui.back)}</a></p></main></html>`);
}

module.exports = async (req, res) => {
  const body = typeof req.body === "object" && req.body ? req.body : {};
  const lang = TEXT[body.lang] ? body.lang : "cs";
  const form = FORMS[body.form] ? body.form : null;
  if (req.method !== "POST") { res.statusCode = 405; res.setHeader("Allow", "POST"); return res.end(); }
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) return fail(res, lang, form, 403);
  if (!SITE.registrationOpen || !form) return fail(res, lang, form, 403);
  const done = () => { res.statusCode = 303; res.setHeader("Location", TEXT[lang].pages.odeslano.url); res.end(); };
  if (body.web) return done();  // honeypot: bots fill every field; pretend it worked
  const rows = clean(FORMS[form], body);
  if (!rows || body.declaration !== "yes" || body.consent !== "yes") return fail(res, lang, form, 400);

  const name = rows.find((r) => r[1] === CS.fields.name)[2];
  const email = rows.find((r) => r[1] === CS.fields.email)[2];
  const title = `${CS.pages[form].title}: ${name}`;
  let html = `<h1 style="font:600 18px sans-serif">${esc(title)}</h1><table style="border-collapse:collapse;font:14px sans-serif">`;
  let text = `${title}\n`;
  let group = null;
  for (const [g, label, v] of rows) {
    if (g !== group) { group = g; html += `<tr><th colspan="2" style="text-align:left;padding:12px 0 4px">${esc(g || CS.pages[form].title)}</th></tr>`; text += `\n== ${g || CS.pages[form].title} ==\n`; }
    html += `<tr><td style="padding:3px 12px 3px 0;color:#555;vertical-align:top">${esc(label)}</td><td style="padding:3px 0;white-space:pre-wrap">${esc(v || "–")}</td></tr>`;
    text += `${label}: ${v || "–"}\n`;
  }
  const stamp = `Prohlášení a souhlas se zpracováním osobních a zdravotních údajů: ano · jazyk webu: ${lang} · odesláno ${new Date().toISOString()}`;
  html += `</table><p style="font:13px sans-serif;color:#555">${esc(stamp)}</p>`;
  text += `\n${stamp}\n`;

  try {
    await send({ to: [process.env.MAIL_TO || SITE.contact.email], reply_to: email, subject: title, html, text });
  } catch (e) {
    console.error(e.message);
    return fail(res, lang, form, 502);
  }
  // the applicant gets a receipt without any of the data, so a mistyped address leaks nothing
  const t = TEXT[lang];
  const receipt = t.pages.odeslano.body.replace(/<[^>]+>/g, "");
  send({ to: [email], reply_to: SITE.contact.email, subject: `${t.ui.site}: ${t.pages.odeslano.title}`, text: `${receipt}\n\n${SITE.contact.email}\n${SITE.baseUrl}${t.pages.home.url}` })
    .catch((e) => console.error(e.message))
    .finally(done);
};
