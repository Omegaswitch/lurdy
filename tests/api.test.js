// node tests/api.test.js — exercises api/prihlaska.js with the email service stubbed. Exits non-zero on failure.
const assert = require("assert");
const SITE = require("../content/site.json");
SITE.registrationOpen = true; // the cached module object is the one the handler sees
const sent = [];
const intakes = [];
let intakeOk = true;
global.fetch = async (url, o) => {
  if (url.includes("intake")) { intakes.push({ headers: o.headers, body: JSON.parse(o.body) }); return { ok: intakeOk, status: intakeOk ? 201 : 500, text: async () => "" }; }
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

const good = { form: "poutnici", lang: "en", name: "Jan <b>Novák</b>", birth_d: "1", birth_m: "1", birth_y: "1950", email: "jan@example.com", address: "Praha", idnum: "123",
  idvalid_d: "31", idvalid_m: "12", idvalid_y: "2030", mobile: "777", relname: "Eva", relmobile: "666", diet: "yes", dietkind: ["diabetic", "nosalt"], declaration: "yes", consent: "yes" };

(async () => {
  let r = await call(good, { origin: "https://www.lurdy.eu" });
  assert.equal(r.status, 303); assert.equal(r.headers.Location, "/en/applications/sent/");
  assert.equal(sent.length, 2, "application + receipt");
  assert.ok(sent[0].html.includes("Jan &lt;b&gt;Novák&lt;/b&gt;"), "applicant input is escaped");
  assert.ok(sent[0].text.includes("diabetická, neslaná"), "options in Czech for the organisers");
  assert.ok(sent[0].text.includes("1. 1. 1950"), "date assembled");
  assert.ok(!sent[1].text.includes("1950"), "the receipt carries no application data");

  sent.length = 0;
  assert.equal((await call({ ...good, consent: "" })).status, 400, "consent is required");
  assert.equal((await call({ ...good, diet: "maybe" })).status, 400, "unknown option");
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
  assert.deepEqual(sent[0].attachments.map((a) => a.filename), ["1-zprava_lekare.pdf", "2-foto.jpg"]);
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
  const sick = { ...good, form: "nemocni", diagnoses: "fiktivní diagnóza", meds: "fiktivní lék", hygiene: "self", allergy: "no", doctor: "MUDr. Test", relphone: "555" };
  assert.equal((await call(sick)).status, 303);
  assert.equal(intakes.length, 1);
  assert.equal(intakes[0].headers["x-intake-secret"], "s".repeat(40));
  assert.deepEqual(Object.keys(intakes[0].body).sort(), ["address", "birth", "email", "form", "lang", "mobile", "name", "relmobile", "relname", "relphone"].sort(),
    "only identity, contact and emergency contact: no health answers, no ID number");
  assert.equal(intakes[0].body.form, "malade");
  assert.equal(intakes[0].body.birth, "1950-01-01");
  assert.ok(sent[0].text.includes("uloženo ve správě pouti"), "the organisers see it was filed");
  intakeOk = false;
  sent.length = 0;
  assert.equal((await call(sick)).status, 303, "the platform being down does not fail the applicant");
  assert.ok(sent[0].text.includes("NEULOŽENO ve správě pouti"), "the organisers see it was not filed");
  delete process.env.LURDY_INTAKE_URL;
  intakes.length = 0;
  sent.length = 0;
  SITE.registrationOpen = false;
  assert.equal((await call(good)).status, 403, "closed registration");
  assert.equal(sent.length + intakes.length, 0, "nothing sent for rejected submissions");
  console.log("api ok");
})().catch((e) => { console.error(e); process.exit(1); });
