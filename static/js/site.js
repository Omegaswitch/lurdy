// lurdy.eu — progressive enhancement only; every page works without this file.
(function () {
  // ---- the menu bar stays at the top once the page scrolls past it (see .site-header.sticky in site.css)
  var header = document.querySelector(".site-header"), bar = header && header.querySelector(".mainnav");
  if (header && bar) {
    var pin = function () {
      var toggle = bar.querySelector(".menu-toggle");
      header.style.setProperty("--stick", bar.offsetTop + "px");
      document.documentElement.style.setProperty("--nav-h", ((toggle && toggle.offsetHeight) || bar.offsetHeight) + "px");
    };
    pin();
    header.classList.add("sticky");
    document.documentElement.classList.add("has-sticky");
    window.addEventListener("resize", pin);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(pin);
  }

  // ---- main menu (mobile) and submenus
  var toggle = document.querySelector(".menu-toggle");
  var menu = document.getElementById("menu");
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      menu.classList.toggle("open", open);
    });
  }
  document.querySelectorAll(".sub-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var li = btn.parentElement;
      var open = !li.classList.contains("open");
      li.classList.remove("closed");
      li.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".has-sub.open").forEach(function (li) {
      li.classList.remove("open");
      var b = li.querySelector(".sub-toggle");
      if (b) b.setAttribute("aria-expanded", "false");
    });
    var li = document.activeElement && document.activeElement.closest(".has-sub");
    if (li) {
      if (document.activeElement.closest(".sub")) {
        var top = li.querySelector("a");
        if (top) top.focus();
      }
      li.classList.add("closed");  // focus stays on the item, so :focus-within would keep the submenu open; .closed holds it shut until focus leaves
    }
  });
  document.addEventListener("focusout", function (e) {
    var li = e.target.closest && e.target.closest(".has-sub.closed");
    if (li && !li.contains(e.relatedTarget)) li.classList.remove("closed");
  });
  document.addEventListener("pointerover", function (e) {  // the mouse re-opens it as usual
    var li = e.target.closest && e.target.closest(".has-sub.closed");
    if (li) li.classList.remove("closed");
  });

  // ---- "?" hints: hover or focus shows them (CSS); a tap opens and closes one without touching the field it labels.
  // Each bubble is nudged to stay inside the screen.
  function placeTip(t) {
    var b = t.querySelector(".tip-text");
    if (!b) return;
    b.style.left = ""; b.style.setProperty("--arrow", "");
    var r = b.getBoundingClientRect(), pad = 12, dx = 0;
    if (r.right > innerWidth - pad) dx = innerWidth - pad - r.right;
    if (r.left + dx < pad) dx = pad - r.left;
    if (dx) { b.style.left = (-8 + dx) + "px"; b.style.setProperty("--arrow", (12 - dx) + "px"); }
  }
  ["mouseover", "focusin"].forEach(function (ev) {
    document.addEventListener(ev, function (e) { var t = e.target.closest && e.target.closest(".tip"); if (t) placeTip(t); });
  });
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest(".tip");
    document.querySelectorAll(".tip.open").forEach(function (x) { if (x !== t) x.classList.remove("open"); });
    if (!t) return;
    e.preventDefault();  // inside a label: do not jump into the box
    t.classList.toggle("open");
    placeTip(t);
  });
  document.addEventListener("keydown", function (e) {
    var t = document.activeElement;
    if (t && t.classList && t.classList.contains("tip") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); t.classList.toggle("open"); }
  });

  // ---- images still downloading develop out of the paper tone once they arrive (see .is-loading)
  document.querySelectorAll("img.ph-img").forEach(function (img) {
    if (img.complete || img.naturalWidth) return;  // already shown (or progressively painting): leave it alone
    img.classList.add("is-loading");
    var done = function () { img.classList.remove("is-loading"); };
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });

  // ---- Přihlášky: the steps one at a time (how it works → consent → choose), with the browser's Back going back a step
  var wz = document.querySelector(".wizard");
  if (wz) {
    var steps = Array.prototype.slice.call(wz.querySelectorAll(".wz-step")), names = JSON.parse(wz.getAttribute("data-names")), at = -1;
    var bar = document.createElement("ol");
    bar.className = "wz-progress";
    names.forEach(function (n, k) {
      var li = document.createElement("li"), b = document.createElement("button");
      b.type = "button"; b.innerHTML = '<span class="wz-num">' + (k + 1) + "</span> "; b.appendChild(document.createTextNode(n));
      b.addEventListener("click", function () { if (k < at) go(k, true); });
      li.appendChild(b); bar.appendChild(li);
    });
    wz.insertBefore(bar, wz.firstChild);
    steps.forEach(function (s, k) {
      var nav = document.createElement("div");
      nav.className = "wz-nav";
      if (k > 0) {
        var back = document.createElement("button");
        back.type = "button"; back.className = "btn btn--ghost"; back.textContent = wz.getAttribute("data-back");
        back.addEventListener("click", function () { history.state && history.state.wz === k ? history.back() : go(k - 1, true); });
        nav.appendChild(back);
      }
      if (k < steps.length - 1) {
        var next = document.createElement("button");
        next.type = "button"; next.className = "btn btn--big";
        next.textContent = wz.getAttribute(k === steps.length - 2 ? "data-agree" : "data-next");
        next.addEventListener("click", function () { go(k + 1, true); });
        nav.appendChild(next);
      }
      s.appendChild(nav);
    });
    wz.classList.add("wz-on");
    function go(k, push) {
      var forward = k > at;
      steps.forEach(function (s, j) { s.hidden = j !== k; s.classList.remove("wz-in-next", "wz-in-back"); });
      void steps[k].offsetWidth;  // restart the slide
      if (at >= 0) steps[k].classList.add(forward ? "wz-in-next" : "wz-in-back");
      Array.prototype.forEach.call(bar.children, function (li, j) {
        li.className = j < k ? "done" : j === k ? "current" : "";
        if (j === k) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
      });
      if (push && at >= 0) history.pushState({ wz: k }, "", "#krok-" + (k + 1));
      if (at >= 0) {
        if (wz.getBoundingClientRect().top < 0) wz.scrollIntoView({ behavior: "smooth", block: "start" });
        var h = steps[k].querySelector("h2, .lead");
        if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
      }
      at = k;
    }
    function fromHash() {  // a link to a step, else straight to the forms when this browser has saved applications
      var m = /^#krok-(\d)$/.exec(location.hash);
      return m ? Math.min(steps.length, Math.max(1, +m[1])) - 1 : cartGet().length ? steps.length - 1 : 0;
    }
    go(fromHash(), false);
    addEventListener("popstate", function (e) { go(e.state && e.state.wz != null ? e.state.wz : fromHash(), false); });
  }

  // ---- a form that opens on a set day (site.json opensOn) is shown from that day, Prague time
  document.querySelectorAll("[data-opens]").forEach(function (el) {
    if (Date.now() < new Date(el.getAttribute("data-opens") + "T00:00:00+01:00").getTime()) return;
    el.hidden = false;
    document.querySelectorAll('[data-closed-until="' + el.getAttribute("data-opens") + '"]').forEach(function (n) { n.remove(); });
    document.querySelectorAll('[data-off-until="' + el.getAttribute("data-opens") + '"]').forEach(function (n) {
      n.removeAttribute("data-off-until"); n.removeAttribute("aria-disabled"); n.removeAttribute("tabindex");
    });
  });

  // ---- application form: attachments are shrunk on this device (photos on a canvas, large PDFs with
  // Ghostscript in a worker), then sent with a progress bar. Without JavaScript the form posts as usual.
  var V = (document.currentScript && document.currentScript.src.split("?")[1]) || "";  // cache-busts the worker like this file
  // drafts older than 30 days are deleted on any page, not only when their form is opened again
  try {
    Object.keys(localStorage).forEach(function (k) {
      if (k.indexOf("draft:") !== 0) return;
      var d = null;
      try { d = JSON.parse(localStorage.getItem(k)); } catch (e) {}
      if (!d || Date.now() - d.t > 30 * 864e5) localStorage.removeItem(k);
    });
  } catch (e) {}
  var LIMIT = 4 * 1024 * 1024, MAX_FILES = 5, PDF_SHRINK_FROM = 1024 * 1024;
  var TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

  // The loader (a plain port of the AbstractCubeIsometricLoader component): a 5×5 dot cube whose dots light up in turn
  var CUBE = ["00100", "01110", "10101", "11011", "01110"];
  function dotLoader() {
    var el = document.createElement("span");
    el.className = "dot-loader has-bloom"; el.setAttribute("data-motion", "orbit"); el.setAttribute("aria-hidden", "true");
    CUBE.forEach(function (row, r) {
      row.split("").forEach(function (on, c) {
        var d = document.createElement("span");
        if (on === "1") d.className = "active";
        d.style.setProperty("--delay", ((r * 5 + c) * 0.04).toFixed(2) + "s");
        el.appendChild(d);
      });
    });
    return el;
  }

  function mb(n) { return (n / 1048576).toFixed(1).replace(".0", "") + " MB"; }

  function shrinkImage(file) {
    return createImageBitmap(file).then(function (bmp) {
      var s = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      var c = document.createElement("canvas");
      c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
      var g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);  // transparent PNGs would turn black as JPEG
      g.drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (ok) {
        c.toBlob(function (b) {
          ok(b && b.size < file.size ? new File([b], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file);
        }, "image/jpeg", 0.82);
      });
    }).catch(function () { return file; });
  }

  function shrinkPdf(file) {
    if (file.size < PDF_SHRINK_FROM || !window.Worker) return Promise.resolve(file);
    return file.arrayBuffer().then(function (buf) {
      return new Promise(function (ok) {
        var w = new Worker("/js/pdf-worker.js?" + V, { type: "module" });
        var done = function (out) { w.terminate(); ok(out && out.length && out.length < file.size ? new File([out], file.name, { type: "application/pdf" }) : file); };
        w.onmessage = function (e) { done(e.data); };
        w.onerror = function () { done(null); };
        w.postMessage(buf, [buf]);
      });
    });
  }

  // ---- "Uložené přihlášky": finished applications kept in this browser (attachments in IndexedDB), to edit and to send
  // several at once. Up to 30 days, like drafts.
  var CART = "cart", ACTION = "/api/prihlaska/";
  function cartGet() {
    try { return (JSON.parse(localStorage.getItem("cart")) || []).filter(function (x) { return Date.now() - x.t < 30 * 864e5; }); } catch (e) { return []; }
  }
  function cartPut(c) { try { c.length ? localStorage.setItem("cart", JSON.stringify(c)) : localStorage.removeItem("cart"); } catch (e) {} }
  function idb(mode, fn) {  // resolves with the request's result (or null when IndexedDB is not there)
    return new Promise(function (ok) {
      if (!window.indexedDB) return ok(null);
      var r;
      try { r = indexedDB.open("lurdy", 1); } catch (e) { return ok(null); }
      r.onupgradeneeded = function () { r.result.createObjectStore("files"); };
      r.onerror = function () { ok(null); };
      r.onsuccess = function () {
        var tx = r.result.transaction("files", mode), q = fn(tx.objectStore("files"));
        tx.oncomplete = function () { ok(q && q.result !== undefined ? q.result : null); };
        tx.onerror = tx.onabort = function () { ok(null); };
      };
    });
  }
  function fillIn(s, kw) { return s.replace(/\{(\w+)\}/g, function (m, k) { return k in kw ? kw[k] : m; }); }
  var cartBox = document.querySelector(".cart"), CU = cartBox ? JSON.parse(cartBox.getAttribute("data-ui")) : null;
  function cartBadge(n) {
    document.querySelectorAll(".nav-apply > a, .nav-cta").forEach(function (a) {
      var b = a.querySelector(".cart-count");
      if (!n) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement("span"); b.className = "cart-count"; a.appendChild(b); }
      b.textContent = n;
    });
  }
  // Minimal: a heading with the count and a "?" for the notes, one line per person (click to open, × to remove), one button.
  function cartRender(msg) {
    var c = cartGet();
    cartBadge(c.length);
    if (!cartBox) return;
    cartBox.hidden = !c.length;
    cartBox.innerHTML = "";
    if (!c.length) return;
    var ok = c.filter(function (x) { return x.done !== false; }).length;
    var h = document.createElement("h2"), tog = document.createElement("button"), tip = document.createElement("span");
    tog.type = "button"; tog.className = "cart-toggle"; tog.setAttribute("aria-expanded", String(cartBox.classList.contains("open")));
    tog.innerHTML = '<span></span><span class="cart-count"></span>';
    tog.firstChild.textContent = CU.cartTitle; tog.lastChild.textContent = c.length;
    tog.addEventListener("click", function () { var o = cartBox.classList.toggle("open"); tog.setAttribute("aria-expanded", String(o)); });
    // the notes behind a question mark (hover, focus or tap)
    tip.className = "cart-tip"; tip.tabIndex = 0; tip.setAttribute("role", "note"); tip.textContent = "?";
    var tipText = document.createElement("span"); tipText.className = "cart-tip-text";
    tipText.textContent = CU.cartNote + (ok < c.length ? " " + CU.cartUndone : "");
    tip.appendChild(tipText); tip.setAttribute("aria-label", tipText.textContent);
    h.appendChild(tog); h.appendChild(tip); cartBox.appendChild(h);
    if (msg) {
      var m = document.createElement("p"); m.className = "cart-msg"; m.textContent = msg; cartBox.appendChild(m);
      setTimeout(function () { m.classList.add("gone"); setTimeout(function () { m.remove(); }, 400); }, 3500);
    }
    var ul = document.createElement("ul");
    c.forEach(function (it) {
      var li = document.createElement("li"), row = document.createElement("a"), unfinished = it.done === false;
      row.className = "cart-row"; row.href = it.url + "?upravit=" + encodeURIComponent(it.id);
      row.title = (unfinished ? CU.cartFinish : CU.cartEdit) + ": " + it.name;
      if (unfinished) { var dot = document.createElement("span"); dot.className = "cart-dot"; dot.title = CU.cartUnfinished; row.appendChild(dot); }
      var who = document.createElement("span"), kind = document.createElement("span");
      who.className = "cart-name"; who.textContent = it.name;
      kind.className = "cart-kind"; kind.textContent = (it.title.split(/\s[–-]\s/).pop() || it.title) + (unfinished ? " · " + CU.cartUnfinished : "");
      row.appendChild(who); row.appendChild(kind);
      var rm = document.createElement("button");
      rm.type = "button"; rm.className = "cart-x"; rm.textContent = "×"; rm.setAttribute("aria-label", CU.cartRemove + ": " + it.name); rm.title = CU.cartRemove;
      rm.addEventListener("click", function () {
        cartPut(cartGet().filter(function (x) { return x.id !== it.id; }));
        idb("readwrite", function (st) { return st.delete(it.id); });
        cartRender();
      });
      li.appendChild(row); li.appendChild(rm); ul.appendChild(li);
    });
    cartBox.appendChild(ul);
    var send = document.createElement("button"), status = document.createElement("p");
    send.type = "button"; send.className = "btn cart-send"; send.textContent = fillIn(CU.cartSend, { n: ok }); send.hidden = !ok;
    status.className = "cart-status"; status.setAttribute("role", "status");
    send.addEventListener("click", function () { sendAll(send, status); });
    cartBox.appendChild(send); cartBox.appendChild(status);
  }
  // one after another; each sent one leaves the list, a failure stops and says which
  function sendAll(btn, status) {
    var c = cartGet().filter(function (x) { return x.done !== false; }), i = 0, last = null;  // finished ones only
    btn.disabled = true;
    (function next() {
      if (i >= c.length) { if (last) location.href = last; else cartRender(); return; }
      var it = c[i];
      status.textContent = "";
      var said = document.createElement("span"); said.textContent = fillIn(CU.cartSending, { i: i + 1, n: c.length });
      status.appendChild(dotLoader()); status.appendChild(said);
      idb("readonly", function (st) { return st.get(it.id); }).then(function (files) {
        files = files || [];
        if (it.shrunk) return files;  // shrunk when it was saved
        return files.reduce(function (p, file) {
          return p.then(function (out) { return (file.type === "application/pdf" ? shrinkPdf(file) : shrinkImage(file)).then(function (x) { return out.concat(x); }); });
        }, Promise.resolve([]));
      }).then(function (files) {
        var data = new FormData();
        data.append("form", it.form); data.append("lang", it.lang); data.append("declaration", "yes"); data.append("consent", "yes");
        Object.keys(it.f).forEach(function (k) { [].concat(it.f[k]).forEach(function (v) { data.append(k, v); }); });
        files.forEach(function (x) { data.append("files", x, x.name); });
        return fetch(ACTION, { method: "POST", body: data });
      }).then(function (r) {
        if (!r.ok || !r.redirected) throw new Error(r.status);
        last = r.url;
        cartPut(cartGet().filter(function (x) { return x.id !== it.id; }));
        idb("readwrite", function (st) { return st.delete(it.id); });
        i++; next();
      }).catch(function () {
        status.textContent = fillIn(CU.cartError, { name: it.name });
        btn.disabled = false;
        cartRender(); var s2 = cartBox.querySelector(".cart-status"); if (s2) s2.textContent = fillIn(CU.cartError, { name: it.name });
      });
    })();
  }
  cartRender();

  // a drop-down with "other" shows its write-in box only when "other" is chosen
  // "jiný": the drop-down itself turns into a text field in the same place; emptied, it turns back
  function syncOther(sel) {
    var box = document.getElementById(sel.getAttribute("data-other"));
    if (!box) return;
    var on = sel.value === "_other";
    box.hidden = !on; sel.hidden = on; box.required = on;
    if (!on) box.value = "";
  }
  document.querySelectorAll("select[data-other]").forEach(function (sel) {
    var box = document.getElementById(sel.getAttribute("data-other"));
    if (!box) return;
    box.setAttribute("aria-label", (document.querySelector('label[for="' + sel.id + '"]') || {}).textContent || box.getAttribute("aria-label"));
    syncOther(sel);
    sel.addEventListener("change", function () { syncOther(sel); if (sel.value === "_other") box.focus(); });
    var back = function () { sel.value = ""; syncOther(sel); sel.focus(); };
    box.addEventListener("blur", function () { if (!box.value.trim()) back(); });
    box.addEventListener("keydown", function (e) { if (e.key === "Escape") back(); });
  });

  document.querySelectorAll("form.apply").forEach(function (f) {
    var b = f.querySelector("button[type=submit]");
    var input = f.querySelector("input[type=file]");
    var list = f.querySelector(".file-list");
    var bar = f.querySelector(".progress"), meter = bar && bar.querySelector("progress"), label = bar && bar.querySelector("span");
    var err = f.querySelector(".form-error");
    function say(msg) { err.textContent = msg; err.hidden = !msg; }
    function progress(text, value) {
      if (!bar.querySelector(".dot-loader")) bar.insertBefore(dotLoader(), bar.firstChild);
      bar.hidden = false; label.textContent = text;
      if (value == null) meter.removeAttribute("value"); else meter.value = value;
    }
    function reset() { b.disabled = false; b.textContent = b.getAttribute("data-label") || b.textContent; bar.hidden = true; }

    // chosen files live here, so each can be removed and more can be added in several goes
    var chosen = [];
    // Each file starts shrinking the moment it is picked (one at a time: Ghostscript is memory-hungry on older phones),
    // so sending only has to upload. done: file → its shrunk version.
    var queue = Promise.resolve(), jobs = new Map(), done = new Map();
    function prep(file) {
      if (!jobs.has(file)) {
        jobs.set(file, queue = queue.then(function () {
          return TYPES.indexOf(file.type) < 0 ? file : (file.type === "application/pdf" ? shrinkPdf(file) : shrinkImage(file));
        }).catch(function () { return file; }).then(function (out) { done.set(file, out); render(); return out; }));
      }
      return jobs.get(file);
    }
    function ready(file) { done.set(file, file); jobs.set(file, Promise.resolve(file)); }  // already shrunk (a saved application)
    function check() {
      say("");
      if (chosen.length > MAX_FILES) say(f.getAttribute("data-count"));
      else if (chosen.some(function (x) { return TYPES.indexOf(x.type) < 0; })) say(f.getAttribute("data-type"));
    }
    function render() {
      list.innerHTML = "";
      chosen.forEach(function (file, i) {
        var li = document.createElement("li");
        var name = document.createElement("span"), out = done.get(file);
        name.textContent = file.name + " · " + (out ? (out.size < file.size ? mb(file.size) + " → " + mb(out.size) : mb(out.size)) : "");
        if (!out) {  // still shrinking: the loader and a word
          var w = document.createElement("em"); w.className = "shrinking"; w.appendChild(dotLoader());
          w.appendChild(document.createTextNode(" " + f.getAttribute("data-shrinking"))); name.appendChild(w);
        }
        var rm = document.createElement("button");
        rm.type = "button"; rm.className = "link-btn"; rm.textContent = f.getAttribute("data-remove");
        rm.setAttribute("aria-label", f.getAttribute("data-remove") + ": " + file.name);
        rm.addEventListener("click", function () { chosen.splice(i, 1); render(); check(); input.focus(); });
        li.appendChild(name); li.appendChild(rm); list.appendChild(li);
      });
    }
    if (input && list) input.addEventListener("change", function () {
      var picked = Array.prototype.slice.call(input.files);
      chosen = chosen.concat(picked);
      input.value = "";  // the list above is now the source of truth
      render(); check();
      picked.forEach(prep);
    });

    // the unfinished application is kept in this browser until it is sent (not attachments, not the consents)
    var KEY = "draft:" + f.getAttribute("data-draft"), DAYS30 = 30 * 864e5;
    var SKIP = { form: 1, lang: 1, web: 1, files: 1, declaration: 1, consent: 1 };
    var note = f.querySelector(".draft-note");
    function store(v) { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) {} }
    function collect() {
      var v = { t: Date.now(), f: {} };
      Array.prototype.forEach.call(f.elements, function (el) {
        if (!el.name || SKIP[el.name] || el.type === "file") return;
        if (el.type === "checkbox" || el.type === "radio") { if (el.checked) (v.f[el.name] = v.f[el.name] || []).push(el.value); }
        else if (el.value) v.f[el.name] = el.value;
      });
      return v;
    }
    function fillForm(vals) {
      Array.prototype.forEach.call(f.elements, function (el) {
        var x = vals[el.name];
        if (x == null || SKIP[el.name]) return;
        if (el.type === "checkbox" || el.type === "radio") el.checked = [].concat(x).indexOf(el.value) >= 0;
        else if (el.type !== "file") el.value = x;
      });
      f.querySelectorAll("select[data-other]").forEach(function (sel) {
        var keep = vals[sel.getAttribute("name") + "_other"];
        syncOther(sel);
        if (keep && sel.value === "_other") document.getElementById(sel.getAttribute("data-other")).value = keep;
      });
    }
    function save() {
      var v = collect();
      store(Object.keys(v.f).length ? v : null);
      if (note) note.hidden = !Object.keys(v.f).length;
    }
    (function restore() {
      var v = null;
      try { v = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
      if (!v || Date.now() - v.t > DAYS30) return store(null);
      fillForm(v.f);
      if (note) note.hidden = false;
    })();
    var timer;
    f.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(save, 400); });
    f.addEventListener("change", save);
    // Back from the thank-you page restores this page from memory, still filled in: empty it so it isn't sent twice
    addEventListener("pageshow", function () {
      var sent = null;
      try { sent = sessionStorage.getItem("sent:" + KEY); sessionStorage.removeItem("sent:" + KEY); } catch (e) {}
      if (sent) { f.reset(); chosen = []; render(); if (note) note.hidden = true; }
    });
    f.addEventListener("reset", function () { setTimeout(function () { f.querySelectorAll("select[data-other]").forEach(syncOther); if (E) clearErrors(); }); });
    var clear = f.querySelector("[data-clear]");
    if (clear) clear.addEventListener("click", function () {
      store(null); f.reset(); chosen = []; render(); say(""); note.hidden = true;
    });

    // Errors in words (GOV.UK): each under its label and hint, and a summary at the top linking to each field.
    // The browser's own bubbles stay for any form without the texts.
    var E = JSON.parse(f.getAttribute("data-errors") || "null");
    if (E) f.noValidate = true;
    function boxOf(el) { return el.closest(".field, .consent") || el.parentNode; }
    function nameOf(box, el) {
      if (box.classList.contains("consent")) {  // the consent sentence itself, shortened
        var t = box.textContent.replace(/\s*\*\s*$/, "").replace(/\s+/g, " ").trim();
        return t.length > 60 ? t.slice(0, 57).replace(/\s+\S*$/, "") + "…" : t;
      }
      var l = box.querySelector("label, legend");
      return ((l && l.textContent) || el.name).replace(/\s*\*\s*$/, "").trim();
    }
    function why(el) {
      var v = el.validity;
      if (v.valueMissing) return el.type === "checkbox" && el.closest(".consent") ? E.consent : el.type === "radio" || (el.tagName === "SELECT" && !el.closest(".date")) ? E.choose : E.required;
      if (v.typeMismatch && el.type === "email") return E.email;
      return E.format;
    }
    function clearErrors() {
      f.querySelectorAll(".field-error, .error-summary").forEach(function (n) { n.remove(); });
      f.querySelectorAll(".has-error").forEach(function (n) { n.classList.remove("has-error"); });
      f.querySelectorAll("[aria-invalid]").forEach(function (n) { n.removeAttribute("aria-invalid"); });
    }
    function validate() {
      if (!E) return f.reportValidity();
      clearErrors();
      var seen = [], list = [];
      Array.prototype.forEach.call(f.elements, function (el) {
        if (!el.willValidate || el.closest("dialog") || el.checkValidity()) return;
        var box = boxOf(el);
        if (seen.indexOf(box) >= 0) return;
        seen.push(box);
        var msg = why(el), p = document.createElement("p");
        p.className = "field-error"; p.id = (el.id || el.name) + "-err"; p.textContent = msg;
        box.classList.add("has-error"); el.setAttribute("aria-invalid", "true");
        var after = box.querySelector(":scope > .hint") || box.querySelector(":scope > label, :scope > legend");
        if (box.classList.contains("consent") || !after) box.appendChild(p); else after.insertAdjacentElement("afterend", p);
        list.push({ el: el, text: nameOf(box, el) + ": " + msg });
      });
      if (!list.length) return true;
      var sum = document.createElement("div"), h = document.createElement("h2"), ul = document.createElement("ul");
      sum.className = "error-summary"; sum.setAttribute("role", "alert"); sum.tabIndex = -1; h.textContent = E.summary;
      list.forEach(function (x) {
        var li = document.createElement("li"), a = document.createElement("a");
        a.href = "#" + (x.el.id || ""); a.textContent = x.text;
        a.addEventListener("click", function (e) { e.preventDefault(); boxOf(x.el).scrollIntoView({ block: "center" }); x.el.focus({ preventScroll: true }); });
        li.appendChild(a); ul.appendChild(li);
      });
      sum.appendChild(h); sum.appendChild(ul);
      f.insertBefore(sum, f.firstChild);
      sum.focus();
      return false;
    }
    if (E) {
      f.addEventListener("submit", function (e) { if (!validate()) { e.preventDefault(); e.stopImmediatePropagation(); } });
      // a corrected field loses its message as soon as it is right
      var recheck = function (e) {
        var box = e.target.closest && e.target.closest(".has-error");
        if (!box) return;
        var bad = Array.prototype.some.call(box.querySelectorAll("input, select, textarea"), function (x) { return x.willValidate && !x.checkValidity(); });
        if (bad) return;
        box.classList.remove("has-error");
        box.querySelectorAll(".field-error").forEach(function (n) { n.remove(); });
        box.querySelectorAll("[aria-invalid]").forEach(function (n) { n.removeAttribute("aria-invalid"); });
      };
      f.addEventListener("input", recheck); f.addEventListener("change", recheck);
    }

    // The question marked data-dialog (e.g. whether the pilgrim would like a subsidy) is asked in a window just
    // before sending, once the rest of the form is valid. Without JavaScript it stays an ordinary part of the form.
    var ask = f.querySelector("fieldset[data-dialog]"), dlg, asked = false, afterAsk = null;
    if (ask && window.HTMLDialogElement) {
      var radios = ask.querySelectorAll("input[type=radio]"), need = radios.length && radios[0].required;
      radios.forEach(function (r) { r.required = false; });  // a hidden required control would block the browser's own check
      dlg = document.createElement("dialog");
      dlg.className = "ask";
      dlg.setAttribute("aria-labelledby", "ask-title");
      ask.querySelector("legend").id = "ask-title";
      ask.parentNode.removeChild(ask);
      dlg.appendChild(ask);  // still inside the form: its answer is sent and kept in the draft like any other
      var why = document.createElement("p"), row = document.createElement("div"), go = document.createElement("button"), back = document.createElement("button");
      why.className = "form-error"; why.setAttribute("role", "alert"); why.hidden = true;
      row.className = "ask-buttons";
      go.type = "button"; go.className = "btn"; go.textContent = f.getAttribute("data-dlg-send");
      back.type = "button"; back.className = "btn btn--ghost"; back.textContent = f.getAttribute("data-dlg-back");
      row.appendChild(go); row.appendChild(back);
      dlg.appendChild(why); dlg.appendChild(row);
      f.appendChild(dlg);
      go.addEventListener("click", function () {
        if (need && !ask.querySelector("input:checked")) { why.textContent = f.getAttribute("data-dlg-choose"); why.hidden = false; return; }
        if (afterAsk) { var then = afterAsk; afterAsk = null; dlg.close(); return then(); }  // saving to the list, not sending
        asked = true; dlg.close();
        f.requestSubmit ? f.requestSubmit() : f.submit();
      });
      back.addEventListener("click", function () { afterAsk = null; dlg.close(); });
      f.addEventListener("submit", function (e) {
        if (asked) { asked = false; return; }  // answered just now: carry on sending
        e.preventDefault(); e.stopImmediatePropagation();
        why.hidden = true;
        dlg.showModal();
      });
    }

    // "Uložit a vyplnit další": the checked form goes to the list, the form empties for the next person
    var cartBtn = f.querySelector("[data-cart]"), editing = new URLSearchParams(location.search).get("upravit");
    var cartOk = (function () { try { localStorage.setItem("t", "1"); localStorage.removeItem("t"); return true; } catch (e) { return false; } })();
    if (cartBtn && cartOk && window.fetch && window.FormData) {
      cartBtn.hidden = false;
      var mine = editing && cartGet().filter(function (x) { return x.id === editing; })[0];
      if (mine) {  // editing a saved one: fill the form with it and its attachments
        f.reset(); fillForm(mine.f);
        idb("readonly", function (st) { return st.get(mine.id); }).then(function (files) { chosen = files || []; chosen.forEach(mine.shrunk ? ready : prep); render(); });
      } else editing = null;
      var toCart = function (finished) {
        finished = finished !== false;
        var v = collect(), id = editing || "a" + Date.now(), x = v.f;
        var item = { id: id, form: f.getAttribute("data-draft"), lang: f.elements.lang.value, url: location.pathname,
          title: (document.querySelector("h1") || {}).textContent || "", t: Date.now(), f: x,
          done: finished, name: (x.firstname ? x.firstname + " " + (x.lastname || "") : x.name || "").trim() || (CU ? CU.cartNoName : "–") };
        Promise.all(chosen.map(prep)).then(function (small) {
          item.shrunk = true;
          return idb("readwrite", function (st) { return st.put(small, id); });
        }).then(function () {
          var c = cartGet().filter(function (y) { return y.id !== id; });
          c.push(item); cartPut(c);
          store(null); f.reset(); chosen = []; render(); if (note) note.hidden = true;
          editing = null;
          if (location.search) history.replaceState(null, "", location.pathname);
          if (cartBox) {  // on phones the bar opens to show it went in, then folds back so the form is free again
            cartBox.classList.add("open");
            clearTimeout(cartBox._fold);
            cartBox._fold = setTimeout(function () { cartBox.classList.remove("open"); var t = cartBox.querySelector(".cart-toggle"); if (t) t.setAttribute("aria-expanded", "false"); }, 4000);
          }
          cartRender(CU && (finished ? CU.cartSaved : CU.cartDraftSaved));
          var top = document.querySelector(".page-head") || f;
          if (top.getBoundingClientRect().top < 0) top.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      };
      cartBtn.addEventListener("click", function () {
        if (!validate()) return;
        if (dlg) { afterAsk = toCart; dlg.querySelector(".form-error").hidden = true; dlg.showModal(); }
        else toCart();
      });
      // "Uložit rozpracovanou": as it is, without the checks; it waits in the list marked unfinished
      var draftBtn = f.querySelector("[data-cart-draft]");
      if (draftBtn) {
        draftBtn.hidden = false;
        draftBtn.addEventListener("click", function () { if (E) clearErrors(); toCart(false); });
      }
    }

    f.addEventListener("submit", function (e) {
      if (b) { b.setAttribute("data-label", b.textContent); b.disabled = true; b.textContent = b.getAttribute("data-sending"); }
      if (!input || !window.FormData || !window.XMLHttpRequest) return;  // plain post
      e.preventDefault();
      say("");
      var files = chosen.slice();
      if (files.length > MAX_FILES) { say(f.getAttribute("data-count")); return reset(); }
      if (files.some(function (x) { return TYPES.indexOf(x.type) < 0; })) { say(f.getAttribute("data-type")); return reset(); }
      if (files.some(function (x) { return !done.has(x); })) progress(f.getAttribute("data-preparing"), null);
      Promise.all(files.map(prep)).then(function (ready) {
        if (ready.reduce(function (n, x) { return n + x.size; }, 0) > LIMIT) { say(f.getAttribute("data-too-big")); return reset(); }
        var data = new FormData(f);
        data.delete("files");
        ready.forEach(function (x) { data.append("files", x, x.name); });
        var x = new XMLHttpRequest();
        x.open("POST", f.action);
        x.upload.onprogress = function (ev) {
          if (ev.lengthComputable) { var p = Math.round(ev.loaded / ev.total * 100); progress(f.getAttribute("data-uploading").replace("{p}", p), p); }
        };
        x.onload = function () {
          if (x.status < 400 && x.responseURL) {
            store(null);
            if (editing) { cartPut(cartGet().filter(function (x) { return x.id !== editing; })); idb("readwrite", function (st) { return st.delete(editing); }); }
            try { sessionStorage.setItem("sent:" + KEY, "1"); } catch (e) {}
            location.href = x.responseURL;
            return;
          }  // the server redirects to the thank-you page
          document.open(); document.write(x.responseText); document.close();  // the server's own error page
        };
        x.onerror = function () { say(f.getAttribute("data-error")); reset(); };
        x.send(data);
      }).catch(function () { say(f.getAttribute("data-error")); reset(); });
    });
  });
  addEventListener("pageshow", function () {  // coming back from the thank-you page restores this page from cache, button and all
    document.querySelectorAll("form.apply button[disabled]").forEach(function (b) { b.disabled = false; b.textContent = b.getAttribute("data-label"); });
  });
})();

