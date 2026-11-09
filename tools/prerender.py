# Aerial · osobne strony studiów i producentów (podgląd linku w Facebooku, Messengerze, Google)
#
# Dla każdego zatwierdzonego studia i producenta zapisuje:
#   p/studios/<slug>.html, p/makers/<slug>.html  kopia index.html z nazwą, miastem, opisem,
#                                                 adresem kanonicznym i danymi dla Google w nagłówku
#   p/og/studios/<slug>.jpg, p/og/makers/<slug>.jpg  obrazek podglądu 1200×630 (logo albo pierwsza litera)
# .htaccess podaje te pliki pod zwykłymi adresami (/studios/<slug>), a strona działa dalej
# tak samo, bo to ten sam index.html. Pliki usuniętych wpisów są kasowane.
#
# Uruchamia go automatycznie GitHub (.github/workflows/pages.yml) co kilka godzin
# i po każdej zmianie strony. Ręcznie:  python3 tools/prerender.py   (potrzebny Pillow)
import html, io, json, re, urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageOps
from common import ROOT, SITE, URL, get, studio_slug, maker_slug, cities, slugify

OUT = ROOT / "p"
FONTS = ROOT / "tools" / "fonts"
VIOLET, LILAC, LIME, WHITE = (75, 51, 115), (202, 194, 223), (209, 223, 168), (255, 255, 255)
DISC = {"hoop": "koło", "silks": "szarfy", "rope": "lina", "hammock": "hamak", "aerial_yoga": "aerial joga",
        "trapeze": "trapez", "straps": "pasy", "pole": "pole", "hair": "wiszenie na włosach", "other": "inne przyrządy"}
PROD = {"hoops": "koła", "silks": "szarfy i tkaniny", "frames": "ramy i stojaki", "rigging": "sprzęt do zawieszenia",
        "costumes": "stroje", "mats": "materace", "accessories": "akcesoria", "other": "inne"}
written = set()
# obrazki robimy od nowa tylko, gdy zmieniła się ich treść (nazwa, podpis, logo); dzięki temu
# uruchomienie na innym komputerze (inna wersja Pillow) nie podmienia wszystkich plików
MANIFEST = OUT / "og" / "manifest.json"
try:
    old_manifest = json.loads(MANIFEST.read_text())
except Exception:
    old_manifest = {}
new_manifest = {}


def font(name, size, weight):
    f = ImageFont.truetype(str(FONTS / name), size)
    try:
        f.set_variation_by_axes([weight] if name.startswith("Unbounded") else [14, weight])
    except Exception:
        pass
    return f


def write(path, data):
    """Zapis tylko przy zmianie, żeby GitHub nie robił pustych commitów."""
    path.parent.mkdir(parents=True, exist_ok=True)
    written.add(path)
    if not path.exists() or path.read_bytes() != data:
        path.write_bytes(data)
        return True
    return False


def wrap(draw, text, f, width, lines):
    words, out, cur = text.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if draw.textlength(test, font=f) <= width:
            cur = test
        else:
            if cur:
                out.append(cur)
            cur = w
    if cur:
        out.append(cur)
    if len(out) > lines:
        out = out[:lines]
        while draw.textlength(out[-1] + "…", font=f) > width and " " in out[-1]:
            out[-1] = out[-1].rsplit(" ", 1)[0]
        out[-1] += "…"
    return out


def logo_image(path):
    if not path:
        return None
    try:
        raw = urllib.request.urlopen(f"{URL}/storage/v1/object/public/logos/{path}", timeout=20).read()
        return Image.open(io.BytesIO(raw)).convert("RGBA")
    except Exception as e:
        print("  logo nie wczytane:", path, e)
        return None


