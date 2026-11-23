// node tests/api.test.js — exercises api/prihlaska.js with the email service stubbed. Exits non-zero on failure.
const assert = require("assert");
const SITE = require("../content/site.json");
SITE.registrationOpen = true; // the cached module object is the one the handler sees
const OPENS = SITE.opensOn;
SITE.opensOn = {};  // frozen forms are tested at the end
const sent = [];
const intakes = [];
let intakeOk = true;
const sheetPosts = [];
let sheetOk = true;
global.fetch = async (url, o) => {
  if (url.includes("script.google.com")) {
    sheetPosts.push(JSON.parse(o.body));
    return { ok: true, status: 200, json: async () => (sheetOk ? { ok: true, files: true, register: true } : { ok: false, error: "secret" }) };
  }
  if (url.includes("intake")) {
    intakes.push({ headers: o.headers, body: JSON.parse(o.body) });
    return { ok: intakeOk, status: intakeOk ? 201 : 500, text: async () => "", json: async () => ({ id: "x", notify: ["koordinator@example.test", "not an address"] }) };
  }
  sent.push(JSON.parse(o.body)); return { ok: true, text: async () => "" };
};
process.env.RESEND_API_KEY = "test";
const handler = require("../api/prihlaska.js");

const { Readable } = require("stream");
async function multipart(fields, files) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) [].concat(v).forEach((x) => fd.append(k, x));
  for (const [name, bytes] of files) fd.append("files", new Blob([bytes]), name);
  const r = new Request("http://x/", { method: "POST", body: fd });
  const req = Readable.from([Buffer.from(await r.arrayBuffer())]);
  req.method = "POST";
  req.headers = { host: "www.lurdy.eu", "content-type": r.headers.get("content-type") };
  return new Promise((resolve) => {
    const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, headers: this.headers }); } };
    handler(req, res);
  });
}

function call(body, headers = {}) {
  return new Promise((resolve) => {
    const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, headers: this.headers, body: b }); } };
    handler({ method: "POST", headers: { host: "www.lurdy.eu", ...headers }, body }, res);
  });
}

const good = { form: "poutnici", lang: "en", name: "Jan <b>Novák</b>", birth_d: "1", birth_m: "1", birth_y: "1950", gender: "male", email: "jan@example.com", address: "Praha", idnum: "123",
  idvalid_d: "31", idvalid_m: "12", idvalid_y: "2030", mobile: "777", relname: "Eva", relmobile: "666", diet: "yes", dietkind: ["diabetic", "nosalt"], declaration: "yes", consent: "yes" };

