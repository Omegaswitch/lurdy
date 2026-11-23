/**
 * Lurdy – přihlášky z webu do Google tabulky.
 *
 * The website (api/prihlaska.js) POSTs every application here. This script:
 *   1. appends one row to the tab named after the form ("Přihláška – nemocní", "Přihláška – poutníci", …),
 *      with a header row made from the question labels the first time;
 *   2. for the sick pilgrims' form, copies the "Formulář" tab (the organisers' paper form) to a new tab named
 *      after the pilgrim and fills its answer cells, so it reads and prints like the paper form;
 *   3. makes a Google Drive folder for the applicant ("Lurdy – přílohy přihlášek" / the form / the person, next to
 *      this spreadsheet) and saves the attachments there; the row and the form tab link to it. Every applicant gets one, so a medical
 *      report that comes later by post or e-mail has its place too;
 *   4. adds the applicant to the registration list (Script Property REGISTER_ID: the "Lourdes 2027" spreadsheet's
 *      ID, tab "Participants") ON THE WAITING LIST, so its mail script sends them nothing but the waiting-list
 *      letter until an organiser unticks "Waiting". Columns are found by their header (row 8), not by position.
 *
 * Setup: tools/google-sheets/README.md. The shared secret lives in Project Settings → Script Properties → SECRET.
 */

// The paper form's answer cells (tab "Formulář"), by the website's field key
var CELLS = {
  firstname: 'D16', lastname: 'D17', birth: 'D18', rc: 'D19', address: 'D20', telefon: 'D21', email: 'D22',
  idnum: 'D23', idvalid: 'D24', times: 'D25',
  limit_body: 'C27', limit_senses: 'C28', health_issues: 'C29', speech: 'E30', weight: 'E32', height: 'E33',
  own_wheelchair: 'E42', own_walker: 'E43', hygiene_level: 'D44', wc: 'E45', hygaids: 'D46', hygaids_other: 'D47',
  eating: 'D48', diettype: 'D49', diet_other: 'D50', mixed: 'E51', nutrition: 'D52', devices_other: 'D63',
  inject_drug: 'D65', stoma_type: 'D71', procedures_other: 'D72', medication: 'C73', allergy: 'E74', allergykind: 'D75',
  gp_first: 'D77', gp_last: 'D78', gp_address: 'D79', gp_phone: 'D80', gp_email: 'D81',
  rel_first: 'D84', rel_last: 'D85', rel_address: 'D86', rel_phone: 'D87', rel_email: 'D88', escort: 'D89'
};
// tick boxes on the website → one ano/ne cell each on the paper form
var TICKS = {
  mob_free: 'E34', mob_poles: 'E35', mob_cane: 'E36', mob_crutches: 'E37', mob_walker: 'E38', mob_wheelchair: 'E39',
  mob_lying: 'E40', mob_turning: 'E41',
  dev_pacemaker: 'E53', dev_icd: 'E54', dev_pump: 'E55', dev_pen: 'E56', dev_gluco: 'E57', dev_apnea: 'E58',
  dev_oxygen: 'E59', dev_vent: 'E60', dev_cough: 'E61', dev_suction: 'E62',
  proc_inject: 'E64', proc_wounds: 'E66', proc_catheter: 'E67', proc_picc: 'E68', proc_port: 'E69', proc_stoma: 'E70'
};
var TICK_FIELDS = ['mobility', 'devices', 'procedures'];
// options written exactly as the paper form's drop-down lists (tab "Ciselniky") have them
var LIST_TEXT = {
  yes: 'ano', no: 'ne',
  lvl_self: 'samostatně', lvl_help: 's pomocí druhé osoby', lvl_none: 'zcela nesoběstačný', lvl_tube: 'PEG, NG sonda',
  aid_pads: 'vložky, pleny', aid_pants: 'plenkové kalhotky', aid_bedpad: 'podložka do lůžka', aid_urinal: 'močová láhev',
  aid_bedpan: 'podložní mísa', aid_catheter: 'močový katetr', aid_bag: 'sběrný saček na moč',
  diet_basic: 'základní', diet_diabetic: 'diabetická', diet_gentle: 'šetřící (žlučník, žaludek)', diet_gluten: 'bezlepková'
};
var TEMPLATE = 'Formulář';
var FILES_FOLDER = 'Lurdy – přílohy přihlášek';
var REGISTER_TAB = 'Participants', REGISTER_HEADER_ROW = 8;
var TYPES = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