// A button whose icon or label changes (password eye, "Odesílám…", "Uloženo", an open/closed toggle…) blurs softly into its new
// state. Content-only when the button holds just elements (icon, spans), so its background stays crisp; off for reduced motion.
(function () {
  if (!window.MutationObserver || !Element.prototype.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var last = new WeakMap();
  var html = function (nodes) { return [].map.call(nodes, function (n) { return n.outerHTML || n.textContent; }).join(""); };
  new MutationObserver(function (list) {
    var seen = new Set(), now = performance.now();
    list.forEach(function (m) {
      var node = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      var b = node && node.closest("button, .btn, [role=button]");
      if (!b || seen.has(b) || now - (last.get(b) || -1e4) < 250) return;
      if (m.type === "attributes" ? m.oldValue === m.target.getAttribute(m.attributeName)
        : m.type === "characterData" ? m.oldValue === m.target.data : html(m.removedNodes) === html(m.addedNodes)) return;  // rewritten, not changed
      seen.add(b); last.set(b, now);
      var bare = [].some.call(b.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); });
      (bare ? [b] : [].slice.call(b.children)).forEach(function (t) {
        t.animate(bare ? [{ filter: "blur(1.5px)", opacity: 0.55 }, { filter: "blur(0)", opacity: 1 }]
                       : [{ filter: "blur(3px)", opacity: 0.2 }, { filter: "blur(0)", opacity: 1 }],
                  { duration: 260, easing: "cubic-bezier(.2,.7,.2,1)" });
      });
    });
  }).observe(document.body, { subtree: true, childList: true, characterData: true, characterDataOldValue: true,
      attributes: true, attributeOldValue: true, attributeFilter: ["aria-pressed", "aria-expanded", "aria-checked", "data-state"] });
})();
