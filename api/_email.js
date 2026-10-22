// E-mails in the website's style: a red strip, the Order's lockup on white (a red shield would be lost on red), the
// pilgrimage's name and headings in an EB Garamond-like serif, Asap-like text, a red strip at the foot. Table layout
// and inline styles, because mail clients ignore most CSS. The lockup travels inside the e-mail (inline image,
// static/img/email, made by tools/make_og.py): mail clients do not show SVG, and a linked image would not load while
// the site is behind Vercel's sign-in. (Files starting with _ in api/ are not endpoints.)
const fs = require("fs");
const path = require("path");

const RED = "#e31818", INK = "#454545", STRONG = "#111111", MUTED = "#5f5f5f", GREY = "#f3f3f3", RULE = "#e2e2e2";
const SERIF = "'EB Garamond',Garamond,Georgia,'Times New Roman',serif";
const SANS = "Asap,'Segoe UI',Arial,Helvetica,sans-serif";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const png = (lang) => fs.readFileSync(path.join(__dirname, "..", "static", "img", "email", `lockup-${lang}.png`));
// the lockup for that language as an inline attachment, referenced as cid:lockup
const logo = (lang) => ({ filename: "maltezsky-rad.png", content: png(lang).toString("base64"), content_id: "lockup" });
// shown 60 px high; the width differs per language (read from the PNG header, drawn at twice the size)
const logoWidth = (lang) => Math.round(png(lang).readUInt32BE(16) / 2);

const p = (html) => `<p style="margin:0 0 14px;font:16px/1.6 ${SANS};color:${INK}">${html}</p>`;
const button = (href, label) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px"><tr><td style="background:${RED};border-radius:4px">` +
  `<a href="${esc(href)}" style="display:inline-block;padding:12px 22px;font:600 15px ${SANS};color:#ffffff;text-decoration:none">${esc(label)}</a></td></tr></table>`;
// label/value rows, e.g. what the organisers see about a new application
const rows = (pairs) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:4px 0 18px">` +
  pairs.map(([k, v]) => `<tr><td style="padding:7px 12px 7px 0;border-bottom:1px solid ${RULE};font:14px ${SANS};color:${MUTED};vertical-align:top;width:34%">${esc(k)}</td>` +
    `<td style="padding:7px 0;border-bottom:1px solid ${RULE};font:15px/1.5 ${SANS};color:${STRONG};white-space:pre-wrap">${esc(v || "–")}</td></tr>`).join("") + `</table>`;

// the whole message: header with the lockup and the pilgrimage's name, title, body (HTML built from the helpers above), footer line
function shell({ lang, alt, heading, title, body, footer }) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>` +
    `<body style="margin:0;padding:0;background:${GREY}">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GREY}"><tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff">` +
    `<tr><td style="height:6px;line-height:6px;font-size:0;background:${RED}">&nbsp;</td></tr>` +
    `<tr><td style="padding:22px 28px 18px;border-bottom:1px solid ${RULE}"><img src="cid:lockup" width="${logoWidth(lang)}" height="60" alt="${esc(alt)}" style="display:block;border:0;height:60px;width:${logoWidth(lang)}px;color:${RED};font:600 16px ${SANS}">` +
    `<div style="margin-top:14px;font:500 22px/1.2 ${SERIF};color:${STRONG}">${esc(heading)}</div></td></tr>` +
    `<tr><td style="padding:32px 28px 14px"><h1 style="margin:0 0 18px;font:500 28px/1.2 ${SERIF};color:${STRONG}">${esc(title)}</h1>${body}</td></tr>` +
    `<tr><td style="padding:16px 28px 22px;border-top:1px solid ${RULE};font:13px/1.5 ${SANS};color:${MUTED}">${footer}</td></tr>` +
    `<tr><td style="height:6px;line-height:6px;font-size:0;background:${RED}">&nbsp;</td></tr>` +
    `</table></td></tr></table></body></html>`;
}

module.exports = { shell, logo, p, button, rows, esc };