function doPost(e) {
  var data;
  try { data = JSON.parse(e.postData.contents); } catch (err) { return reply({ ok: false, error: 'invalid' }); }
  var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!secret || secret.length < 32 || data.secret !== secret) return reply({ ok: false, error: 'secret' });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);  // two applications at once must not write into the same row
  try {
    var book = SpreadsheetApp.getActiveSpreadsheet();
    var files = saveFiles(book, data);  // the answers are written even when Drive or the register fails;
    var register = addToRegister(data);  // the website tells the organisers which part did not
    appendRow(book, data, files.url);
    if (data.form === 'nemocni' && book.getSheetByName(TEMPLATE)) fillPaperForm(book, data, files.url);
    return reply({ ok: true, files: files.saved, register: register });
  } finally {
    lock.releaseLock();
  }
}

function reply(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// a value that starts like a formula is written as text, so an answer can never run as a formula
function safe(v) {
  v = v == null ? '' : String(v);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

// the applicant's folder: FILES_FOLDER / <form> / "<name> – <sent>". FILES_FOLDER is the Script Property FOLDER_ID,
// or made next to this spreadsheet the first time and remembered; the form's folder is made when its first application comes
function child(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function saveFiles(book, data) {
  try {
    var props = PropertiesService.getScriptProperties(), id = props.getProperty('FOLDER_ID'), root = null;
    if (id) try { root = DriveApp.getFolderById(id); } catch (err) { root = null; }
    if (!root) {
      var parents = DriveApp.getFileById(book.getId()).getParents();
      root = (parents.hasNext() ? parents.next() : DriveApp.getRootFolder()).createFolder(FILES_FOLDER);
      props.setProperty('FOLDER_ID', root.getId());
    }
    var t = data.fields.filter(function (f) { return f.key === 'title'; })[0];
    var label = [[t && t.value, data.name].filter(Boolean).join(' '), data.submitted].filter(Boolean).join(' – ').replace(/[\/\\]/g, ' ').slice(0, 200);
    var folder = child(root, String(data.title || data.form).replace(/[\/\\]/g, ' ')).createFolder(label);
    (data.files || []).forEach(function (f) {
      var ext = String(f.name).split('.').pop().toLowerCase();
      if (!TYPES[ext]) return;
      folder.createFile(Utilities.newBlob(Utilities.base64Decode(f.data), TYPES[ext], f.name));
    });
    return { url: folder.getUrl(), saved: true };
  } catch (err) {
    console.error(err);
    return { url: '', saved: false };
  }
}

// The registration list ("Lourdes 2027" → Participants): one new row, waiting list ticked. Returns null when not
// set up (no REGISTER_ID), true when added or already there, false when it failed.
function addToRegister(data) {
  var id = PropertiesService.getScriptProperties().getProperty('REGISTER_ID');
  if (!id) return null;
  try {
    var sheet = SpreadsheetApp.openById(id).getSheetByName(REGISTER_TAB);
    var last = sheet.getLastRow(), width = sheet.getLastColumn();
    var header = sheet.getRange(REGISTER_HEADER_ROW, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim(); });
    var col = function (name) { var i = header.indexOf(name); if (i < 0) throw new Error('column "' + name + '" not found in row ' + REGISTER_HEADER_ROW); return i; };
    var by = {};
    data.fields.forEach(function (f) { by[f.key] = f; });
    var v = function (k) { return by[k] ? String(by[k].value || '').trim() : ''; };
    var code = function (k) { return by[k] && by[k].codes ? by[k].codes[0] : ''; };
    // first name and surname: asked separately on the sick pilgrims' form, else split at the last space
    var first = v('firstname'), surname = v('lastname');
    if (!surname) { var parts = v('name').split(/\s+/); surname = parts.pop() || ''; first = parts.join(' ') || surname; }
    if (v('title')) first = v('title') + ' ' + first;
    var email = v('email').toLowerCase();
    var rows = last > REGISTER_HEADER_ROW ? sheet.getRange(REGISTER_HEADER_ROW + 1, 1, last - REGISTER_HEADER_ROW, width).getValues() : [];
    // sent twice (or already entered by hand): not added again
    var nameCol = col('Name'), mailCol = col('E-Mail'), cancelCol = col('Cancel');
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][cancelCol] === true) continue;
      if (String(rows[i][nameCol + 1]).trim().toLowerCase() === surname.toLowerCase() && String(rows[i][mailCol]).trim().toLowerCase() === email) return true;
    }
    // the first row with no name (the VarSym in it is already numbered by the sheet)
    var at = -1;
    for (i = 0; i < rows.length; i++) if (rows[i][nameCol] === '' && rows[i][nameCol + 1] === '') { at = i; break; }
    if (at < 0) throw new Error('no empty row left in ' + REGISTER_TAB);
    var row = REGISTER_HEADER_ROW + 1 + at;
    var birth = v('birth').match(/(\d{4})$/), times = v('times').match(/^\s*(\d{1,2})\s*$/);
    var put = function (name, value) { if (value !== '' && value != null) sheet.getRange(row, col(name) + 1).setValue(typeof value === 'string' ? safe(value) : value); };
    put('Name', first);
    sheet.getRange(row, nameCol + 2).setValue(safe(surname));
    put('Type', { nemocni: 'M', poutnici: 'P', tym: 'T' }[data.form] || '');
    put('Waiting', true);
    put('Stays', data.form === 'nemocni' ? (code('stay') === 'stay_hotel' ? 'H' : 'A') : 'H');
    put('E-Mail', email);
    put('Address', v('address'));
    put('Telephone', v('telefon') || v('mobile') || v('phone'));
    put('Travels together', v('escort') || v('companion'));
    put('Passport number', v('idnum'));
    put('M / F', { male: 'M', female: 'F' }[code('gender')] || '');
    put('Y', birth ? Number(birth[1]) : '');
    put('Previous', times ? Number(times[1]) : '');
    put('Registration', new Date());
    var note = 'Přihláška z webu ' + data.submitted + (code('subsidy') === 'sub_ask' ? '\nŽádá o příspěvek na pouť' : '');
    sheet.getRange(row, nameCol + 1).setNote(note);
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

function appendRow(book, data, folderUrl) {
  var name = String(data.title || data.form).slice(0, 90);
  var sheet = book.getSheetByName(name) || book.insertSheet(name);
  var labels = ['Odesláno', 'Jazyk', 'Složka s přílohami'].concat(data.fields.map(function (f) { return (f.group ? f.group + ' – ' : '') + f.label; }));
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(labels);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, labels.length).setFontWeight('bold');
  }
  // columns follow the header row, so a question added to the website later lands in a new column, not a wrong one
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = new Array(header.length).fill('');
  row[0] = data.submitted; row[1] = data.lang; row[2] = folderUrl || '';
  labels.slice(3).forEach(function (label, i) {
    var col = header.indexOf(label);
    if (col < 0) { header.push(label); sheet.getRange(1, header.length).setValue(label).setFontWeight('bold'); col = header.length - 1; row.push(''); }
    row[col] = safe(data.fields[i].value);
  });
  sheet.appendRow(row);
}

