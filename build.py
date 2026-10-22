#!/usr/bin/env python3
"""Static site generator for lurdy.eu. Python 3.10+, standard library only.

    python3 build.py                 preview build into dist/ (noindex, content-status labels shown)
    python3 build.py --production    production build (indexable, no status labels)
    python3 build.py serve [port]    preview build, then serve dist/ with _headers and _redirects applied

Content: content/site.json (facts), content/<lang>.json (all text), content/forms.json (application forms,
shared with api/prihlaska.js, which emails the online applications).
"""
import html
import json
import os
import re
import shutil
import struct
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONTENT, STATIC, DIST = ROOT / "content", ROOT / "static", ROOT / "dist"
PRODUCTION = "--production" in sys.argv
SITE = json.loads((CONTENT / "site.json").read_text(encoding="utf-8"))
FORMS = json.loads((CONTENT / "forms.json").read_text(encoding="utf-8"))
LANGS = SITE["languages"]
L = {l: json.loads((CONTENT / f"{l}.json").read_text(encoding="utf-8")) for l in LANGS if (CONTENT / f"{l}.json").exists()}
LANGS = [l for l in LANGS if l in L]
ASSET_VERSION = datetime.now().strftime("%Y%m%d%H%M")
esc = lambda s: html.escape(str(s or ""), quote=True)
url_of = lambda key, lang: L[lang]["pages"][key]["url"]
CHILDREN = {"prihlasky": ["nemocni", "poutnici", "tym"]}
PARENT = {k: p for p, ks in CHILDREN.items() for k in ks} | {"odeslano": "prihlasky"}


# ---------------------------------------------------------------- helpers


def image_size(rel_url):
    """Width/height of a local PNG or WebP (for layout-stable <img>)."""
    try:
        b = (STATIC / rel_url.lstrip("/")).read_bytes()[:64]
    except OSError:
        return None
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", b[16:24])
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        c = b[12:16]
        if c == b"VP8 ":
            w, h = struct.unpack("<HH", b[26:30])
            return w & 0x3FFF, h & 0x3FFF
        if c == b"VP8L":
            v = int.from_bytes(b[21:25], "little")
            return (v & 0x3FFF) + 1, ((v >> 14) & 0x3FFF) + 1
        if c == b"VP8X":
            return int.from_bytes(b[24:27], "little") + 1, int.from_bytes(b[27:30], "little") + 1
    return None


def photo(name, alt, sizes="100vw", eager=False, cls=""):
    """/media/<name>-800.webp plus the 1600 px version when it exists."""
    src, small, big = (f"/media/{name}-{w}.webp" for w in (800, 480, 1600))
    srcset = f' srcset="{small} 480w, {src} 800w' + (f', {big} 1600w' if (STATIC / big.lstrip("/")).exists() else "") + f'" sizes="{esc(sizes)}"'
    w, h = image_size(src)
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    return f'<img class="ph-img {cls}" src="{src}"{srcset} alt="{esc(alt)}" width="{w}" height="{h}" {load} decoding="async">'


def plain(html_text, n=180):
    t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", html_text))).strip()
    return t if len(t) <= n else t[: t.rfind(" ", 0, n)] + "…"


def fill(s, **kw):
    return re.sub(r"\{(\w+)\}", lambda m: str(kw.get(m.group(1), m.group(0))), s)


def date_span(start, end, lang):
    """'30. dubna – 4. května 2026', '30 April – 4 May 2026' …"""
    a, b, m = datetime.fromisoformat(start), datetime.fromisoformat(end), L[lang]["months"]
    dot = "." if lang in ("cs", "de") else ""
    left = f"{a.day}{dot}" if a.month == b.month else f"{a.day}{dot} {m[a.month - 1]}"
    return f"{left} – {b.day}{dot} {m[b.month - 1]} {b.year}"


def facts(lang):
    c = SITE["contact"]
    return {"email": c["email"], "post": ", ".join(c["post"]), "account": SITE["account"]["number"], "iban": SITE["account"]["iban"],
            "prihlasky": url_of("prihlasky", lang), "privacy": url_of("soukromi", lang),
            "controller": SITE["controller"]["name"], "ico": SITE["controller"]["ico"], "seat": SITE["controller"]["seat"]}


