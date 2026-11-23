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
  function cartRender(msg) {
    var c = cartGet();
    cartBadge(c.length);
    if (!cartBox) return;
    cartBox.hidden = !c.length && !msg;
    cartBox.innerHTML = "";
    if (msg) { var m = document.createElement("p"); m.className = "cart-msg"; m.textContent = msg; cartBox.appendChild(m); }
    if (!c.length) return;
    var h = document.createElement("h2"); h.className = "display-s"; h.textContent = CU.cartTitle; cartBox.appendChild(h);
    var ul = document.createElement("ul");
    c.forEach(function (it) {
      var li = document.createElement("li"), who = document.createElement("b"), what = document.createElement("span");
      who.textContent = it.name; what.textContent = it.title;
      var edit = document.createElement("a"); edit.href = it.url + "?upravit=" + encodeURIComponent(it.id); edit.textContent = CU.cartEdit;
      var rm = document.createElement("button"); rm.type = "button"; rm.className = "link-btn"; rm.textContent = CU.cartRemove;
      rm.addEventListener("click", function () {
        cartPut(cartGet().filter(function (x) { return x.id !== it.id; }));
        idb("readwrite", function (st) { return st.delete(it.id); });
        cartRender();
      });
      var who2 = document.createElement("div"); who2.appendChild(who); who2.appendChild(what);
      var acts = document.createElement("div"); acts.className = "cart-acts"; acts.appendChild(edit); acts.appendChild(rm);
      li.appendChild(who2); li.appendChild(acts); ul.appendChild(li);
    });
    cartBox.appendChild(ul);
    var send = document.createElement("button"); send.type = "button"; send.className = "btn btn--big"; send.textContent = fillIn(CU.cartSend, { n: c.length });
    var status = document.createElement("p"); status.className = "cart-status"; status.setAttribute("role", "status");
    var note = document.createElement("p"); note.className = "small"; note.textContent = CU.cartNote;
    send.addEventListener("click", function () { sendAll(send, status); });
    cartBox.appendChild(send); cartBox.appendChild(status); cartBox.appendChild(note);
  }
  // one after another; each sent one leaves the list, a failure stops and says which
  function sendAll(btn, status) {
    var c = cartGet(), i = 0, last = null;
    btn.disabled = true;
    (function next() {
      if (i >= c.length) { if (last) location.href = last; else cartRender(); return; }
      var it = c[i];
      status.textContent = fillIn(CU.cartSending, { i: i + 1, n: c.length });
      idb("readonly", function (st) { return st.get(it.id); }).then(function (files) {
        files = files || [];
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
  function syncOther(sel) {
    var box = document.getElementById(sel.getAttribute("data-other"));
    if (!box) return;
    var on = sel.value === "_other";
    box.hidden = !on; box.required = on;
    if (!on) box.value = "";
  }
  document.querySelectorAll("select[data-other]").forEach(function (sel) {
    syncOther(sel);
    sel.addEventListener("change", function () { syncOther(sel); if (sel.value === "_other") document.getElementById(sel.getAttribute("data-other")).focus(); });
  });

  document.querySelectorAll("form.apply").forEach(function (f) {
    var b = f.querySelector("button[type=submit]");
    var input = f.querySelector("input[type=file]");
    var list = f.querySelector(".file-list");
    var bar = f.querySelector(".progress"), meter = bar && bar.querySelector("progress"), label = bar && bar.querySelector("span");
    var err = f.querySelector(".form-error");
    function say(msg) { err.textContent = msg; err.hidden = !msg; }
    function progress(text, value) {
      bar.hidden = false; label.textContent = text;
      if (value == null) meter.removeAttribute("value"); else meter.value = value;
    }
    function reset() { b.disabled = false; b.textContent = b.getAttribute("data-label") || b.textContent; bar.hidden = true; }

    // chosen files live here, so each can be removed and more can be added in several goes
    var chosen = [];
    function check() {
      say("");
      if (chosen.length > MAX_FILES) say(f.getAttribute("data-count"));
      else if (chosen.some(function (x) { return TYPES.indexOf(x.type) < 0; })) say(f.getAttribute("data-type"));
    }
    function render() {
      list.innerHTML = "";
      chosen.forEach(function (file, i) {
        var li = document.createElement("li");
        var name = document.createElement("span");
        name.textContent = file.name + " · " + mb(file.size);
        var rm = document.createElement("button");
        rm.type = "button"; rm.className = "link-btn"; rm.textContent = f.getAttribute("data-remove");
        rm.setAttribute("aria-label", f.getAttribute("data-remove") + ": " + file.name);
        rm.addEventListener("click", function () { chosen.splice(i, 1); render(); check(); input.focus(); });
        li.appendChild(name); li.appendChild(rm); list.appendChild(li);
      });
    }
    if (input && list) input.addEventListener("change", function () {
      chosen = chosen.concat(Array.prototype.slice.call(input.files));
      input.value = "";  // the list above is now the source of truth
      render(); check();
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
    f.addEventListener("reset", function () { setTimeout(function () { f.querySelectorAll("select[data-other]").forEach(syncOther); }); });
    var clear = f.querySelector("[data-clear]");
    if (clear) clear.addEventListener("click", function () {
      store(null); f.reset(); chosen = []; render(); say(""); note.hidden = true;
    });

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
        idb("readonly", function (st) { return st.get(mine.id); }).then(function (files) { chosen = files || []; render(); });
      } else editing = null;
      var toCart = function () {
        var v = collect(), id = editing || "a" + Date.now(), x = v.f;
        var item = { id: id, form: f.getAttribute("data-draft"), lang: f.elements.lang.value, url: location.pathname,
          title: (document.querySelector("h1") || {}).textContent || "", t: Date.now(), f: x,
          name: (x.firstname ? x.firstname + " " + (x.lastname || "") : x.name || "").trim() || "–" };
        idb("readwrite", function (st) { return st.put(chosen.slice(), id); }).then(function () {
          var c = cartGet().filter(function (y) { return y.id !== id; });
          c.push(item); cartPut(c);
          store(null); f.reset(); chosen = []; render(); if (note) note.hidden = true;
          editing = null;
          if (location.search) history.replaceState(null, "", location.pathname);
          cartRender(CU && CU.cartSaved);
          (cartBox || f).scrollIntoView({ behavior: "smooth", block: "start" });
        });
      };
      cartBtn.addEventListener("click", function () {
        if (!f.reportValidity()) return;
        if (dlg) { afterAsk = toCart; dlg.querySelector(".form-error").hidden = true; dlg.showModal(); }
        else toCart();
      });
    }

    f.addEventListener("submit", function (e) {
      if (b) { b.setAttribute("data-label", b.textContent); b.disabled = true; b.textContent = b.getAttribute("data-sending"); }
      if (!input || !window.FormData || !window.XMLHttpRequest) return;  // plain post
      e.preventDefault();
      say("");
      var files = chosen.slice();
      if (files.length > MAX_FILES) { say(f.getAttribute("data-count")); return reset(); }
      if (files.some(function (x) { return TYPES.indexOf(x.type) < 0; })) { say(f.getAttribute("data-type")); return reset(); }
      if (files.length) progress(f.getAttribute("data-preparing"), null);
      files.reduce(function (p, file) {  // one at a time: Ghostscript is memory-hungry on older phones
        return p.then(function (out) {
          return (file.type === "application/pdf" ? shrinkPdf(file) : shrinkImage(file)).then(function (x) { return out.concat(x); });
        });
      }, Promise.resolve([])).then(function (ready) {
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
