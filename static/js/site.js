// lurdy.eu — progressive enhancement only; every page works without this file.
(function () {
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
        var w = new Worker("/js/pdf-worker.js", { type: "module" });
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

    if (input && list) input.addEventListener("change", function () {
      say("");
      list.innerHTML = "";
      Array.prototype.forEach.call(input.files, function (file) {
        var li = document.createElement("li");
        li.textContent = file.name + " · " + mb(file.size);
        list.appendChild(li);
      });
      if (input.files.length > MAX_FILES) say(f.getAttribute("data-count"));
      else if (Array.prototype.some.call(input.files, function (x) { return TYPES.indexOf(x.type) < 0; })) say(f.getAttribute("data-type"));
    });

    f.addEventListener("submit", function (e) {
      if (b) { b.setAttribute("data-label", b.textContent); b.disabled = true; b.textContent = b.getAttribute("data-sending"); }
      if (!input || !window.FormData || !window.XMLHttpRequest) return;  // plain post
      e.preventDefault();
      say("");
      var files = Array.prototype.slice.call(input.files);
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
          if (x.status < 400 && x.responseURL) { location.href = x.responseURL; return; }  // the server redirects to the thank-you page
          document.open(); document.write(x.responseText); document.close();  // the server's own error page
        };
        x.onerror = function () { say(f.getAttribute("data-error")); reset(); };
        x.send(data);
      });
    });
  });
  addEventListener("pageshow", function () {  // coming back from the thank-you page restores this page from cache, button and all
    document.querySelectorAll("form.apply button[disabled]").forEach(function (b) { b.disabled = false; b.textContent = b.getAttribute("data-label"); });
  });
})();