# ---------------------------------------------------------------- layout

FONTS_PRELOAD = ["asap-latin-400-normal", "eb-garamond-latin-500-normal"]
# inlined in every page (about 8 kB compressed): no render-blocking stylesheet request
CSS = re.sub(r"\s*([{}:;,>])\s*", r"\1", re.sub(r"/\*.*?\*/|\n\s*", "", (STATIC / "css" / "site.css").read_text(encoding="utf-8"), flags=re.S)).replace(";}", "}")


def lang_switch(lang, key):
    return "".join(f'<a href="{url_of(key, l)}" lang="{l}" hreflang="{l}"{" aria-current=" + chr(34) + "true" + chr(34) if l == lang else ""}'
                   f' title="{esc(L[l]["langName"])}">{l.upper()}</a>' for l in LANGS)


def nav_html(lang, key):
    t, top = L[lang], PARENT.get(key, key)
    lis = []
    for k in t["nav"]:
        p = t["pages"][k]
        cur = ' aria-current="page"' if k == key else (' class="is-active"' if k == top else "")
        sub = ""
        if k in CHILDREN:
            items = "".join(f'<li><a href="{url_of(c, lang)}">{esc(t["pages"][c]["title"])}</a></li>' for c in CHILDREN[k])
            sub = (f'<button class="sub-toggle" type="button" aria-expanded="false" aria-label="{esc(p["title"])}: {esc(t["ui"]["morePages"])}">'
                   f'<span aria-hidden="true"></span></button><ul class="sub">{items}</ul>')
        lis.append(f'<li class="{"has-sub" if sub else ""}"><a href="{p["url"]}"{cur}>{esc(p["title"])}</a>{sub}</li>')
    return f'<ul class="nav-list">{"".join(lis)}</ul>'


def lockup(lang):
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', (STATIC / "img" / "lockup" / f"{lang}.svg").read_text()).group(1).split()]
    return (f'<img class="lockup" src="/img/lockup/{lang}.svg" alt="{esc(L[lang]["ui"]["lockup"])}" width="{vb[2]:.0f}" height="{vb[3]:.0f}"'
            f' style="--h:{vb[3] / 126:.4f};--t:{vb[1] / 126:.4f}">')