(async () => {
  let r = await call(good, { origin: "https://www.lurdy.eu" });
  assert.equal(r.status, 303); assert.equal(r.headers.Location, "/en/applications/sent/");
  assert.equal(sent.length, 2, "application + receipt");
  assert.ok(sent[0].html.includes("Jan &lt;b&gt;Novák&lt;/b&gt;"), "applicant input is escaped");
  assert.ok(sent[0].text.includes("diabetická, neslaná"), "options in Czech for the organisers");
  assert.ok(sent[0].text.includes("1. 1. 1950"), "date assembled");
  assert.ok(!sent[1].text.includes("1950") && !sent[1].html.includes("1950") && !sent[1].html.includes("Nov"), "the receipt carries no application data");
  assert.equal(sent[1].subject, "Pilgrimage to Lourdes: Application received", "receipt in the applicant's language");
  assert.ok(sent[1].html.includes("we have received your application") && sent[1].html.includes("cid:lockup"), "styled receipt with the lockup");
  assert.deepEqual(sent[1].attachments.map((a) => [a.content_id, a.filename]), [["lockup", "maltezsky-rad.png"]], "lockup travels inside the e-mail");
  assert.ok(sent[0].html.includes("cid:lockup") && !sent[0].html.includes("Otevřít Přihlášky"), "organiser e-mail styled; no admin link when not connected");

  sent.length = 0;
  assert.equal((await call({ ...good, consent: "" })).status, 400, "consent is required");
  assert.equal((await call({ ...good, diet: "maybe" })).status, 400, "unknown option");
  assert.equal((await call({ ...good, gender: "" })).status, 400, "gender is required");
  assert.equal((await call({ ...good, name: "x".repeat(201) })).status, 400, "length limit");
  assert.equal((await call({ ...good, email: "nope" })).status, 400, "email format");
  assert.equal((await call({ ...good, birth_d: "31", birth_m: "2" })).status, 400, "31 February is not a date");
  assert.equal((await call(good, { origin: "https://evil.example" })).status, 403, "foreign origin");
  assert.equal((await call({ ...good, form: "nope" })).status, 403, "unknown form");
  assert.equal((await call({ ...good, web: "spam" })).status, 303, "honeypot pretends success");
  sent.length = 0;
  assert.equal((await call({ ...good, health: ("x".repeat(99) + "\n").repeat(20).replace(/\n/g, "\r\n") })).status, 303, "CRLF counts as one character");
  assert.ok(!/[\r\n]/.test(sent[0].subject), "subject is one line");
  assert.equal((await call({ ...good, name: "Jan\r\nBcc: x@y.z" })).status, 303);
  assert.ok(!/[\r\n]/.test(sent[2].subject), "line breaks in the name never reach the subject");
  for (const bad of [{ form: "constructor" }, { lang: "toString" }, { lang: "constructor", form: "__proto__" }])
    assert.ok([303, 403].includes((await call({ ...good, ...bad })).status), `no crash on ${JSON.stringify(bad)}`);
  assert.equal((await call(good, { origin: "null" })).status, 403, "Origin: null is refused, not a crash");
  sent.length = 0;
  r = await multipart(good, [["zpráva lékaře.pdf", Buffer.from("%PDF-1.4 test")], ["foto.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2])]]);
  assert.equal(r.status, 303, "multipart with attachments");
  assert.deepEqual(sent[0].attachments.map((a) => a.filename), ["maltezsky-rad.png", "1-zprava_lekare.pdf", "2-foto.jpg"]);
  assert.ok(sent[0].text.includes("diabetická, neslaná"), "repeated checkbox values survive multipart");
  sent.length = 0;
  assert.equal((await multipart(good, [["virus.pdf", Buffer.from("MZ\x90")]])).status, 400, "file checked by content, not name");
  assert.equal((await multipart(good, Array(6).fill(["a.pdf", Buffer.from("%PDF")]))).status, 400, "at most 5 files");
  assert.equal(sent.length, 0);
  // connected to the management platform: identity, contact and emergency contact only
  assert.equal(intakes.length, 0, "not connected: nothing leaves but the e-mail");
  process.env.LURDY_INTAKE_URL = "https://x.supabase.co/functions/v1/application-intake";
  process.env.LURDY_INTAKE_SECRET = "s".repeat(40);
  sent.length = 0;
  // the sick pilgrims' form (from the organisers' paper form "Přihláška Lurdy")
  const sick = { form: "nemocni", lang: "cs", stay: "stay_accueil", title: "Ing.", firstname: "Jan <b>", lastname: "Novák</b>", rc: "500101/1234",
    birth_d: "1", birth_m: "1", birth_y: "1950", gender: "male", address: "Praha", telefon: "777", email: "jan@example.com", idnum: "123",
    idvalid_d: "31", idvalid_m: "12", idvalid_y: "2030", health_issues: "fiktivní diagnóza", mobility: ["mob_cane", "mob_wheelchair"],
    hygiene_level: "lvl_help", wc: "yes", eating: "lvl_self", devices: "dev_gluco", medication: "fiktivní lék", allergy: "no",
    gp_last: "MUDr. Test", rel_first: "Eva", rel_last: "Nováková", rel_phone: "555", escort: "dcera", subsidy: "sub_ask", declaration: "yes", consent: "yes" };
  assert.equal((await call({ ...sick, subsidy: "" })).status, 400, "the subsidy question must be answered");
  assert.equal((await call({ ...sick, rc: "12345" })).status, 400, "rodné číslo has its shape");
  assert.equal((await call({ ...sick, medication: "x".repeat(501) })).status, 400, "the paper form's 500-character limit");
  assert.equal((await call({ ...sick, title: "x".repeat(41) })).status, 400, "title length");
  assert.equal((await call({ ...sick, mobility: "mob_flying" })).status, 400, "unknown mobility option");
  intakes.length = 0; sent.length = 0;
  assert.equal((await call(sick)).status, 303);
  assert.equal(intakes.length, 1);
  assert.equal(intakes[0].headers["x-intake-secret"], "s".repeat(40));
  assert.deepEqual(Object.keys(intakes[0].body).sort(), ["address", "birth", "companion", "email", "first", "form", "gender", "idnum", "lang", "last", "mobile", "name", "relmobile", "relname", "subsidy", "title"].sort(),
    "identity, gender, contact, emergency contact, ID number, subsidy: no health answers, no rodné číslo");
  assert.equal(intakes[0].body.name, "Jan <b> Novák</b>");
  assert.equal(intakes[0].body.relname, "Eva Nováková");
  assert.equal(intakes[0].body.mobile, "777");
  assert.equal(intakes[0].body.subsidy, true);
  assert.equal(intakes[0].body.title, "Ing.");
  assert.ok(!JSON.stringify(intakes[0].body).includes("500101") && !JSON.stringify(intakes[0].body).includes("fiktivní"), "nothing medical, no rodné číslo");
  assert.ok(sent[0].text.includes("Prosím o příspěvek") && sent[0].text.includes("vycházková hůl, vozík") && sent[0].text.includes("500101/1234"), "the organisers get everything");
  assert.equal(intakes[0].body.form, "malade");
  assert.equal(intakes[0].body.birth, "1950-01-01");
  assert.ok(sent[0].text.includes("uloženo ve správě pouti"), "the organisers see it was filed");
  assert.equal(sent.length, 3, "application, notice, receipt");
  const notice = sent.find((m) => m.subject.startsWith("Nová přihláška"));
  assert.deepEqual(notice.to, ["koordinator@example.test"], "the notice goes to the chosen addresses only (invalid ones dropped)");
  assert.equal(notice.subject, "Nová přihláška: Jan <b> Novák</b> (Přihláška – nemocní)");
  assert.ok(notice.html.includes("Jan &lt;b&gt; Novák&lt;/b&gt;") && notice.html.includes("https://lurdy.vercel.app/#/prihlasky"), "escaped, with the admin link");
  for (const word of ["fiktivní", "MUDr", "777", "Praha", "jan@example.com"]) assert.ok(!notice.html.includes(word) && !notice.text.includes(word), `the notice carries no ${word}`);
  intakeOk = false;
  sent.length = 0;
  assert.equal((await call(sick)).status, 303, "the platform being down does not fail the applicant");
  assert.ok(sent[0].text.includes("NEULOŽENO ve správě pouti"), "the organisers see it was not filed");
  delete process.env.LURDY_INTAKE_URL;
  // the Google Sheet: every answer with the option codes, behind its own secret; an outage never fails the applicant
  intakeOk = true;
  process.env.GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/x/exec";
  process.env.GOOGLE_SHEETS_SECRET = "g".repeat(40);
  sent.length = 0;
  assert.equal((await call(sick)).status, 303);
  const sheet = sheetPosts.at(-1);
  assert.equal(sheet.secret, "g".repeat(40));
  assert.equal(sheet.form, "nemocni");
  assert.equal(sheet.name, "Jan <b> Novák</b>");
  const mob = sheet.fields.find((x) => x.key === "mobility");
  assert.deepEqual(mob.codes, ["mob_cane", "mob_wheelchair"]);
  assert.equal(mob.value, "vycházková hůl, vozík");
  assert.equal(sheet.fields.find((x) => x.key === "subsidy").codes[0], "sub_ask");
  assert.equal(sheet.fields.find((x) => x.key === "rc").value, "500101/1234");
  assert.ok(sent[0].text.includes("zapsáno do Google tabulky"));
  assert.ok(sent[0].text.includes("zapsáno do registru (čekací listina)"), "the organisers see it is on the register's waiting list");
  assert.deepEqual(sheet.files, [], "no attachments, none sent");
  sent.length = 0;
  assert.equal((await multipart(sick, [["zpráva.pdf", Buffer.from("%PDF-1.4 test")]])).status, 303);
  assert.deepEqual(sheetPosts.at(-1).files, [{ name: "1-zprava.pdf", data: Buffer.from("%PDF-1.4 test").toString("base64") }], "attachments go to the Drive folder");
  assert.ok(sent[0].text.includes("přílohy uloženy na Google Disk"));
  sheetOk = false; sent.length = 0;
  assert.equal((await call(sick)).status, 303, "the sheet being down does not fail the applicant");
  assert.ok(sent[0].text.includes("NEZAPSÁNO do Google tabulky"));
  // no e-mail service: the sheet alone keeps it; nothing saved anywhere is an error for the applicant
  delete process.env.RESEND_API_KEY;
  sheetOk = true; sent.length = 0;
  assert.equal((await call(sick)).status, 303, "without Resend the sheet is enough");
  assert.equal(sent.length, 0, "no e-mail without Resend");
  sheetOk = false;
  assert.equal((await call(sick)).status, 502, "saved nowhere: the applicant is told");
  process.env.RESEND_API_KEY = "test";
  delete process.env.GOOGLE_SHEETS_URL;
  intakes.length = 0;
  sent.length = 0;
  // a form that opens on a set day is refused before it, open after it
  SITE.opensOn = { poutnici: "2999-01-01" };
  assert.equal((await call(good)).status, 403, "not open yet");
  SITE.opensOn = { poutnici: "2000-01-01" };
  assert.equal((await call(good)).status, 303, "open since that day");
  assert.ok(OPENS && OPENS.nemocni && OPENS.poutnici, "sick and pilgrim forms have an opening day");
  intakes.length = 0; sent.length = 0;
  SITE.registrationOpen = false;
  assert.equal((await call(good)).status, 403, "closed registration");
  assert.equal(sent.length + intakes.length, 0, "nothing sent for rejected submissions");
  console.log("api ok");
})().catch((e) => { console.error(e); process.exit(1); });
