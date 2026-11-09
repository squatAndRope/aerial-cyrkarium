# Aerial · wspólne funkcje dla skryptów w tools/ (mapa strony, strony profili)
import json, re, unicodedata, urllib.request, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://aerial.cyrkarium.com"
_cfg = (ROOT / "config.js").read_text()
URL = re.search(r'supabaseUrl:\s*"([^"]+)"', _cfg).group(1)
KEY = re.search(r'supabaseAnonKey:\s*"([^"]+)"', _cfg).group(1)


def get(table, cols):
    """Zatwierdzone wpisy z bazy, publicznym kluczem (tak jak widzi je strona)."""
    req = urllib.request.Request(f"{URL}/rest/v1/{table}?select={cols}&status=eq.approved&order=name",
                                 headers={"apikey": KEY})
    return json.load(urllib.request.urlopen(req))


def slugify(x):
    """Ten sam „slug” co w app.js: małe litery, bez polskich znaków, myślniki."""
    x = unicodedata.normalize("NFD", (x or "").lower().strip()).replace("ł", "l")
    x = "".join(c for c in x if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", x).strip("-")[:70]


def unique(rows, x, extra_of):
    """Ta sama reguła co uniqueSlug w app.js (tu wszystkie wpisy są zatwierdzone):
    nazwa + miasto; przy bliźniakach dochodzi ulica, a gdy ulicy brak albo się powtarza, początek id."""
    base = slugify(x["name"] + " " + x["city"])
    if not base:
        return str(x["id"])
    twins = [y for y in rows if slugify(y["name"] + " " + y["city"]) == base]
    if len(twins) < 2:
        return base
    ex = slugify(extra_of(x) or "")
    clash = not ex or sum(1 for y in twins if slugify(extra_of(y) or "") == ex) > 1
    return f"{base}{'-' + ex if ex else ''}-{x['id'][:8]}" if clash else f"{base}-{ex}"


def studio_slug(rows, s):
    return unique(rows, s, lambda y: y.get("address"))


def maker_slug(rows, m):
    return unique(rows, m, lambda y: "")