def layout(*, lang, key, title, body, description="", image="/media/lurdy-1600.webp", status=None, robots_extra=""):
    t, u, c, ctl = L[lang], L[lang]["ui"], SITE["contact"], SITE["controller"]
    # one 1200×630 card per language (tools/make_og.py), served from the domain Vercel serves now (its .vercel.app
    # address until the domain moves, then that domain), so shared links show it before launch.
    og_image = (f"https://{os.environ['VERCEL_PROJECT_PRODUCTION_URL']}" if os.environ.get("VERCEL_PROJECT_PRODUCTION_URL") else SITE["baseUrl"]) + f"/img/og-{lang}.jpg"
    url = url_of(key, lang) if key else "/404.html"
    full_title = title if key == "home" else f"{title} | {u['site']}"
    canonical = SITE["baseUrl"] + url
    robots = '<meta name="robots" content="noindex, nofollow">' if not PRODUCTION or robots_extra else ""
    alt_links = "".join(f'<link rel="alternate" hreflang="{l}" href="{SITE["baseUrl"]}{url_of(key, l)}">' for l in LANGS) + \
        f'<link rel="alternate" hreflang="x-default" href="{SITE["baseUrl"]}{url_of(key, "cs")}">' if key else ""
    hero = '<link rel="preload" as="image" href="/media/lurdy-800.webp" imagesrcset="/media/lurdy-480.webp 480w, /media/lurdy-800.webp 800w, /media/lurdy-1600.webp 1600w" imagesizes="100vw" fetchpriority="high">' if key == "home" else ""
    lockups = "".join(f'<link rel="prefetch" href="/img/lockup/{l}.svg" as="image">' for l in LANGS if l != lang)
    preload = hero + lockups + "".join(f'<link rel="preload" href="/fonts/{f}.woff2" as="font" type="font/woff2" crossorigin>' for f in FONTS_PRELOAD) + \
        '<link rel="preload" href="/img/banner/banner-photo.webp" as="image" fetchpriority="high">'
    ld = ""
    if key == "home":  # who we are, for search engines (data only, not executed)
        p = SITE["pilgrimage"]
        ld = '<script type="application/ld+json">' + json.dumps({
            "@context": "https://schema.org", "@type": "Event", "name": f"{u['heroTitle']} {p['start'][:4]}",
            "startDate": p["start"], "endDate": p["end"], "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
            "location": {"@type": "Place", "name": "Sanctuaire Notre-Dame de Lourdes", "address": {"@type": "PostalAddress", "addressLocality": "Lourdes", "addressCountry": "FR"}},
            "organizer": {"@type": "Organization", "name": ctl["name"], "url": canonical, "email": c["email"],
                          "identifier": {"@type": "PropertyValue", "propertyID": "IČO", "value": ctl["ico"]}},
        }, ensure_ascii=False).replace("</", "<\\/") + "</script>"
    status_bar = f'<p class="content-status content-status--{esc(status)}"><span>{esc(u["status"].get(status, status))}</span></p>' if status and not PRODUCTION else ""
    footer_nav = "".join(f'<li><a href="{url_of(k, lang)}">{esc(t["pages"][k]["title"])}</a></li>' for k in t["nav"])
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(full_title)}</title>
<meta name="description" content="{esc(plain(description or body, 160))}">
{robots}
{f'<link rel="canonical" href="{canonical}">' if key else ''}
{alt_links}
<meta property="og:type" content="website">
<meta property="og:site_name" content="{esc(u['site'])}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(plain(description or body, 160))}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{og_image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{esc(u['site'])}">
<meta property="og:locale" content="{t['locale']}">
<meta name="twitter:card" content="summary_large_image">
{ld}
<meta name="theme-color" content="#e31a18">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/img/favicon/favicon-32x32.png">
<link rel="apple-touch-icon" href="/img/favicon/apple-touch-icon-180x180.png">
{preload}
<style>{CSS}</style>
<script src="/js/head.js?v={ASSET_VERSION}"></script>
<script src="/js/site.js?v={ASSET_VERSION}" defer></script>
</head>
<body>
<a class="skip" href="#main">{esc(u['skip'])}</a>
<header class="site-header">
 <div class="topbar"><div class="wrap">
  <a class="topbar-home" href="{url_of('home', lang)}">{esc(u['orderShort'])} · {esc(u['entity'])}</a>
  <nav class="lang" aria-label="{esc(u['langLabel'])}">{lang_switch(lang, key or 'home')}</nav>
 </div></div>
 <div class="banner"><div class="wrap">
  <a class="banner-home" href="{url_of('home', lang)}">{lockup(lang)}</a>
  <p class="fullname">{esc(u['siteFull'])}</p>
 </div></div>
 <nav class="mainnav" aria-label="{esc(u['menu'])}"><div class="wrap">
  <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu">{esc(u['menu'])}</button>
  <div id="menu" class="menu">{nav_html(lang, key)}</div>
 </div></nav>
</header>
<main id="main" tabindex="-1">
{status_bar}
{body}
</main>
<footer class="site-footer">
 <div class="f-nav"><div class="wrap"><ul>{footer_nav}</ul></div></div>
 <div class="f-id"><div class="wrap">
  <p class="f-name">{esc(u['siteFull'])}</p>
  <p>{esc(u['controller'])}: {esc(ctl['name'])}, {esc(u['ico'])} {ctl['ico']}, {esc(ctl['seat'])}, {esc(u['register'])} {esc(ctl['register'])} · <a href="mailto:{c['email']}">{c['email']}</a></p>
 </div></div>
 <div class="f-red"><div class="wrap">
  <p>{esc(u['maltezskyrad'])}: <a href="https://www.maltezskyrad.cz/">www.maltezskyrad.cz</a></p>
  <p>{esc(u['orderShort'])}: <a href="https://www.orderofmalta.int/">www.orderofmalta.int</a></p>
  <p><a href="{url_of('soukromi', lang)}">{esc(u['privacy'])}</a> · <a href="https://github.com/Omegaswitch/lurdy">{esc(u['source'])}</a></p>
 </div></div>