def card(name, line2, logo):
    """Obrazek 1200×630: fioletowe tło, koło z logo (albo pierwszą literą), nazwa, miasto i dyscypliny."""
    im = Image.new("RGB", (1200, 630), VIOLET)
    d = ImageDraw.Draw(im)
    cx, cy, r = 250, 300, 170
    if logo:
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=WHITE)
        inner = ImageOps.contain(logo, (int(r * 1.45), int(r * 1.45)), Image.LANCZOS)
        mask = Image.new("L", (1200, 630), 0)
        ImageDraw.Draw(mask).ellipse((cx - r + 4, cy - r + 4, cx + r - 4, cy + r - 4), fill=255)
        layer = Image.new("RGBA", (1200, 630), (0, 0, 0, 0))
        layer.paste(inner, (cx - inner.width // 2, cy - inner.height // 2), inner)
        im.paste(layer.convert("RGB"), (0, 0), Image.composite(layer.split()[3], Image.new("L", (1200, 630), 0), mask))
    else:
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=LILAC)
        letter = (re.search(r"\w", name) or re.search(r".", "•")).group(0).upper()
        f = font("Unbounded.ttf", 170, 500)
        d.text((cx, cy + 8), letter, font=f, fill=VIOLET, anchor="mm")
    x, w = 480, 660
    size = 64
    while True:
        f = font("Unbounded.ttf", size, 500)
        lines = wrap(d, name, f, w, 3)
        if len(lines) <= 2 or size <= 44:
            break
        size -= 6
    y = 300 - (len(lines) * (size + 14)) // 2 - 30
    for ln in lines:
        d.text((x, y), ln, font=f, fill=WHITE)
        y += size + 14
    f2 = font("DMSans.ttf", 34, 500)
    for ln in wrap(d, line2, f2, w, 2):
        d.text((x, y + 14), ln, font=f2, fill=LILAC)
        y += 46
    d.text((x, 540), "Aerial w Polsce · aerial.cyrkarium.com", font=font("DMSans.ttf", 28, 500), fill=LIME)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=86, optimize=True)
    return buf.getvalue()


def og_image(kind, slug, name, line2, logo_path):
    key = f"{kind}/{slug}"
    sig = json.dumps([name, line2, logo_path or "", 2], ensure_ascii=False)
    path = OUT / "og" / kind / f"{slug}.jpg"
    new_manifest[key] = sig
    written.add(path)
    if path.exists() and old_manifest.get(key) == sig:
        return 0
    return write(path, card(name, line2, logo_image(logo_path)))


def short(text, n=155):
    t = re.sub(r"\s+", " ", text or "").strip()
    return t if len(t) <= n else t[: n - 1].rsplit(" ", 1)[0] + "…"


TEMPLATE = (ROOT / "index.html").read_text()


