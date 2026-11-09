# Aerial · mapa strony dla wyszukiwarek (sitemap.xml)
#
# Pobiera z bazy zatwierdzone studia i producentów (publicznym kluczem, jak strona)
# i zapisuje sitemap.xml w głównym folderze. Uruchamia go automatycznie GitHub
# (.github/workflows/pages.yml), ręcznie:
#   python3 tools/sitemap.py
# Ogłoszeń nie dodajemy (znikają po 60 dniach).
from common import ROOT, SITE, get, studio_slug, maker_slug


def day(iso): return (iso or "")[:10]


studios = get("studios", "id,name,city,address,updated_at")
makers = get("makers", "id,name,city,updated_at")
# data „ostatniej zmiany” list = najnowszy wpis (zamiast dzisiejszej daty, żeby plik nie zmieniał się codziennie bez powodu)
last_s = max((day(s["updated_at"]) for s in studios), default="2026-11-05")
last_m = max((day(m["updated_at"]) for m in makers), default="2026-11-05")
last = max(last_s, last_m)
urls = [(f"{SITE}/", last, "1.0"), (f"{SITE}/calendar/", last, "0.9"), (f"{SITE}/studios/", last_s, "0.9"),
        (f"{SITE}/board/", last, "0.7"), (f"{SITE}/makers/", last_m, "0.8"), (f"{SITE}/polityka-prywatnosci.html", "2026-11-09", "0.2")]
for s in studios:
    urls.append((f"{SITE}/studios/{studio_slug(studios, s)}", day(s["updated_at"]), "0.6"))
for m in makers:
    urls.append((f"{SITE}/makers/{maker_slug(makers, m)}", day(m["updated_at"]), "0.6"))

xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for loc, mod, pri in urls:
    xml.append(f"  <url><loc>{loc}</loc><lastmod>{mod}</lastmod><priority>{pri}</priority></url>")
xml.append("</urlset>")
out = "\n".join(xml) + "\n"
path = ROOT / "sitemap.xml"
if not path.exists() or path.read_text() != out:
    path.write_text(out)
print(f"sitemap.xml: {len(urls)} adresów")