</footer>
</body>
</html>
"""


def crumbs_html(key, lang):
    t = L[lang]
    trail = [("home", t["ui"]["home"])] + ([(PARENT[key], t["pages"][PARENT[key]]["title"])] if key in PARENT else []) + [(key, t["pages"][key]["title"])]
    items = "".join(f'<li><span aria-current="page">{esc(x)}</span></li>' if k == key else f'<li><a href="{url_of(k, lang)}">{esc(x)}</a></li>' for k, x in trail)
    return f'<nav class="crumbs" aria-label="{esc(t["ui"]["breadcrumb"])}"><ol>{items}</ol></nav>'


def side_nav(key, lang):
    top = PARENT.get(key)
    if top not in CHILDREN:
        return ""
    t = L[lang]
    items = "".join(f'<li><a href="{url_of(k, lang)}"{" aria-current=" + chr(34) + "page" + chr(34) if k == key else ""}>{esc(t["pages"][k]["title"])}</a></li>' for k in CHILDREN[top])
    return (f'<div class="page-side"><nav class="side-nav" aria-label="{esc(t["ui"]["inSection"])}"><p class="label">'
            f'<a href="{url_of(top, lang)}">{esc(t["pages"][top]["title"])}</a></p><ul>{items}</ul></nav></div>')


def page(key, lang, inner, lead="", status=None, image=None):
    p, side = L[lang]["pages"][key], side_nav(key, lang)
    body = f"""
<div class="wrap">{crumbs_html(key, lang)}</div>
<article class="wrap page{' page--with-side' if side else ''}">
 <header class="page-head"><h1 class="display">{esc(p['title'])}</h1>{f'<p class="lead-s">{esc(lead)}</p>' if lead else ''}</header>
 <div class="page-main">{inner}</div>
 {side}
</article>"""
    return layout(lang=lang, key=key, title=p["title"], body=body, description=p.get("description", ""), status=status or ("translation" if lang != "cs" else None),
                  **({"image": image} if image else {}))


# ---------------------------------------------------------------- blocks


def faq_list(lang, items):
    return '<div class="faq">' + "".join(f'<details><summary>{esc(q)}</summary><div class="prose">{a}</div></details>' for q, a in items) + "</div>"


def contact_card(lang):
    u, c = L[lang]["ui"], SITE["contact"]
    return f"""<dl class="contact-card">
 <div><dt>{esc(u['email'])}</dt><dd><a href="mailto:{c['email']}">{c['email']}</a></dd></div>
 <div><dt>{esc(u['post'])}</dt><dd>{'<br>'.join(esc(x) for x in c['post'])}</dd></div>