function fillPaperForm(book, data, folderUrl) {
  var by = {};
  data.fields.forEach(function (f) { by[f.key] = f; });
  var title = [by.title && by.title.value, by.lastname && by.lastname.value, by.firstname && by.firstname.value].filter(Boolean).join(' ');
  var name = (title || 'Přihláška') + ' ' + data.submitted.replace(/[^\d. :]/g, '');
  name = name.replace(/[\[\]*?:\/\\]/g, ' ').slice(0, 90);
  for (var n = 2, base = name; book.getSheetByName(name); n++) name = base + ' (' + n + ')';
  var sheet = book.getSheetByName(TEMPLATE).copyTo(book).setName(name);
  var accueil = by.stay && by.stay.codes && by.stay.codes[0] === 'stay_accueil';
  sheet.getRange('B1').setValue('Lurdy přihláška - nemocný poutník ubytovaný ' + (accueil ? 'v Accueil' : 'v hotelu'));
  Object.keys(CELLS).forEach(function (key) {
    var f = by[key];
    if (!f) return;
    var v = f.codes ? f.codes.map(function (c) { return LIST_TEXT[c] || c; }).join(', ') : f.value;
    if (key === 'firstname' && by.title && by.title.value) v = by.title.value + ' ' + v;  // the paper form has no title cell
    sheet.getRange(CELLS[key]).setValue(safe(v));
  });
  TICK_FIELDS.forEach(function (key) {
    var chosen = (by[key] && by[key].codes) || [];
    Object.keys(TICKS).forEach(function (code) {
      if (code.indexOf({ mobility: 'mob_', devices: 'dev_', procedures: 'proc_' }[key]) === 0)
        sheet.getRange(TICKS[code]).setValue(chosen.indexOf(code) >= 0 ? 'ano' : 'ne');
    });
  });
  // what the paper form has no cell for: the stay, the subsidy answer
  var subsidy = by.subsidy ? by.subsidy.value : '';
  sheet.getRange('B91').setValue('Ubytování: ' + (by.stay ? by.stay.value : '') + ' · Úhrada: ' + subsidy + ' · Odesláno z webu ' + data.submitted);
  if (folderUrl) sheet.getRange('B92').setValue('Přílohy: ' + folderUrl);
}

