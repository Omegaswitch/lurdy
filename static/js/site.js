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

  // ---- application form: one submission per click, and the visitor sees that it is on its way
  document.querySelectorAll("form.apply").forEach(function (f) {
    f.addEventListener("submit", function () {
      var b = f.querySelector("button[type=submit]");
      if (b) { b.setAttribute("data-label", b.textContent); b.disabled = true; b.textContent = b.getAttribute("data-sending"); }
    });
  });
  addEventListener("pageshow", function () {  // coming back from the thank-you page restores this page from cache, button and all
    document.querySelectorAll("form.apply button[disabled]").forEach(function (b) { b.disabled = false; b.textContent = b.getAttribute("data-label"); });
  });
})();