</dl><p class="small">{esc(u['contactNote'])}</p>"""


def downloads(lang):
    u, f = L[lang]["ui"], SITE["files"]
    return (f'<ul class="downloads"><li><a href="{f["poster"]}">{esc(u["poster"])} <span class="file-meta">PDF</span></a></li>'
            f'<li><a href="{f["info"]}">{esc(u["info"])} <span class="file-meta">PDF</span></a></li></ul>')


def field_html(f, lang, form):
    t = L[lang]
    if "g" in f:
        return f'</fieldset><fieldset><legend>{esc(t["fields"][f["g"]])}</legend>'
    k, typ, req = f["k"], f["t"], bool(f.get("r"))
    fid, label = f"{form}-{k}", esc(t["fields"][k]) + (' <span aria-hidden="true">*</span>' if req else "")
    hint = t["fields"].get(f"{k}_hint")
    hint_html = f'<span class="hint" id="{fid}-h">{esc(hint)}</span>' if hint else ""
    described = f' aria-describedby="{fid}-h"' if hint else ""
    r = " required" if req else ""
    if typ == "file":  # shrunk in the browser by site.js before upload (images on a canvas, large PDFs with Ghostscript)
        return (f'<div class="field field--wide"><label for="{fid}">{label}</label>{hint_html}'
                f'<div class="file-pick"><input id="{fid}" class="file-input" name="{k}" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf"{described}>'
                f'<label for="{fid}"  class="btn btn--ghost">{esc(t["ui"]["chooseFiles"])}</label></div>'
                f'<ul class="file-list" aria-live="polite"></ul></div>')
    if typ == "date":  # three selects in the page language; a native date picker follows the browser's language instead
        u, now = t["ui"], datetime.now().year
        years = range(now, now - 106, -1) if k == "birth" else range(now, now + 16)
        def sel(part, label, opts):
            o = "".join(f'<option value="{v}">{esc(n)}</option>' for v, n in opts)
            return f'<select name="{k}_{part}" aria-label="{esc(t["fields"][k])}: {esc(label)}"{r}><option value="">{esc(label)}</option>{o}</select>'
        parts = sel("d", u["day"], [(i, i) for i in range(1, 32)]) + sel("m", u["month"], [(i, m) for i, m in enumerate(t["monthNames"], 1)]) + sel("y", u["year"], [(y, y) for y in years])
        return f'<fieldset class="field choice date"><legend>{label}</legend><div class="date-parts">{parts}</div></fieldset>'
    if typ in ("radio", "check"):
        kind = "radio" if typ == "radio" else "checkbox"
        opts = "".join(f'<label><input type="{kind}" name="{k}" value="{o}"{r if kind == "radio" else ""}> {esc(t["opts"][o])}</label>' for o in f["o"])
        return f'<fieldset class="field choice"><legend>{label}</legend>{hint_html}<div class="opts">{opts}</div></fieldset>'
    ac = f' autocomplete="{f["ac"]}"' if f.get("ac") else ""
    if typ == "area":
        control = f'<textarea id="{fid}" name="{k}" rows="4" maxlength="2000"{r}{described}></textarea>'
    else:
        extra = ' inputmode="numeric" min="0" max="300"' if typ == "number" else ' maxlength="200"'
        control = f'<input id="{fid}" name="{k}" type="{typ}"{extra}{ac}{r}{described}>'
    return f'<div class="field{" field--wide" if typ == "area" else ""}"><label for="{fid}">{label}</label>{hint_html}{control}</div>'


def form_html(form, lang):
    u = L[lang]["ui"]
    fields = "".join(field_html(f, lang, form) for f in FORMS[form])
    return f"""<form class="apply" method="post" action="/api/prihlaska/" accept-charset="utf-8" enctype="multipart/form-data"
 data-preparing="{esc(u['preparing'])}" data-uploading="{esc(u['uploading'])}" data-too-big="{esc(u['filesTooBig'])}" data-type="{esc(u['filesType'])}" data-count="{esc(u['filesCount'])}" data-error="{esc(u['sendError'])}" data-remove="{esc(u['removeFile'])}" data-draft="{form}">
 <input type="hidden" name="form" value="{form}"><input type="hidden" name="lang" value="{lang}">
 <p class="small">{esc(u['required'])}</p>
 <p class="small draft-note" hidden>{esc(u['draftNote'])} <button class="link-btn" type="button" data-clear>{esc(u['draftClear'])}</button></p>
 <fieldset>{fields}</fieldset>
 <fieldset><legend>{esc(u['declarationTitle'])}</legend>
  <label class="consent"><input type="checkbox" name="declaration" value="yes" required> <span>{esc(u['declaration'])} <span aria-hidden="true">*</span></span></label>
  <label class="consent"><input type="checkbox" name="consent" value="yes" required> <span>{esc(u['consent'])} <span aria-hidden="true">*</span></span></label>
  <p class="small"><a href="{url_of('soukromi', lang)}">{esc(u['privacyMore'])}</a></p>
 </fieldset>
 <div class="hp" aria-hidden="true"><label>Web <input name="web" tabindex="-1" autocomplete="off"></label></div>
 <div class="submit"><button class="btn btn--submit" type="submit" data-sending="{esc(u['sending'])}">{esc(u['submit'])}</button>
 <p class="small">{esc(u['copyNote'])}</p>
 <div class="progress" hidden><progress max="100"></progress><span role="status"></span></div>
 <p class="form-error" role="alert" hidden></p></div>
