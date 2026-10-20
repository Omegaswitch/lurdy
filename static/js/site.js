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
    function save() {
      var v = { t: Date.now(), f: {} };
      Array.prototype.forEach.call(f.elements, function (el) {
        if (!el.name || SKIP[el.name] || el.type === "file") return;
        if (el.type === "checkbox" || el.type === "radio") { if (el.checked) (v.f[el.name] = v.f[el.name] || []).push(el.value); }
        else if (el.value) v.f[el.name] = el.value;
      });
      store(Object.keys(v.f).length ? v : null);
      if (note) note.hidden = !Object.keys(v.f).length;
    }
    (function restore() {
      var v = null;
      try { v = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
      if (!v || Date.now() - v.t > DAYS30) return store(null);
      Array.prototype.forEach.call(f.elements, function (el) {
        var x = v.f[el.name];
        if (x == null || SKIP[el.name]) return;
        if (el.type === "checkbox" || el.type === "radio") el.checked = x.indexOf(el.value) >= 0;
        else if (el.type !== "file") el.value = x;
      });
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
    var clear = f.querySelector("[data-clear]");
    if (clear) clear.addEventListener("click", function () {
      store(null); f.reset(); chosen = []; render(); say(""); note.hidden = true;
    });

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
