#!/usr/bin/env python3
"""Builds static/img/og-<lang>.jpg, the 1200×630 link-preview cards (Discord, iMessage, Facebook): the Lourdes basilica photograph under a
dark veil, the Order's lockup for that language (static/img/lockup/<lang>.svg, white lettering) and a red strip.
Same recipe as the school sites' tools/make_og.py. Run once after a lockup or photo change; the output is committed.

    pip install playwright pillow && python3 tools/make_og.py
"""
import base64
import io
import re
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PHOTO = ROOT / "static" / "media" / "lurdy-1600.webp"
PHOTO_CSS = "top:-70px;left:0;width:1700px;height:auto"  # the basilica of Lourdes and the Order's pilgrims, right of the lockup
LANGS = ("cs", "en", "fr", "it", "de")
RED = "#e31818"


def card(page, lang):
    photo = "data:image/webp;base64," + base64.b64encode(PHOTO.read_bytes()).decode()
    logo = "data:image/svg+xml;base64," + base64.b64encode((ROOT / "static" / "img" / "lockup" / f"{lang}.svg").read_bytes()).decode()
    page.set_content(f'''<!doctype html><body style="margin:0;width:1200px;height:630px;position:relative;overflow:hidden;background:#1d2a3a">
<img src="{photo}" style="position:absolute;{PHOTO_CSS}" alt="">
<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(14,22,30,.74) 0%,rgba(14,22,30,.62) 45%,rgba(14,22,30,.45) 70%,rgba(14,22,30,.55) 100%)"></div>
<img src="{logo}" style="position:absolute;left:68px;top:50%;transform:translateY(-54%);height:206px;width:auto" alt="">
<div style="position:absolute;left:0;right:0;bottom:0;height:18px;background:{RED}"></div></body>''')
    page.wait_for_timeout(200)
    out = ROOT / "static" / "img" / f"og-{lang}.jpg"
    Image.open(io.BytesIO(page.screenshot())).convert("RGB").save(out, "JPEG", quality=86, progressive=True, optimize=True)
    print(out.name, out.stat().st_size)


def email_logo(page, lang):
    # the lockup as a PNG for e-mails (mail clients do not show SVG); 2× for sharp screens, shown 60 px high
    # the banner lockup has white lettering for the red banner; e-mails have a white header, so the lettering turns red.
    # The shield stays as drawn; the lettering is the last white shape (before it: the shield's border and the cross).
    svg = (ROOT / "static" / "img" / "lockup" / f"{lang}.svg").read_text()
    head, _, tail = svg.rpartition('fill="#fff"')
    svg = f'{head}fill="{RED}"{tail}'
    logo = "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]  # each language has its own width
    page.set_viewport_size({"width": round(120 * vb[2] / vb[3]), "height": 120})
    page.set_content(f'<!doctype html><body style="margin:0;background:#fff"><img src="{logo}" style="display:block;height:120px;width:auto" alt=""></body>')
    page.wait_for_timeout(200)
    out = ROOT / "static" / "img" / "email" / f"lockup-{lang}.png"
    out.parent.mkdir(exist_ok=True)
    Image.open(io.BytesIO(page.screenshot())).convert("RGB").quantize(64).save(out, "PNG", optimize=True)
    print(out.name, out.stat().st_size)


def main():
    exe = "/opt/pw-browsers/chromium" if Path("/opt/pw-browsers/chromium").exists() else None
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe)
        page = b.new_page(viewport={"width": 1200, "height": 630})
        for lang in LANGS:
            card(page, lang)
        for lang in LANGS:
            email_logo(page, lang)
        b.close()


if __name__ == "__main__":
    main()