</form>"""


# ---------------------------------------------------------------- pages


def render_home(lang):
    t, u, s, p, last = L[lang], L[lang]["ui"], SITE, SITE["pilgrimage"], SITE["last"]
    year = p["start"][:4]
    reg = u["regOpen"] if s["registrationOpen"] else fill(u["regClosed"], year=year)
    groups = "".join(f'<li><b>{esc(a)}</b><span>{esc(b)}</span></li>' for a, b in u["groups"])
    faq = faq_list(lang, [t["faq"][i] for i in t["faqHome"]])
    links = "".join(f'<li><a href="{esc(h)}">{esc(n)}</a></li>' for n, h in s["links"])
    body = f"""
<section class="hero" aria-labelledby="home-title">
 <div class="hero-media">{photo('lurdy', '', sizes='100vw', eager=True)}</div>
 <div class="wrap hero-grid">
  <div class="hero-text">
   <p class="kicker">{esc(u['kicker'])}</p>
   <h1 id="home-title" class="display">{esc(u['heroTitle'])}</h1>
   <p class="lead">{esc(u['heroLead'])}</p>
  </div>
  <div class="next">
   <h2 id="next-title" class="display-s">{esc(fill(u['nextTitle'], year=year))}</h2>
   <p class="next-dates"><time datetime="{p['start']}">{esc(fill(u['nextDates'], n=p['number'], dates=date_span(p['start'], p['end'], lang)))}</time></p>
   <p class="next-reg{' is-open' if s['registrationOpen'] else ''}">{esc(reg)}</p>
   <p class="next-links"><a class="btn" href="{url_of('prihlasky', lang)}">{esc(u['apply'])}</a> <a class="link-strong" href="{url_of('ucast', lang)}">{esc(u['howTo'])}</a></p>
  </div>
 </div>
</section>

<section class="band" aria-labelledby="groups-title"><div class="wrap split">
 <div class="split-head"><h2 id="groups-title" class="display-m">{esc(u['groupsTitle'])}</h2></div>
 <ul class="works groups">{groups}</ul>
</div></section>

<section class="band band-grey" aria-labelledby="last-title"><div class="wrap split split--media">
 <figure class="last-figure">{photo('2019', u['lastAlt'], sizes='(min-width: 961px) 50vw, 100vw')}</figure>
 <div><h2 id="last-title" class="display-m">{esc(fill(u['lastTitle'], n=last['number']))}</h2>
  <p>{esc(fill(u['lastText'], dates=date_span(last['start'], last['end'], lang)))}</p>
  <p><a class="link-strong" href="{url_of('fotogalerie', lang)}">{esc(u['galleryLink'])}</a></p></div>
</div></section>

<section class="band" aria-labelledby="faq-title"><div class="wrap split">
 <div class="split-head"><h2 id="faq-title" class="display-m">{esc(u['faqTitle'])}</h2><p><a class="link-strong" href="{url_of('dotazy', lang)}">{esc(u['faqAll'])}</a></p></div>
 {faq}
</div></section>

<section class="band band-candles" aria-labelledby="org-title"><div class="wrap split">
 <div class="split-head"><h2 id="org-title" class="display-m">{esc(u['organiserTitle'])}</h2><p>{esc(u['organiserText'])}</p></div>
 <div class="org-cols">
  <div><h3 class="display-s">{esc(u['contactTitle'])}</h3>{contact_card(lang)}</div>
  <div><h3 class="display-s">{esc(u['docsTitle'])}</h3>{downloads(lang)}<h3 class="display-s">{esc(u['linksTitle'])}</h3><ul class="plain-links">{links}</ul></div>
 </div>
