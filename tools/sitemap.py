# Aerial · mapa strony dla wyszukiwarek (sitemap.xml)
#
# Pobiera z bazy zatwierdzone studia i producentów (publicznym kluczem, jak strona)
# i zapisuje sitemap.xml w głównym folderze. Uruchom po dodaniu nowych wpisów:
#   python3 tools/sitemap.py
# a potem wypchnij zmieniony sitemap.xml. Ogłoszeń nie dodajemy (znikają po 60 dniach).
import datetime, json, re, unicodedata, urllib.request, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://aerial.cyrkarium.com"
cfg = (ROOT / "config.js").read_text()
URL = re.search(r'supabaseUrl:\s*"([^"]+)"', cfg).group(1)
KEY = re.search(r'supabaseAnonKey:\s*"([^"]+)"', cfg).group(1)

def get(table, cols):
    req = urllib.request.Request(f"{URL}/rest/v1/{table}?select={cols}&status=eq.approved", headers={"apikey": KEY})
    return json.load(urllib.request.urlopen(req))

# ten sam „slug” co w app.js (slugify): małe litery, bez polskich znaków, myślniki
def slugify(x):
    x = unicodedata.normalize("NFD", x.lower().strip()).replace("ł", "l")
    x = "".join(c for c in x if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", x).strip("-")[:70]

def day(iso): return (iso or "")[:10]
today = datetime.date.today().isoformat()
urls = [(f"{SITE}/", today, "1.0"), (f"{SITE}/calendar/", today, "0.9"), (f"{SITE}/studios/", today, "0.9"),
        (f"{SITE}/board/", today, "0.7"), (f"{SITE}/makers/", today, "0.8"), (f"{SITE}/polityka-prywatnosci.html", "2026-11-05", "0.2")]
# dwa wpisy o tej samej nazwie i mieście: dopisek z ulicy (albo początku id), jak uniqueSlug w app.js
def unique(rows, x, extra):
    base = slugify(x["name"] + " " + x["city"])
    twins = [y for y in rows if slugify(y["name"] + " " + y["city"]) == base]
    return f"{base}-{slugify(extra or '') or x['id'][:8]}" if len(twins) > 1 else base

studios = get("studios", "id,name,city,address,updated_at")
for s in studios:
    urls.append((f"{SITE}/studios/{unique(studios, s, s.get('address'))}", day(s["updated_at"]), "0.6"))
makers = get("makers", "id,name,city,updated_at")
for m in makers:
    urls.append((f"{SITE}/makers/{unique(makers, m, '')}", day(m["updated_at"]), "0.6"))

xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for loc, mod, pri in urls:
    xml.append(f"  <url><loc>{loc}</loc><lastmod>{mod}</lastmod><priority>{pri}</priority></url>")
xml.append("</urlset>")
(ROOT / "sitemap.xml").write_text("\n".join(xml) + "\n")
print(f"sitemap.xml: {len(urls)} adresów")