def page(title, desc, url, image, alt, ld, template=None):
    e = lambda s: html.escape(s, quote=True)
    h = template or TEMPLATE
    subs = [
        (r"<title>.*?</title>", f"<title>{e(title)}</title>"),
        (r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{e(desc)}">'),
        (r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{e(title)}">'),
        (r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{e(desc)}">'),
        (r'<meta property="og:image" content="[^"]*">', f'<meta property="og:image" content="{e(image)}">'),
        (r'<meta property="og:image:alt" content="[^"]*">', f'<meta property="og:image:alt" content="{e(alt)}">'),
    ]
    if template:  # kalendarz ma już adres kanoniczny i og:url w nagłówku
        subs += [(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{e(url)}">'),
                 (r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{e(url)}">')]
    for pat, rep in subs:
        h, n = re.subn(pat, lambda _m: rep, h, count=1)
        if pat.startswith("<meta property=\"og:image:alt") and n == 0:  # kalendarz nie ma og:image:alt
            h = h.replace("</head>", f'  <meta property="og:image:alt" content="{e(alt)}">\n</head>', 1)
            continue
        assert n == 1, pat
    extra = ("" if template else f'  <link rel="canonical" id="canonical" href="{e(url)}">\n'
             f'  <meta property="og:url" content="{e(url)}">\n') + (
             f'  <script type="application/ld+json">{json.dumps(ld, ensure_ascii=False).replace("</", "<\\/")}</script>\n'
             "  <!-- wygenerowane przez tools/prerender.py, nie edytuj ręcznie -->\n")
    return h.replace("</head>", extra + "</head>", 1).encode()


def links(*urls):
    return [u for u in urls if u and re.match(r"^https?://", u)]


changed = 0
studios = get("studios", "id,name,city,address,lat,lng,disciplines,description,website_url,instagram_url,facebook_url,logo_path")
for s in studios:
    slug = studio_slug(studios, s)
    url = f"{SITE}/studios/{slug}"
    disc = [DISC.get(k, k) for k in (s.get("disciplines") or [])]
    line2 = s["city"] + (" · " + ", ".join(disc[:4]) if disc else "")
    desc = short(s.get("description")) or f"Studio aerial w mieście {s['city']}: {', '.join(disc) or 'zajęcia aerial'}. Na mapie Aerial w Polsce."
    img = f"{SITE}/p/og/studios/{slug}.jpg"
    ld = {"@context": "https://schema.org", "@type": "SportsActivityLocation", "name": s["name"], "url": url,
          "description": desc, "image": img,
          "address": {"@type": "PostalAddress", "addressLocality": s["city"], "addressCountry": "PL",
                      **({"streetAddress": s["address"]} if s.get("address") else {})}}
    if s.get("lat") is not None:
        ld["geo"] = {"@type": "GeoCoordinates", "latitude": s["lat"], "longitude": s["lng"]}
    same = links(s.get("website_url"), s.get("instagram_url"), s.get("facebook_url"))
    if same:
        ld["sameAs"] = same
    changed += og_image("studios", slug, s["name"], line2, s.get("logo_path"))
    changed += write(OUT / "studios" / f"{slug}.html",
                     page(f"{s['name']} · {s['city']} · Aerial w Polsce", desc, url, img, f"{s['name']}, {line2}", ld))

# strony miast: /studios/krakow
def plural_pl(n, one, few, many):
    if n == 1:
        return one
    return few if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14 else many


studio_slugs = {studio_slug(studios, s) for s in studios}
for cslug, cname, rows in cities([s for s in studios if s.get("lat") is not None]):
    if cslug in studio_slugs or cslug in ("add", "edit"):
        print("  pominięte miasto (adres zajęty):", cslug)
        continue
    n = len(rows)
    url = f"{SITE}/studios/{cslug}"
    disc = []
    for s in rows:
        for k in s.get("disciplines") or []:
            if DISC.get(k, k) not in disc:
                disc.append(DISC.get(k, k))
    names = ", ".join(s["name"] for s in rows[:2]) + (" i inne" if n > 2 else "")
    count = f"{n} {plural_pl(n, 'studio', 'studia', 'studiów')} aerial"
    desc = short(f"{count} w mieście {cname}: {', '.join(disc[:5])}. {names}. Mapa studiów, open training, wynajem sali i wydarzenia.", 200)
    img = f"{SITE}/p/og/cities/{cslug}.jpg"
    ld = {"@context": "https://schema.org", "@type": "ItemList", "name": f"Studia aerial: {cname}", "url": url,
          "numberOfItems": n,
          "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": s["name"],
                               "url": f"{SITE}/studios/{studio_slug(studios, s)}"} for i, s in enumerate(rows)]}
    changed += og_image("cities", cslug, cname, count + (" · " + ", ".join(disc[:4]) if disc else ""), None)
    changed += write(OUT / "studios" / f"{cslug}.html",
                     page(f"Studia aerial: {cname} ({n}) · Aerial w Polsce", desc, url, img, f"{cname}: {count}", ld))

# wydarzenia z kalendarza: /calendar/?e=<tytuł>-<id8> (.htaccess podaje p/events/<to samo>.html)
import datetime
CAL_TEMPLATE = (ROOT / "calendar" / "index.html").read_text()
TYPES = {"competition": "zawody", "workshop": "warsztaty", "course": "kurs / szkolenie", "festival": "festiwal", "camp": "obóz / intensyw",
         "meetup": "zjazd / jam", "show": "pokaz", "photoshoot": "sesja zdjęciowa"}
MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"]


def when(a, b):
    da, db = datetime.date.fromisoformat(a), datetime.date.fromisoformat(b or a)
    if da == db:
        return f"{da.day} {MONTHS[da.month - 1]} {da.year}"
    if (da.year, da.month) == (db.year, db.month):
        return f"{da.day}–{db.day} {MONTHS[da.month - 1]} {da.year}"
    return f"{da.day} {MONTHS[da.month - 1]} – {db.day} {MONTHS[db.month - 1]} {db.year}"


since = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
events = [ev for ev in get("events", "id,title,type,date_start,date_end,city,venue,organizer,description,price_pln,is_free,reg_url", order="date_start")
          if (ev.get("date_end") or ev.get("date_start") or "") >= since]
for ev in events:
    param = "-".join(x for x in [slugify(ev["title"] or "")[:50].rstrip("-"), ev["id"][:8]] if x)
    url = f"{SITE}/calendar/?e={param}"
    line2 = " · ".join(x for x in [when(ev["date_start"], ev.get("date_end")), ev.get("city"), TYPES.get(ev.get("type"), "")] if x)
    desc = short(f"{line2}. {ev.get('description') or ''}", 200)
    img = f"{SITE}/p/og/events/{param}.jpg"
    ld = {"@context": "https://schema.org", "@type": "Event", "name": ev["title"], "url": url, "image": img,
          "startDate": ev["date_start"], "endDate": ev.get("date_end") or ev["date_start"],
          "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode", "eventStatus": "https://schema.org/EventScheduled",
          "description": short(ev.get("description") or line2, 300),
          "location": {"@type": "Place", "name": ev.get("venue") or ev.get("city"),
                       "address": {"@type": "PostalAddress", "addressLocality": ev.get("city"), "addressCountry": "PL"}}}
    if ev.get("organizer"):
        ld["organizer"] = {"@type": "Organization", "name": ev["organizer"]}
    if ev.get("reg_url"):
        ld["offers"] = {"@type": "Offer", "url": ev["reg_url"], "priceCurrency": "PLN",
                        **({"price": 0} if ev.get("is_free") else ({"price": ev["price_pln"]} if ev.get("price_pln") is not None else {}))}
    changed += og_image("events", param, ev["title"], line2, None)
    changed += write(OUT / "events" / f"{param}.html",
                     page(f"{ev['title']} · {line2} · Aerial w Polsce", desc, url, img, f"{ev['title']}, {line2}", ld, CAL_TEMPLATE))

makers = get("makers", "id,name,city,products,description,website_url,shop_url,instagram_url,facebook_url,logo_path")
for m in makers:
    slug = maker_slug(makers, m)
    url = f"{SITE}/makers/{slug}"
    prod = [PROD.get(k, k) for k in (m.get("products") or [])]
    line2 = m["city"] + (" · " + ", ".join(prod[:4]) if prod else "")
    desc = short(m.get("description")) or f"Producent sprzętu aerial, {m['city']}: {', '.join(prod)}. Na liście Aerial w Polsce."
    img = f"{SITE}/p/og/makers/{slug}.jpg"
    ld = {"@context": "https://schema.org", "@type": "Organization", "name": m["name"], "url": url,
          "description": desc, "image": img,
          "address": {"@type": "PostalAddress", "addressLocality": m["city"], "addressCountry": "PL"}}
    same = links(m.get("website_url"), m.get("shop_url"), m.get("instagram_url"), m.get("facebook_url"))
    if same:
        ld["sameAs"] = same
    changed += og_image("makers", slug, m["name"], line2, m.get("logo_path"))
    changed += write(OUT / "makers" / f"{slug}.html",
                     page(f"{m['name']} · {m['city']} · Aerial w Polsce", desc, url, img, f"{m['name']}, {line2}", ld))

changed += write(MANIFEST, (json.dumps(new_manifest, ensure_ascii=False, indent=0, sort_keys=True) + "\n").encode())

# pliki po usuniętych albo przemianowanych wpisach
removed = 0
for f in OUT.rglob("*"):
    if f.is_file() and f not in written:
        f.unlink()
        removed += 1
print(f"strony profili: {len(studios)} studiów, {len(makers)} producentów, {len(events)} wydarzeń; zmienione pliki: {changed}, usunięte: {removed}")