</div></section>
"""
    return layout(lang=lang, key="home", title=t["pages"]["home"]["title"], body=body, description=t["pages"]["home"]["description"],
                  status="new" if lang == "cs" else "translation")


def render_section(key, lang):
    t, kw = L[lang], facts(lang)
    inner = f'<div class="prose">{fill(t["pages"][key]["body"], **kw)}</div>'
    if key == "ucast":
        inner += f'<h2>{esc(t["ui"]["contactTitle"])}</h2>' + contact_card(lang)
    if key == "prihlasky":
        reg = t["ui"]["regOpen"] if SITE["registrationOpen"] else fill(t["ui"]["regClosed"], year=SITE["pilgrimage"]["start"][:4])
        inner = f'<p class="notice{" is-open" if SITE["registrationOpen"] else ""}">{esc(reg)}</p>' + inner + '<ul class="index-list">' + "".join(
            f'<li><a href="{url_of(k, lang)}"><b>{esc(t["pages"][k]["title"])}</b><span>{esc(t["pages"][k]["lead"])}</span></a></li>' for k in CHILDREN["prihlasky"]) + "</ul>"
    return page(key, lang, inner)


def render_form_page(key, lang):
    u, p = L[lang]["ui"], L[lang]["pages"][key]
    dl = f'<p><a class="btn btn--ghost" href="{SITE["files"][key]}" download>{esc(u["download"])} <span class="file-meta">{SITE["files"][key].rsplit(".", 1)[1].upper()}</span></a></p>'
    if key not in FORMS:
        inner = f'<p>{esc(u["downloadOnly"])}</p>{dl}'
    elif SITE["registrationOpen"]:
        inner = f'{form_html(key, lang)}<section class="paper"><h2 class="display-s">{esc(u["paperTitle"])}</h2><p>{esc(u["paperNote"])}</p>{dl}</section>'
    else:
        inner = f'<p class="notice">{esc(fill(u["regClosed"], year=SITE["pilgrimage"]["start"][:4]))}</p><p>{esc(u["onlineClosed"])}</p>{dl}'
    return page(key, lang, inner, lead=p["lead"])


def render_faq(lang):
    return page("dotazy", lang, faq_list(lang, L[lang]["faq"]))


def render_gallery(lang):
    g = L[lang]["gallery"]
    items = "".join(f"""<li class="g-item" id="lurdy-{y}">
 <a class="g-photo" href="/media/{y}-{1600 if (STATIC / f'media/{y}-1600.webp').exists() else 800}.webp">{photo(y, fill(L[lang]['galleryTitle'], year=y), sizes='(min-width: 961px) 420px, calc(100vw - 32px)', eager=y == SITE['gallery'][0])}</a>
 <div><h2 class="display-s">{esc(fill(L[lang]['galleryTitle'], year=y))}</h2><p>{esc(g[y])}</p></div>
