// node api/test.js — exercises api/prihlaska.js with the email service stubbed. Exits non-zero on failure.
const assert = require("assert");
const SITE = require("../content/site.json");
SITE.registrationOpen = true; // the cached module object is the one the handler sees
const sent = [];
global.fetch = async (url, o) => { sent.push(JSON.parse(o.body)); return { ok: true, text: async () => "" }; };
process.env.RESEND_API_KEY = "test";
const handler = require("./prihlaska.js");

function call(body, headers = {}) {
  return new Promise((resolve) => {
    const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, headers: this.headers, body: b }); } };
    handler({ method: "POST", headers: { host: "www.lurdy.eu", ...headers }, body }, res);
  });
}

const good = { form: "poutnici", lang: "en", name: "Jan <b>Novák</b>", birth: "1950-01-01", email: "jan@example.com", address: "Praha", idnum: "123",
  idvalid: "2030-01-01", mobile: "777", relname: "Eva", relmobile: "666", diet: "yes", dietkind: ["diabetic", "nosalt"], declaration: "yes", consent: "yes" };

(async () => {
  let r = await call(good, { origin: "https://www.lurdy.eu" });
  assert.equal(r.status, 303); assert.equal(r.headers.Location, "/en/applications/sent/");
  assert.equal(sent.length, 2, "application + receipt");
  assert.ok(sent[0].html.includes("Jan &lt;b&gt;Novák&lt;/b&gt;"), "applicant input is escaped");
  assert.ok(sent[0].text.includes("diabetická, neslaná"), "options in Czech for the organisers");
  assert.ok(!sent[1].text.includes("1950"), "the receipt carries no application data");

  sent.length = 0;
  assert.equal((await call({ ...good, consent: "" })).status, 400, "consent is required");
  assert.equal((await call({ ...good, diet: "maybe" })).status, 400, "unknown option");
  assert.equal((await call({ ...good, name: "x".repeat(201) })).status, 400, "length limit");
  assert.equal((await call({ ...good, email: "nope" })).status, 400, "email format");
  assert.equal((await call(good, { origin: "https://evil.example" })).status, 403, "foreign origin");
  assert.equal((await call({ ...good, form: "tym" })).status, 403, "no online team form");
  assert.equal((await call({ ...good, web: "spam" })).status, 303, "honeypot pretends success");
  SITE.registrationOpen = false;
  assert.equal((await call(good)).status, 403, "closed registration");
  assert.equal(sent.length, 0, "nothing sent for rejected submissions");
  console.log("api ok");
})().catch((e) => { console.error(e); process.exit(1); });
