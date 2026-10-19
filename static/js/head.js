// Marks JS as available before first paint, so the mobile menu starts closed.
document.documentElement.classList.add("js");

// Within a section (side menu, section page lists) the scroll position is kept, so the side menu stays
// exactly where it was, and the content slides instead of cross-fading; otherwise a link's #fragment is
// honoured (pages pre-rendered on hover are laid out at the top).
function keptY() { try { return sessionStorage.getItem("keepY"); } catch (e) { return null; } }
// Switching language keeps the reader in the same place and cross-fades the whole page, header included.
function langSwitch() { try { return sessionStorage.getItem("langSwitch"); } catch (e) { return null; } }
addEventListener("click", function (e) {
  var a = e.target.closest && e.target.closest(".side-nav a, .index-list a, .lang a");
  if (!a) return;
  try {
    sessionStorage.setItem("keepY", String(scrollY));
    if (a.closest(".lang")) sessionStorage.setItem("langSwitch", "1");
  } catch (er) {}
});
addEventListener("pageswap", function (e) {
  if (e.viewTransition && keptY() !== null) e.viewTransition.types.add(langSwitch() ? "lang" : "slide");
});
addEventListener("pagereveal", function (e) {
  var y = keptY(), lang = langSwitch();
  try { sessionStorage.removeItem("keepY"); sessionStorage.removeItem("langSwitch"); } catch (er) {}
  if (y !== null) {
    if (e.viewTransition) e.viewTransition.types.add(lang ? "lang" : "slide");
    return scrollTo(0, +y);
  }
  var t = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (t) t.scrollIntoView();
});