</li>""" for y in SITE["gallery"])
    return page("fotogalerie", lang, f'<ol class="gallery">{items}</ol>', lead=g["lead"], image="/media/2019-1600.webp")


def render_privacy(lang):
    return page("soukromi", lang, f'<div class="prose">{fill(L[lang]["privacyBody"], **facts(lang))}</div>', status="approval")


def render_sent(lang):
    t = L[lang]
    return page("odeslano", lang, f'<div class="prose">{t["pages"]["odeslano"]["body"]}</div><p><a class="link-strong" href="{url_of("home", lang)}">{esc(t["ui"]["home"])}</a></p>')


def render_404():
    u = L["cs"]["ui"]
    body = f'<div class="wrap page page--simple"><header class="page-head"><h1 class="display">{esc(u["notFound"])}</h1></header><div class="prose"><p>{esc(u["notFoundText"])}</p><p><a class="link-strong" href="/">{esc(u["home"])}</a></p></div></div>'
    return layout(lang="cs", key=None, title=u["notFound"], body=body, description=u["notFoundText"])


# ---------------------------------------------------------------- output


def write(url, html_text):
    path = DIST / url.lstrip("/") / "index.html" if url.endswith("/") else DIST / url.lstrip("/")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html_text, encoding="utf-8")


VERCEL = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))  # headers and redirects live here; other hosts get _headers and _redirects
HEADERS = "".join(h["source"].replace("(.*)", "*") + "\n" + "".join(f"  {x['key']}: {x['value']}\n" for x in h["headers"]) for h in VERCEL["headers"])
REDIRECTS = [(r["source"].replace("(.*)", "*"), r["destination"].replace("$1", ":splat")) for r in VERCEL.get("redirects", [])]
NOINDEX = {"odeslano"}  # the thank-you page is reached only by submitting a form


def build():
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(STATIC, DIST)
    urls = []
    for lang in LANGS:
        pages = {"home": render_home(lang), "ucast": render_section("ucast", lang), "prihlasky": render_section("prihlasky", lang),
                 "dotazy": render_faq(lang), "fotogalerie": render_gallery(lang), "soukromi": render_privacy(lang), "odeslano": render_sent(lang)}
        pages |= {k: render_form_page(k, lang) for k in CHILDREN["prihlasky"]}
        for k, h in pages.items():
            if k in NOINDEX:
                h = h.replace("<head>\n", '<head>\n<meta name="robots" content="noindex">\n', 1) if PRODUCTION else h
            else:
                urls.append(url_of(k, lang))
            write(url_of(k, lang), h)
    write("/404.html", render_404())
    (DIST / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
                                      "".join(f"<url><loc>{SITE['baseUrl']}{u}</loc></url>" for u in urls) + "</urlset>", encoding="utf-8")
    (DIST / "robots.txt").write_text(("User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: " + SITE["baseUrl"] + "/sitemap.xml\n") if PRODUCTION
                                     else "User-agent: *\nDisallow: /\n", encoding="utf-8")
    (DIST / "_headers").write_text(HEADERS + ("" if PRODUCTION else "/*\n  X-Robots-Tag: noindex, nofollow\n"), encoding="utf-8")
    (DIST / "_redirects").write_text("".join(f"{a} {b} 301\n" for a, b in REDIRECTS), encoding="utf-8")
    print(f"built {len(urls)} pages in {', '.join(LANGS)}, {'production' if PRODUCTION else 'preview'} → {DIST}")


# ---------------------------------------------------------------- local preview server


def serve(port=8000):
    import functools
    import http.server
    from urllib.parse import unquote
    rules = [l.split() for l in (DIST / "_redirects").read_text().splitlines() if l.strip()]
    headers, types, block = {}, {}, None  # site-wide headers; exact-path Content-Type overrides
    for line in (DIST / "_headers").read_text().splitlines():
        if line and not line.startswith(" "):
            block = line.strip()
        elif line.strip():
            k, v = line.strip().split(":", 1)
            if block == "/*":
                headers[k] = v.strip()
            elif k == "Content-Type":
                types[block] = v.strip()

    class H(http.server.SimpleHTTPRequestHandler):
        def guess_type(self, path):
            return types.get(self.path.split("?")[0]) or super().guess_type(path)

        def end_headers(self):
            for k, v in headers.items():
                if k == "Strict-Transport-Security":
                    continue  # local server is plain HTTP
                self.send_header(k, v.replace("; upgrade-insecure-requests", ""))
            super().end_headers()

        def do_POST(self):  # the form function runs only on Vercel; locally, pretend it succeeded
            n = int(self.headers.get("Content-Length") or 0)
            self.rfile.read(n)
            print(f"POST {self.path}: {n} bytes", flush=True)
            self.send_response(303)
            self.send_header("Location", "/prihlasky/odeslano/")
            self.end_headers()

        def do_GET(self):
            path = self.path.split("?")[0]
            for src, dst, _ in rules:
                if src.endswith("*") and path.startswith(src[:-1]):
                    dst = dst.replace(":splat", path[len(src) - 1:])
                elif src != path:
                    continue
                self.send_response(301)
                self.send_header("Location", dst)
                self.end_headers()
                return
            fs_path = unquote(path).lstrip("/")
            if not (DIST / fs_path).exists() and not (DIST / fs_path / "index.html").exists():
                self.send_response(404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write((DIST / "404.html").read_bytes())
                return
            super().do_GET()

        do_HEAD = do_GET

    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(H, directory=str(DIST)))
    print(f"serving http://127.0.0.1:{port}/")
    httpd.serve_forever()


if __name__ == "__main__":
    build()
    if len(sys.argv) > 1 and sys.argv[1] == "serve":
        serve(int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 8000)