// Run once by hand from the editor (Run → testSetup) to check the template is found and the secret is set.
function testSetup() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('Template "%s": %s', TEMPLATE, book.getSheetByName(TEMPLATE) ? 'found' : 'MISSING');
  var s = PropertiesService.getScriptProperties().getProperty('SECRET');
  Logger.log('SECRET: %s', s && s.length >= 32 ? 'set' : 'missing or shorter than 32 characters');
  var parents = DriveApp.getFileById(book.getId()).getParents();  // also asks for the Drive permission
  Logger.log('Attachment folders will go in: %s / %s', parents.hasNext() ? parents.next().getName() : 'My Drive', FILES_FOLDER);
  var id = PropertiesService.getScriptProperties().getProperty('REGISTER_ID');
  if (!id) return Logger.log('Register: not connected (Script Property REGISTER_ID missing)');
  var reg = SpreadsheetApp.openById(id), tab = reg.getSheetByName(REGISTER_TAB);
  if (!tab) return Logger.log('Register "%s": tab "%s" MISSING', reg.getName(), REGISTER_TAB);
  var header = tab.getRange(REGISTER_HEADER_ROW, 1, 1, tab.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var missing = ['Name', 'Type', 'Waiting', 'Cancel', 'Stays', 'E-Mail', 'Address', 'Telephone', 'Travels together', 'Passport number', 'M / F', 'Y', 'Previous', 'Registration']
    .filter(function (n) { return header.indexOf(n) < 0; });
  Logger.log('Register "%s": %s', reg.getName(), missing.length ? 'columns MISSING: ' + missing.join(', ') : 'all columns found');
}
