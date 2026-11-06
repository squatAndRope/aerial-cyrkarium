/* Aerial · Fundacja Cyrkarium · logika strony

   Spis treści
     1. Ustawienia, język, pomocnicze
     2. Baza (Supabase), logowanie, wczytywanie danych
     3. Nawigacja (prawdziwe adresy: /, /studios/…, /board/…, /account/)
     4. Studia: filtry, mapa, lista, profil
     5. Wiersz wydarzenia (profil studia) i strona główna; 5b ogłoszenia; 5c producenci
     6. Formularz studia
     7. Moje studia i moderacja
     8. Start

   Podgląd bez bazy: dopisz ?demo=1 do adresu. Pokazuje przykładowe, zmyślone studia
   i niczego nie zapisuje. */
(function () {
  "use strict";

  // ---------------- 1. Ustawienia, język, pomocnicze ----------------
  const CFG = window.AC_CONFIG;
  const TEXTS = window.AC_TEXTS;
  const params = new URLSearchParams(location.search);
  const DEMO = params.get("demo") === "1";

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* prywatne okno */ } },
  };
  let lang = (() => {
    const q = params.get("lang");
    if (q && TEXTS[q]) return q;
    const s = store.get("ac-lang");
    if (s && TEXTS[s]) return s;
    return (navigator.language || "pl").toLowerCase().startsWith("pl") ? "pl" : "en";
  })();
  const t = () => TEXTS[lang];

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cityKey = (c) => (c || "").toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/\s+/g, " ");
  const todayISO = () => new Date().toLocaleDateString("sv-SE");
  const privacyHref = () => "/polityka-prywatnosci.html" + (lang === "en" ? "#en" : "");
  const privacyLink = () => ` <a href="${privacyHref()}" target="_blank" rel="noopener">${esc(t().privacy)}</a>`;
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : null);

  // ---------------- logo (Supabase Storage, pojemnik „logos”) ----------------
  const logoUrl = (p) => (p ? `${CFG.supabaseUrl}/storage/v1/object/public/logos/${p}` : null);
  // bez logo: okrągły znaczek z pierwszą literą nazwy, żeby kafelki były równe
  const initial = (name) => (String(name || "").trim().match(/[\p{L}\p{N}]/u) || ["•"])[0].toUpperCase();
  const logoImg = (p, name, cls = "logo") => (p
    ? `<img class="${cls}" src="${esc(logoUrl(p))}" alt="${esc(t().logoOf(name))}" loading="lazy">`
    : `<span class="${cls} logo-letter" aria-hidden="true">${esc(initial(name))}</span>`);
  // zmniejsza obrazek do 400 px (dłuższy bok) i zapisuje jako WebP; Safari bez WebP dostaje PNG
  async function shrinkLogo(file) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, "image/webp", 0.86));
    return blob.type === "image/webp" ? { blob, ext: "webp" } : { blob: await new Promise((res) => c.toBlob(res, "image/png")), ext: "png" };
  }
  // pole „Logo” w formularzu (studio i producent)
  const logoField = (prefix, path, name) => `<div class="field"><label for="${prefix}-logo">${esc(t().fLogo)}</label>
      <div class="logo-field">${path ? `<span id="${prefix}-logo-now">${logoImg(path, name, "logo big")}</span>` : ""}
        <input id="${prefix}-logo" type="file" accept="image/png,image/jpeg,image/webp"></div>
      ${path ? `<label class="toggle"><input type="checkbox" id="${prefix}-logo-del"> <span class="small">${esc(t().fLogoRemove)}</span></label>` : ""}
      <p class="hint">${esc(t().fLogoHint)}</p></div>`;
  // przy zapisie: nowe logo → wgraj; „usuń” → wyczyść; zwraca { logo_path, old } (old = plik do skasowania po zapisie)
  async function prepareLogo(prefix, currentPath) {
    const file = $(prefix + "-logo")?.files?.[0];
    const del = $(prefix + "-logo-del")?.checked;
    if (!file) return del ? { logo_path: null, old: currentPath } : { logo_path: currentPath || null, old: null };
    if (!/^image\//.test(file.type)) throw new Error("type");
    const { blob, ext } = await shrinkLogo(file);
    const path = `${state.user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await state.sb.storage.from("logos").upload(path, blob, { contentType: blob.type, upsert: false });
    if (error) { console.warn(error); throw new Error("upload"); }
    return { logo_path: path, old: currentPath || null };
  }
  const dropLogo = (path) => { if (path && state.sb) state.sb.storage.from("logos").remove([path]).catch(() => {}); };

  // adresy: /studios/real-passion-krakow, /board/sprzedam-szarfy-9m-981aa275
  // Nazwy ścieżek są po angielsku, wspólne dla wszystkich wersji językowych.
  const slugify = (x) => cityKey(x).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  // Adres profilu: nazwa + miasto. Gdy kilka ZATWIERDZONYCH wpisów (plus sam dany wpis) ma tę samą
  // nazwę i miasto, dochodzi ulica; gdy ulicy brak albo też się powtarza, dochodzi początek id.
  // Liczymy tylko zatwierdzone, żeby adres był taki sam dla każdego, kto patrzy (i zgodny z mapą strony).
  // Ta sama reguła jest w tools/sitemap.py.
  const uniqueSlug = (list, x, extraOf) => {
    const base = slugify(x.name + " " + x.city);
    if (!base) return String(x.id);
    const twins = list.filter((y) => slugify(y.name + " " + y.city) === base && (y.status === "approved" || String(y.id) === String(x.id)));
    if (twins.length < 2) return base;
    const ex = slugify(extraOf(x) || "");
    const clash = !ex || twins.filter((y) => slugify(extraOf(y) || "") === ex).length > 1;
    return clash ? `${base}${ex ? "-" + ex : ""}-${String(x.id).slice(0, 8)}` : `${base}-${ex}`;
  };
  const studioSlug = (st) => uniqueSlug(state.studios, st, (y) => y.address);
  const studioPath = (st) => `/studios/${studioSlug(st)}`;
  const makerSlug = (m) => uniqueSlug(state.makers, m, () => "");
  const makerPath = (m) => `/makers/${makerSlug(m)}`;
  // stary adres bez dopisku (sprzed tej zmiany) też trafia do pierwszego z bliźniaków
  const findMaker = (key) => state.makers.find((x) => makerSlug(x) === key) || state.makers.find((x) => String(x.id) === key)
    || state.makers.find((x) => slugify(x.name + " " + x.city) === key);
  const listingPath = (l) => `/board/${slugify(l.title).slice(0, 60)}-${String(l.id).slice(0, 8)}`;
  // szukanie po ładnym adresie albo po samym id (stare linki z # i linki z maili)
  const findStudio = (key) => state.studios.find((x) => studioSlug(x) === key) || state.studios.find((x) => String(x.id) === key)
    || state.studios.find((x) => slugify(x.name + " " + x.city) === key);
  const findListing = (key) => state.listings.find((x) => String(x.id) === key)
    || state.listings.find((x) => String(x.id).startsWith(String(key).split("-").pop()));

  function applyTexts() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i]").forEach((n) => { const v = t()[n.dataset.i]; if (typeof v === "string") n.textContent = v; });
    document.querySelectorAll("[data-ph]").forEach((n) => { n.placeholder = t()[n.dataset.ph]; });
    document.querySelectorAll("[data-aria]").forEach((n) => { n.setAttribute("aria-label", t()[n.dataset.aria]); });
    document.querySelectorAll(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  }

  function notice(text, kind = "ok") {
    const box = $("notice");
    box.innerHTML = text ? `<p class="msg ${kind}">${esc(text)}</p>` : "";
  }

  // wykrywanie telefonów i e-maili w tekście (polityka: kontakt tylko przez linki i formularz).
  // Telefon = ciąg cyfr, spacji i myślników z co najmniej 9 cyframi. Ta sama reguła
  // jest w bazie (public.has_contact w 14_listings.sql), więc daty i ceny przechodzą.
  function contactInText(text) {
    const s = text || "";
    const phone = (s.match(/\+?\d[\d -]{7,}\d/g) || []).some((m) => m.replace(/\D/g, "").length >= 9);
    const mail = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(s);
    return [phone && t().phone, mail && t().email].filter(Boolean);
  }
  const daysBetween = (a, b) => Math.floor((b - a) / 86400000);
  const isLive = (l) => l.status === "approved" && new Date(l.expires_at) > new Date();

  // ---------------- 2. Baza, logowanie, dane ----------------
  const state = {
    sb: null, user: null, isAdmin: false,
    studios: [],        // wszystko, co baza pozwala przeczytać tej osobie
    events: [],         // nadchodzące, zatwierdzone wydarzenia z Aerial Events
    loaded: false, loadFailed: false,
    filter: { disc: "all", q: "", level: "", kids: false, open: false, rental: false },
    current: null,      // id otwartego profilu
    listings: [],       // ogłoszenia, które baza pozwala przeczytać tej osobie
    stats: {},          // liczba wiadomości przy moich ogłoszeniach
    lfilter: { cat: "all", kind: "all", q: "" },
    listingsLoaded: false,
    makers: [],         // producenci, które baza pozwala przeczytać tej osobie
    makersLoaded: false,
    mfilter: { prod: "all", q: "", custom: false, abroad: false },
    mineTab: null,      // zakładka w „Moich wpisach”
  };

  const DEMO_MAKERS = [
    { id: "m1", name: "Szarfownia (przykład)", city: "Łódź", products: ["silks"], custom_orders: true, ships_abroad: true, verified: true, description: "Szarfy z poliamidu o niskiej rozciągliwości, 20 kolorów, długość na zamówienie.", website_url: "https://example.com", shop_url: "https://example.com/sklep", status: "approved" },
    { id: "m2", name: "Kołodziej Aerial (przykład)", city: "Poznań", products: ["hoops", "frames", "rigging"], custom_orders: true, ships_abroad: false, verified: false, description: "Koła stalowe i aluminiowe na wymiar, ramy wolnostojące.", instagram_url: "https://instagram.com/", status: "approved" },
    { id: "m3", name: "Cekin Studio (przykład)", city: "Warszawa", products: ["costumes", "accessories"], custom_orders: true, ships_abroad: true, verified: true, description: "Kostiumy startowe i pokazowe szyte na miarę, ochraniacze na nadgarstki.", website_url: "https://example.com", status: "approved" },
  ];

  const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();
  const DEMO_LISTINGS = [
    { id: "l1", category: "partner", kind: "seek", title: "Partnerka do duetu na kole, poziom średni (przykład)", description: "Chcę przygotować duet na zawody wiosną. Trenuję 2 razy w tygodniu, mogę dojeżdżać do 30 km. Mam własne koło 90 cm.", city: "Poznań", nick: "Ola_hoop", price: null, status: "approved", created_at: inDays(-2), expires_at: inDays(58) },
    { id: "l2", category: "gear", kind: "sell", title: "Sprzedam szarfy 9 m, fioletowe (przykład)", description: "Używane jeden sezon, bez zaciągnięć. Odbiór osobisty albo wysyłka.", city: "Gdańsk", nick: "Marta", price: "450 zł", status: "approved", created_at: inDays(-5), expires_at: inDays(55) },
    { id: "l3", category: "job", kind: "offer", title: "Studio szuka instruktorki aerial hoop (przykład)", description: "Zajęcia we wtorki wieczorem, grupa początkująca, od stycznia.", city: "Łódź", nick: "Studio Lot", price: null, status: "approved", created_at: inDays(-8), expires_at: inDays(52) },
    { id: "l4", category: "space", kind: "offer", title: "Wynajmę salę z punktami do zawieszenia (przykład)", description: "Wysokość 6 m, 4 punkty, materace. Wolne weekendy i poranki w tygodniu.", city: "Warszawa", nick: "Hala Wzlot", price: "80 zł / h", status: "approved", created_at: inDays(-9), expires_at: inDays(51) },
    { id: "l5", category: "gear", kind: "buy", title: "Szukam szarfy 9 m, najlepiej czerwonej (przykład)", description: "Może być używana, ważne żeby bez zaciągnięć. Odbiór w Krakowie albo wysyłka.", city: "Kraków", nick: "Ania", price: null, status: "approved", created_at: inDays(-1), expires_at: inDays(59) },
    { id: "l6", category: "gear", kind: "give", title: "Oddam kostium startowy, rozmiar S (przykład)", description: "Fioletowy, z cekinami, używany na dwóch zawodach.", city: "Wrocław", nick: "Kasia", price: null, status: "approved", created_at: inDays(-3), expires_at: inDays(57) },
  ];
  const publicStudios = () => state.studios.filter((s) => s.status === "approved" && s.lat != null);

  const DEMO_STUDIOS = [
    { id: "d1", name: "Studio Orbita (przykład)", city: "Warszawa", address: "ul. Przykładowa 1", lat: 52.19, lng: 21.0, disciplines: ["hoop", "silks", "hammock"], levels: ["beginner", "intermediate", "advanced"], kids: true, open_training: true, rental: true, verified: true, description: "Dwie sale, 9 punktów zawieszenia, wysokość 7 m. Open training w niedziele.", website_url: "https://example.com", instagram_url: "https://instagram.com/", status: "approved" },
    { id: "d2", name: "Lina i Koło (przykład)", city: "Warszawa", address: "", lat: 52.26, lng: 21.06, disciplines: ["rope", "hoop"], levels: ["beginner", "intermediate"], kids: false, verified: false, description: "Kameralne studio, grupy do 6 osób.", instagram_url: "https://instagram.com/", status: "approved" },
    { id: "d3", name: "Nad Wisłą Aerial (przykład)", city: "Kraków", address: "", lat: 50.04, lng: 19.96, disciplines: ["silks", "trapeze", "hoop"], levels: ["beginner", "intermediate", "advanced"], kids: true, rental: true, verified: true, description: "Sufit 8 m, kursy trapezu i przygotowanie do zawodów.", website_url: "https://example.com", status: "approved" },
    { id: "d4", name: "Wzlot (przykład)", city: "Wrocław", address: "", lat: 51.12, lng: 17.03, disciplines: ["hoop", "hammock"], levels: ["beginner"], kids: true, verified: true, description: "Joga w hamakach i koło, zajęcia dla dzieci od 7 lat.", website_url: "https://example.com", status: "approved" },
    { id: "d5", name: "Mewa Aerial (przykład)", city: "Gdańsk", address: "", lat: 54.38, lng: 18.6, disciplines: ["hoop", "silks"], levels: ["beginner", "intermediate"], kids: false, verified: false, description: "Zajęcia popołudniowe i weekendowe warsztaty.", facebook_url: "https://facebook.com/", status: "approved" },
  ];

  async function initDb() {
    if (DEMO) {
      // podgląd „Moich wpisów”: udajemy zalogowaną adminkę z kilkoma zgłoszeniami w kolejce
      const ago = (h) => new Date(Date.now() - h * 3600000).toISOString();
      state.user = { id: "demo", email: "demo@example.com" }; state.isAdmin = true;
      state.studios = [...DEMO_STUDIOS.map((x, i) => ({ ...x, created_at: ago(200 + i * 30), updated_at: ago(200 + i * 30) })),
        { id: "d9", name: "Nowe Studio (przykład zgłoszenia)", city: "Toruń", lat: 53.01, lng: 18.6, disciplines: ["silks"], levels: [], status: "pending", created_by: "u2", created_at: ago(5), updated_at: ago(5), website_url: "https://example.com" }];
      state.listings = [...DEMO_LISTINGS.map((x) => ({ ...x, created_by: x.id === "l1" ? "demo" : "u3", updated_at: x.created_at })),
        { id: "l9", category: "gear", kind: "sell", title: "Sprzedam koło 85 cm (przykład zgłoszenia)", description: "Stalowe, z taśmą, mało używane.", city: "Gdynia", nick: "Ola", price: "300 zł", status: "pending", created_by: "u4", created_at: ago(26), updated_at: ago(2), expires_at: inDays(60) }];
      state.makers = [...DEMO_MAKERS.map((x, i) => ({ ...x, created_at: ago(300 + i), updated_at: ago(300 + i) })),
        { id: "m9", name: "Szyjemy Stroje (przykład zgłoszenia)", city: "Kraków", products: ["costumes"], status: "pending", created_by: "u5", created_at: ago(50), updated_at: ago(50), instagram_url: "https://instagram.com/" }];
      state.loaded = state.listingsLoaded = state.makersLoaded = true;
      return;
    }
    state.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const { data } = await state.sb.auth.getSession();
    await setUser(data.session?.user || null);
    state.sb.auth.onAuthStateChange((_e, session) => {
      const u = session?.user || null;
      if ((u?.id || null) !== (state.user?.id || null)) setUser(u).then(() => Promise.all([loadStudios(), loadListings(), loadMakers()]).then(route));
    });
  }

  async function setUser(u) {
    state.user = u;
    state.isAdmin = false;
    if (u && state.sb) {
      const { data } = await state.sb.rpc("is_admin");
      state.isAdmin = data === true;
    }
    renderAccount();
  }

  async function loadStudios() {
    if (DEMO) return;
    const { data, error } = await state.sb.from("studios").select("*").order("name");
    state.loaded = true;
    if (error) { console.warn("studios:", error.message); state.loadFailed = true; state.studios = []; return; }
    state.loadFailed = false;
    state.studios = data || [];
  }

  async function loadListings() {
    if (DEMO) return;
    const { data, error } = await state.sb.from("listings").select("*").order("created_at", { ascending: false });
    state.listingsLoaded = true;
    if (error) { console.warn("listings:", error.message); state.listings = []; return; }
    state.listings = data || [];
    state.stats = {};
    if (state.user) {
      const { data: st } = await state.sb.rpc("my_listing_stats");
      (st || []).forEach((r) => { state.stats[r.listing_id] = r.messages; });
    }
  }

  async function loadMakers() {
    if (DEMO) return;
    const { data, error } = await state.sb.from("makers").select("*").order("name");
    state.makersLoaded = true;
    if (error) { console.warn("makers:", error.message); state.makers = []; return; }
    state.makers = data || [];
  }

  async function loadEvents() {
    if (DEMO || !state.sb) return;
    const { data, error } = await state.sb.from("events")
      .select("id,title,type,date_start,date_end,city,venue,reg_url")
      .eq("status", "approved").gte("date_end", todayISO())
      .order("date_start").limit(80);
    if (error) { console.warn("events:", error.message); return; }
    state.events = data || [];
  }

  function renderAccount() {
    const box = $("account");
    if (DEMO) { box.innerHTML = `<span class="badge warn">demo</span>`; return; }
    if (state.user) {
      box.innerHTML = `<span class="who">${esc(state.user.email)}</span><a href="/account/">${esc(t().mine)}</a><button type="button" class="link" id="logout">${esc(t().logout)}</button>`;
      $("logout").addEventListener("click", async () => { await state.sb.auth.signOut(); go("/"); });
    } else {
      box.innerHTML = `<a href="/account/">${esc(t().login)}</a>`;
    }
  }

  function loginPanel(title) {
    const wrap = document.createElement("div");
    wrap.className = "panel";
    wrap.innerHTML = `<h2>${esc(title)}</h2>
      <p class="muted" style="margin:0">${esc(t().loginLede)}</p>
      <form class="login" id="login-form" novalidate>
        <label for="login-email" class="small">${esc(t().emailLabel)}</label>
        <div class="login-row"><input id="login-email" type="email" autocomplete="email" required><button class="btn primary" type="submit">${esc(t().sendLink)}</button></div>
        <p class="small" style="margin:0">${esc(t().emailPrivate)}${privacyLink()}</p>
        <div id="login-msg"></div>
      </form>`;
    wrap.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("login-email").value.trim();
      const msg = $("login-msg");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.innerHTML = `<p class="msg bad">${esc(t().loginError)}</p>`; return; }
      if (DEMO) { msg.innerHTML = `<p class="msg warn">demo</p>`; return; }
      const { error } = await state.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true } });
      msg.innerHTML = error ? `<p class="msg bad">${esc(t().loginError)}</p>` : `<p class="msg ok">${esc(t().linkSent(email))}</p>`;
    });
    return wrap;
  }

  // ---------------- 3. Nawigacja ----------------
  // Jedna strona obsługuje wszystkie adresy (reguła w .htaccess kieruje /studios/…, /board/…
  // i /account/ do index.html). Stare polskie ścieżki (/studia/…) przekierowuje .htaccess. Linki wewnątrz przechodzą bez przeładowania (history.pushState).
  const VIEWS = ["home", "studia", "ogloszenia", "ogloszenie", "dodaj-ogloszenie", "dodaj-studio", "makers", "maker", "dodaj-producenta", "moje"];
  const keep = DEMO ? "?demo=1" : "";

  function go(path, replace = false) {
    if (path !== location.pathname) history[replace ? "replaceState" : "pushState"](null, "", path + keep);
    notice("");
    route();
    window.scrollTo({ top: 0 });
    if (/^\/studios\/(?!add|edit)[^/]+/.test(path) && !$("studio-profile").hidden) $("studio-profile").scrollIntoView({ block: "start" });
  }

  // stare adresy z # (pierwsza wersja strony, maile) → nowe ścieżki
  function legacyPath() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h || /access_token|error/.test(h)) return null;      // powrót z logowania: tym zajmuje się Supabase
    const fixed = { studia: "/studios/", ogloszenia: "/board/", moje: "/account/", "dodaj-studio": "/studios/add/", "dodaj-ogloszenie": "/board/add/", kalendarz: "/calendar/" };
    if (fixed[h]) return fixed[h];
    if (h.startsWith("studio-")) return "/studios/" + h.slice(7);
    if (h.startsWith("ogloszenie-")) return "/board/" + h.slice(11);
    if (h.startsWith("edytuj-ogl-")) return "/board/edit/" + h.slice(11);
    if (h.startsWith("edytuj-")) return "/studios/edit/" + h.slice(7);
    return null;
  }

  function route() {
    const old = legacyPath();
    if (old) {
      if (old.startsWith("/calendar")) { location.replace(old); return; }
      history.replaceState(null, "", old + keep);
    }
    const parts = location.pathname.split("/").filter(Boolean);
    let view = "home", id = null;
    if (parts[0] === "studios") {
      if (parts[1] === "add") view = "dodaj-studio";
      else if (parts[1] === "edit") { view = "dodaj-studio"; id = parts[2] || null; }
      else { view = "studia"; id = parts[1] || null; }
    } else if (parts[0] === "board") {
      if (parts[1] === "add") view = "dodaj-ogloszenie";
      else if (parts[1] === "edit") { view = "dodaj-ogloszenie"; id = parts[2] || null; }
      else if (parts[1]) { view = "ogloszenie"; id = parts[1]; }
      else view = "ogloszenia";
    } else if (parts[0] === "makers") {
      if (parts[1] === "add") view = "dodaj-producenta";
      else if (parts[1] === "edit") { view = "dodaj-producenta"; id = parts[2] || null; }
      else if (parts[1]) { view = "maker"; id = parts[1]; }
      else view = "makers";
    } else if (parts[0] === "account") view = "moje";

    VIEWS.forEach((v) => { $("view-" + v).hidden = v !== view; });
    const tab = view.includes("ogloszeni") ? "board" : view.includes("studi") ? "studios" : view.includes("produc") || view.startsWith("maker") ? "makers" : "";
    document.querySelectorAll(".sections a").forEach((a) => a.setAttribute("aria-selected", String(a.dataset.view === tab)));
    const titles = { home: t().brand, studia: t().tabStudios, ogloszenia: t().tabBoard, ogloszenie: t().tabBoard, "dodaj-ogloszenie": t().addListing.replace("+ ", ""), "dodaj-studio": t().addStudio.replace("+ ", ""), makers: t().tabMakers, maker: t().tabMakers, "dodaj-producenta": t().addMaker.replace("+ ", ""), moje: t().mine };
    let title = titles[view];

    if (view === "home") renderHome();
    else if (view === "studia") {
      const st = id ? findStudio(id) : null;
      state.current = st ? st.id : null;
      if (st) { title = st.name; if (location.pathname !== studioPath(st)) history.replaceState(null, "", studioPath(st) + keep); }
      renderStudios();
    }
    else if (view === "ogloszenia") renderBoard();
    else if (view === "ogloszenie") {
      const l = state.listingsLoaded ? findListing(id) : null;
      if (l) { title = l.title; if (location.pathname !== listingPath(l)) history.replaceState(null, "", listingPath(l) + keep); }
      renderListing(l);
    }
    else if (view === "dodaj-ogloszenie") renderListingForm(id);
    else if (view === "dodaj-studio") renderForm(id);
    else if (view === "makers") renderMakers();
    else if (view === "maker") {
      const m = state.makersLoaded ? findMaker(id) : null;
      if (m) { title = m.name; if (location.pathname !== makerPath(m)) history.replaceState(null, "", makerPath(m) + keep); }
      renderMaker(m);
    }
    else if (view === "dodaj-producenta") renderMakerForm(id);
    else if (view === "moje") renderMine();
    // adres kanoniczny = bieżąca ścieżka (bez ?demo i #), żeby Google nie dublował stron
    const canon = $("canonical"); if (canon) canon.href = "https://aerial.cyrkarium.com" + location.pathname;
    document.title = view === "home" ? `${t().brand} · Fundacja Cyrkarium` : `${title} · ${t().brand}`;
  }

  // ---------------- 4. Studia ----------------
  function matches(s) {
    const f = state.filter;
    if (f.disc !== "all" && !(s.disciplines || []).includes(f.disc)) return false;
    if (f.level && !(s.levels || []).includes(f.level)) return false;
    if (f.kids && !s.kids) return false;
    if (f.open && !s.open_training) return false;
    if (f.rental && !s.rental) return false;
    if (f.q) {
      const q = cityKey(f.q);
      if (!cityKey(s.name).includes(q) && !cityKey(s.city).includes(q)) return false;
    }
    return true;
  }

  function renderFilters() {
    const D = t().disciplines;
    $("disc-chips").innerHTML = [["all", t().all], ...Object.entries(D)]
      .map(([k, v]) => `<button type="button" class="chip" data-disc="${k}" aria-pressed="${state.filter.disc === k}">${esc(v)}</button>`).join("");
    const sel = $("f-level");
    sel.innerHTML = `<option value="">${esc(t().anyLevel)}</option>` + Object.entries(t().levels).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
    sel.value = state.filter.level;
    $("f-kids").checked = state.filter.kids;
    $("f-open").checked = state.filter.open;
    $("f-rental").checked = state.filter.rental;
  }

  function renderStudios() {
    renderFilters();
    const all = publicStudios();
    const list = all.filter(matches);
    $("studios-count").textContent = state.loadFailed ? t().loadError : t().studiosCount(all.length, new Set(all.map((s) => cityKey(s.city))).size);

    const box = $("studio-list");
    if (!state.loaded) box.innerHTML = "";
    else if (!all.length) box.innerHTML = `<div class="empty"><p>${esc(t().emptyMap)}</p><a class="btn primary" href="/studios/add/">${esc(t().addStudio)}</a></div>`;
    else if (!list.length) box.innerHTML = `<div class="empty"><p>${esc(t().noMatch)}</p><button type="button" class="btn ghost" id="clear-f">${esc(t().clearFilters)}</button></div>`;
    // prawdziwe linki (a nie przyciski), żeby Google widział profile studiów
    else box.innerHTML = list.map((s) => `<a class="st" href="${esc(studioPath(s))}" aria-current="${s.id === state.current}">
        <span class="st-head">${logoImg(s.logo_path, s.name, "logo sm")}<strong>${esc(s.name)}</strong>${s.verified ? `<span class="badge ok">✓ ${esc(t().verifiedShort)}</span>` : ""}</span>
        <span class="st-meta">${esc(s.city)}${s.address ? " · " + esc(s.address) : ""}</span>
        <span class="tags">${(s.disciplines || []).map((d) => `<span class="tag">${esc(t().disciplines[d] || d)}</span>`).join("")}${s.open_training ? `<span class="tag tag-extra">${esc(t().openTag)}</span>` : ""}${s.rental ? `<span class="tag tag-extra">${esc(t().rentalTag)}</span>` : ""}</span>
      </a>`).join("");
    $("clear-f")?.addEventListener("click", () => { state.filter = { disc: "all", q: "", level: "", kids: false, open: false, rental: false }; $("f-q").value = ""; renderStudios(); });

    renderMap(list);
    renderProfile();
  }

  // mapa: jedna pinezka na miejsce (studia z tymi samymi współrzędnymi łączą się w jedną z liczbą)
  let map = null, layer = null;
  function renderMap(list) {
    if (!window.L) return;
    if (!map) {
      map = L.map("map", { scrollWheelZoom: false }).setView([52.0, 19.2], 6);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: t().mapAttribution }).addTo(map);
      layer = L.layerGroup().addTo(map);
      map.attributionControl.setPrefix(false);
      // mapa przelicza rozmiar, gdy jej pudełko się zmienia (ukryta zakładka, obrót telefonu)
      if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize()).observe($("map"));
    }
    map.invalidateSize();
    layer.clearLayers();
    const groups = new Map();
    list.forEach((s) => {
      const k = s.lat.toFixed(3) + "," + s.lng.toFixed(3);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(s);
    });
    const bounds = [];
    groups.forEach((g) => {
      const on = g.some((s) => s.id === state.current);
      const n = g.length;
      const icon = L.divIcon({ className: "pin" + (on ? " on" : ""), html: `<span>${n > 1 ? n : ""}</span>`, iconSize: [n > 1 ? 30 : 22, n > 1 ? 30 : 22] });
      const m = L.marker([g[0].lat, g[0].lng], { icon, title: g.map((s) => s.name).join(", "), keyboard: true });
      if (n === 1) m.on("click", () => openStudio(g[0].id));
      else {
        const pop = document.createElement("div");
        pop.className = "pop";
        pop.innerHTML = `<small>${esc(g[0].city)} · ${esc(t().studiosInCity(n))}</small>` + g.map((s) => `<button type="button" data-st="${esc(s.id)}">${esc(s.name)}</button>`).join("");
        m.bindPopup(pop);
      }
      m.addTo(layer);
      bounds.push([g[0].lat, g[0].lng]);
    });
    if (!state.current) {
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 11 });
      else if (bounds.length === 1) map.setView(bounds[0], 11);
      else map.setView([52.0, 19.2], 6);
    }
  }

  function openStudio(id) {
    const st = state.studios.find((x) => String(x.id) === String(id));
    if (st) go(studioPath(st));
  }

  function renderProfile() {
    const box = $("studio-profile");
    const s = state.studios.find((x) => String(x.id) === String(state.current));
    if (!s) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    if (map && s.lat != null) map.setView([s.lat, s.lng], Math.max(map.getZoom(), 12));
    const links = [["website_url", t().website, "primary"], ["instagram_url", t().instagram, "ghost"], ["facebook_url", t().facebook, "ghost"]]
      .filter(([k]) => safeUrl(s[k]))
      .map(([k, label, kind]) => `<a class="btn ${kind}" href="${esc(safeUrl(s[k]))}" target="_blank" rel="noopener nofollow">${esc(label)} ↗</a>`).join("");
    const evs = state.events.filter((e) => cityKey(e.city) === cityKey(s.city)).slice(0, 4);
    const levels = (s.levels || []).map((l) => t().levels[l]).filter(Boolean);
    box.innerHTML = `<div>
        <div class="profile-top">
          ${s.verified ? `<span class="badge ok">${esc(t().verified)}</span>` : `<span class="badge warn">${esc(t().community)}</span>`}
          ${s.status !== "approved" ? `<span class="badge bad">${esc(t().status[s.status])}</span>` : ""}
          <span class="small">${esc(s.city)}${s.address ? " · " + esc(s.address) : ""}</span>
        </div>
        <div class="profile-title">${logoImg(s.logo_path, s.name, "logo big")}<h2>${esc(s.name)}</h2></div>
        ${s.description ? `<p>${esc(s.description)}</p>` : ""}
        <div class="tags">${(s.disciplines || []).map((d) => `<span class="tag">${esc(t().disciplines[d] || d)}</span>`).join("")}${levels.map((l) => `<span class="tag">${esc(l)}</span>`).join("")}${s.kids ? `<span class="tag">${esc(t().kids)}</span>` : ""}${s.open_training ? `<span class="tag">${esc(t().openTag)}</span>` : ""}${s.rental ? `<span class="tag">${esc(t().rentalTag)}</span>` : ""}</div>
        ${links ? `<div class="links">${links}</div>` : ""}
        <p class="small">${esc(t().noContactNote)}</p>
        ${s.verified ? "" : `<div class="empty"><strong>${esc(t().claimTitle)}</strong><p class="small">${esc(t().claimText)} <span style="user-select:all">${esc(t().claimMail)}</span></p></div>`}
        ${state.isAdmin && s.status === "approved" ? `<div class="form-actions"><button type="button" class="btn ghost" data-verify="${esc(s.id)}">${esc(s.verified ? t().unmarkVerified : t().markVerified)}</button><a class="btn ghost" href="/studios/edit/${esc(s.id)}">${esc(t().edit)}</a></div>` : ""}
      </div>
      <div>
        <div class="linked"><h3>${esc(t().eventsHere(s.city))}</h3>
          ${evs.length ? evs.map(eventRow).join("") : `<p class="small">${esc(t().noEventsHere)}</p>`}
          <a class="small" href="${esc(CFG.eventsUrl)}/#add" target="_blank" rel="noopener">${esc(t().addEventLink)} ↗</a>
        </div>
        <button type="button" class="btn ghost" id="close-profile" style="align-self:flex-start">${esc(t().closeProfile)}</button>
      </div>`;
    $("close-profile").addEventListener("click", () => go("/studios/"));
  }

  // ---------------- 5. Kalendarz ----------------
  function dateBox(iso) {
    const d = new Date(iso + "T12:00:00");
    return `<span class="d">${d.getDate()}<small>${esc(d.toLocaleDateString(t().locale, { month: "short" }).replace(".", ""))}</small></span>`;
  }
  function eventRow(e) {
    const url = safeUrl(e.reg_url) || CFG.eventsUrl;
    return `<a class="ev" href="${esc(url)}" target="_blank" rel="noopener nofollow">${dateBox(e.date_start)}<span class="ev-text"><strong>${esc(e.title)}</strong><span>${esc(e.city)}${e.venue ? " · " + esc(e.venue) : ""}</span></span></a>`;
  }
  function renderHome() {
    const set = (id, n, ready) => { $(id).textContent = ready ? String(n) : "–"; };
    set("n-events", state.events.length, state.loaded);
    set("n-studios", publicStudios().length, state.loaded);
    set("n-listings", state.listings.filter(isLive).length, state.listingsLoaded);
    set("n-makers", state.makers.filter((m) => m.status === "approved").length, state.makersLoaded);
  }

  // ---------------- 5b. Ogłoszenia ----------------
  // kategoria (czego dotyczy) + rodzaj (co robi autor), np. [Sprzęt i stroje] Sprzedam
  function catTag(c) { return `<span class="cat cat-${esc(c)}">${esc(t().cats[c] || c)}</span>`; }
  const kindLabel = (l) => (t().kinds[l.category] || {})[l.kind] || "";
  const listingTag = (l) => `<span class="tag-row">${catTag(l.category)}<span class="kind">${esc(kindLabel(l))}</span></span>`;
  const hasPrice = (kind) => kind === "sell" || kind === "offer";
  const priceHtml = (l) => l.kind === "give" ? `<span class="price free">${esc(t().free)}</span>` : l.price ? `<span class="price">${esc(l.price)}</span>` : "";

  function renderBoard() {
    $("cat-chips").innerHTML = [["all", t().all], ...Object.entries(t().cats)]
      .map(([k, v]) => `<button type="button" class="chip" data-lcat="${k}" aria-pressed="${state.lfilter.cat === k}">${esc(v)}</button>`).join("");
    // druga linia filtrów: rodzaje w wybranej kategorii (gdy jest z czego wybierać)
    const F = state.lfilter;
    const kinds = F.cat === "all" ? {} : (t().kinds[F.cat] || {});
    const kbox = $("kind-chips");
    kbox.hidden = Object.keys(kinds).length < 2;
    kbox.innerHTML = kbox.hidden ? "" : [["all", t().all], ...Object.entries(kinds)]
      .map(([k, v]) => `<button type="button" class="chip" data-lkind="${k}" aria-pressed="${F.kind === k}">${esc(v)}</button>`).join("");
    const live = state.listings.filter(isLive);
    const q = cityKey(F.q);
    const list = live.filter((l) => (F.cat === "all" || l.category === F.cat)
      && (F.kind === "all" || l.kind === F.kind)
      && (!q || cityKey(l.title + " " + l.description + " " + l.city).includes(q)));
    const box = $("listing-grid");
    if (!state.listingsLoaded) { box.innerHTML = ""; return; }
    if (!live.length) { box.innerHTML = `<div class="empty"><p>${esc(t().boardEmpty)}</p><a class="btn primary" href="/board/add/">${esc(t().addListing)}</a></div>`; return; }
    if (!list.length) { box.innerHTML = `<div class="empty"><p>${esc(t().boardNoMatch)}</p></div>`; return; }
    const now = new Date();
    box.innerHTML = list.map((l) => `<article class="card">
      <div class="card-top">${listingTag(l)}<span>${esc(t().ago(daysBetween(new Date(l.created_at), now)))}</span></div>
      <h3>${esc(l.title)}</h3>
      <p>${esc(l.description)}</p>
      <div class="card-foot"><span class="who">${esc(l.nick)} · ${esc(l.city)}${priceHtml(l) ? " · " + priceHtml(l) : ""}</span>
        <a class="btn primary" href="${esc(listingPath(l))}">${esc(t().write)}</a></div>
    </article>`).join("");
  }

  function renderListing(l) {
    const box = $("listing-box");
    const back = `<a class="back" href="/board/">${esc(t().backToBoard)}</a>`;
    if (!state.listingsLoaded) { box.innerHTML = back; return; }
    if (!l) { box.innerHTML = `<div class="view">${back}<p class="msg warn">${esc(t().listingGone)}</p></div>`; return; }
    const own = state.user && l.created_by === state.user.id;
    const left = daysBetween(new Date(), new Date(l.expires_at)) + 1;
    const meta = [l.nick, l.city, t().ago(daysBetween(new Date(l.created_at), new Date())), isLive(l) ? t().expiresIn(left) : t().lStatus[l.status]].map(esc).join(" · ");
    const report = `mailto:office@cyrkarium.com?subject=${encodeURIComponent(t().reportSubject + " " + l.id)}`;
    let form;
    if (own) form = `<div class="panel"><p class="msg ok">${esc(t().ownListing)}</p><a class="btn ghost" href="/account/">${esc(t().mine)}</a></div>`;
    else if (!isLive(l)) form = `<div class="panel"><p class="msg warn">${esc(t().mErrClosed)}</p></div>`;
    else form = `<form class="panel" id="msg-form" novalidate>
      <h2>${esc(t().writeTo(l.nick))}</h2>
      <div class="field"><label class="req" for="m-name">${esc(t().mName)}</label><input id="m-name" maxlength="60" autocomplete="given-name"></div>
      <div class="field"><label class="req" for="m-mail">${esc(t().mEmail)}</label><input id="m-mail" type="email" maxlength="200" autocomplete="email"></div>
      <div class="field"><label class="req" for="m-text">${esc(t().mText)}</label><textarea id="m-text" maxlength="2000"></textarea></div>
      <label class="toggle"><input type="checkbox" id="m-ok"> <span class="small req">${esc(t().mConsent)}</span></label>
      <div id="m-status"></div>
      <button type="submit" class="btn primary" id="m-send">${esc(t().mSend)}</button>
      <p class="small" style="margin:0">${esc(t().mHint)}${privacyLink()}</p>
    </form>`;
    box.innerHTML = `<div class="view">${back}<div class="detail">
      <section class="panel">
        <div>${listingTag(l)}</div>
        <h1>${esc(l.title)}</h1>
        <p class="small" style="margin:0">${meta}${priceHtml(l) ? ` · <strong>${priceHtml(l)}</strong>` : ""}</p>
        <p class="desc">${esc(l.description)}</p>
        <a class="small" href="${esc(report)}">${esc(t().report)}</a>
      </section>${form}</div></div>`;

    $("msg-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const st = $("m-status");
      const fail = (m) => { st.innerHTML = `<p class="msg bad" role="alert">${esc(m)}</p>`; };
      const row = { listing_id: l.id, sender_name: $("m-name").value.trim(), sender_email: $("m-mail").value.trim(), message: $("m-text").value.trim(), consent: $("m-ok").checked, lang };
      if (!row.sender_name || !row.sender_email || row.message.length < 5 || !row.consent) return fail(t().mErrRequired);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(row.sender_email)) return fail(t().mErrEmail);
      const btn = $("m-send"); btn.disabled = true;
      if (DEMO) { st.innerHTML = `<p class="msg ok">${esc(t().mSent(l.nick))} (demo)</p>`; return; }
      const { error } = await state.sb.from("listing_messages").insert(row);
      if (error) {
        btn.disabled = false;
        console.warn(error);
        return fail(/too_many/.test(error.message) ? t().mErrTooMany : /listing_closed/.test(error.message) ? t().mErrClosed : t().errSave);
      }
      $("msg-form").innerHTML = `<p class="msg ok">${esc(t().mSent(l.nick))}</p>`;
    });
  }

  function renderListingForm(id) {
    const box = $("listing-form-box");
    box.innerHTML = "";
    if (!DEMO && !state.user) { box.appendChild(loginPanel(t().lLoginTitle)); return; }
    const l = id ? state.listings.find((x) => String(x.id) === String(id)) : null;
    const v = l || { category: "", nick: "" };
    box.innerHTML = `<form class="panel" id="listing-form" novalidate>
      <h2>${esc(l ? t().lFormEdit : t().lFormNew)}</h2>
      <p class="muted" style="margin:0">${esc(t().lFormLede)}</p>
      <div class="field"><label class="req" for="f-cat">${esc(t().lCat)}</label><select id="f-cat"><option value=""></option>${Object.entries(t().cats).map(([k, c]) => `<option value="${k}"${v.category === k ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
      <div class="field"><span class="label req" id="f-kind-label">${esc(t().lKind)}</span><div class="checks" id="f-kind" role="radiogroup" aria-labelledby="f-kind-label"></div></div>
      <div class="field"><label class="req" for="f-title">${esc(t().lTitle)}</label><input id="f-title" maxlength="120" value="${esc(v.title)}"></div>
      <div class="field"><label class="req" for="f-desc">${esc(t().lDesc)}</label><textarea id="f-desc" maxlength="1500">${esc(v.description)}</textarea><p class="hint">${esc(t().lDescHint)}</p></div>
      <div id="f-alert"></div>
      <div class="row2">
        <div class="field"><label class="req" for="f-nick">${esc(t().lNick)}</label><input id="f-nick" maxlength="40" value="${esc(v.nick)}"></div>
        <div class="field"><label class="req" for="f-city">${esc(t().lCity)}</label><input id="f-city" maxlength="60" value="${esc(v.city)}"></div>
      </div>
      <div class="field" id="f-price-wrap"><label for="f-price">${esc(t().lPrice)}</label><input id="f-price" maxlength="40" placeholder="${esc(t().lPricePh)}" value="${esc(v.price)}"></div>
      <p class="small" style="margin:0">${esc(t().emailPrivate)}${privacyLink()}</p>
      <div id="f-msg"></div>
      <div class="form-actions"><button type="submit" class="btn primary" id="f-submit">${esc(t().lSubmit)}</button><a class="btn ghost" href="${l ? "/account/" : "/board/"}">${esc(t().cancel)}</a></div>
    </form>`;

    // rodzaj zależy od kategorii; cena tylko przy „sprzedam” i „wynajmę / oferuję”
    let kind = v.kind || "";
    const drawKinds = () => {
      const opts = t().kinds[$("f-cat").value] || {};
      if (!opts[kind]) kind = Object.keys(opts).length === 1 ? Object.keys(opts)[0] : "";
      $("f-kind").innerHTML = Object.keys(opts).length
        ? Object.entries(opts).map(([k, lab]) => `<label><input type="radio" name="f-kind" value="${k}"${k === kind ? " checked" : ""}> ${esc(lab)}</label>`).join("")
        : `<span class="small">${esc(t().lKindPick)}</span>`;
      $("f-price-wrap").hidden = !hasPrice(kind);
    };
    $("f-cat").addEventListener("change", drawKinds);
    $("f-kind").addEventListener("change", (e) => { kind = e.target.value; $("f-price-wrap").hidden = !hasPrice(kind); });
    drawKinds();

    const fields = ["f-title", "f-desc", "f-nick", "f-price"];
    const check = () => {
      const found = [...new Set(fields.flatMap((f) => contactInText($(f).value)))];
      fields.forEach((f) => $(f).classList.toggle("err", contactInText($(f).value).length > 0));
      $("f-alert").innerHTML = found.length ? `<p class="msg bad" role="alert">${esc(t().lErrContact(found.join(t().and)))}</p>` : "";
      return found;
    };
    fields.forEach((f) => $(f).addEventListener("input", check));
    if (l) check();

    $("listing-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("f-msg");
      const fail = (m) => { msg.innerHTML = `<p class="msg bad" role="alert">${esc(m)}</p>`; };
      const val = (id) => $(id).value.trim();
      const row = { category: val("f-cat"), kind, title: val("f-title"), description: val("f-desc"), nick: val("f-nick"), city: val("f-city"), price: hasPrice(kind) ? val("f-price") || null : null };
      if (!row.category || !row.kind || row.title.length < 5 || row.description.length < 10 || row.nick.length < 2 || row.city.length < 2) return fail(t().lErrRequired);
      const found = check();
      if (found.length) return fail(t().lErrContact(found.join(t().and)));
      if (DEMO) { msg.innerHTML = `<p class="msg ok">${esc(t().lSaved)} (demo)</p>`; return; }
      const btn = $("f-submit"); btn.disabled = true; btn.textContent = t().saving;
      const { error } = l ? await state.sb.from("listings").update(row).eq("id", l.id) : await state.sb.from("listings").insert(row);
      btn.disabled = false; btn.textContent = t().lSubmit;
      if (error) { console.warn(error); return fail(error.code === "P0001" ? error.message : /no_contact/.test(error.message) ? t().lErrContact(t().phone + t().and + t().email) : t().errSave); }
      await loadListings();
      go("/account/");
      notice(t().lSaved);
    });
  }

  // ---------------- 5c. Producenci ----------------
  const makerTags = (m) => (m.products || []).map((p) => `<span class="tag">${esc(t().products[p] || p)}</span>`).join("")
    + (m.custom_orders ? `<span class="tag tag-extra">${esc(t().customTag)}</span>` : "")
    + (m.ships_abroad ? `<span class="tag tag-extra">${esc(t().abroadTag)}</span>` : "");

  function renderMakers() {
    const F = state.mfilter;
    $("prod-chips").innerHTML = [["all", t().all], ...Object.entries(t().products)]
      .map(([k, v]) => `<button type="button" class="chip" data-prod="${k}" aria-pressed="${F.prod === k}">${esc(v)}</button>`).join("");
    $("m-custom").checked = F.custom; $("m-abroad").checked = F.abroad;
    const all = state.makers.filter((m) => m.status === "approved");
    $("makers-count").textContent = t().makersCount(all.length);
    const q = cityKey(F.q);
    const list = all.filter((m) => (F.prod === "all" || (m.products || []).includes(F.prod))
      && (!F.custom || m.custom_orders) && (!F.abroad || m.ships_abroad)
      && (!q || cityKey(m.name + " " + m.city + " " + (m.description || "")).includes(q)));
    const box = $("maker-grid");
    if (!state.makersLoaded) { box.innerHTML = ""; return; }
    if (!all.length) { box.innerHTML = `<div class="empty"><p>${esc(t().makersEmpty)}</p><a class="btn primary" href="/makers/add/">${esc(t().addMaker)}</a></div>`; return; }
    if (!list.length) { box.innerHTML = `<div class="empty"><p>${esc(t().makersNoMatch)}</p></div>`; return; }
    box.innerHTML = list.map((m) => `<a class="card maker-card" href="${esc(makerPath(m))}">
      <div class="card-top"><span>${esc(m.city)}</span>${m.verified ? `<span class="badge ok">✓ ${esc(t().verifiedShort)}</span>` : ""}</div>
      <div class="maker-head">${logoImg(m.logo_path, m.name)}<h3>${esc(m.name)}</h3></div>
      ${m.description ? `<p>${esc(m.description)}</p>` : ""}
      <span class="tags">${makerTags(m)}</span>
    </a>`).join("");
  }

  function renderMaker(m) {
    const box = $("maker-box");
    const back = `<a class="back" href="/makers/">${esc(t().backToMakers)}</a>`;
    if (!state.makersLoaded) { box.innerHTML = back; return; }
    if (!m) { box.innerHTML = `<div class="view">${back}<p class="msg warn">${esc(t().makerGone)}</p></div>`; return; }
    const links = [["shop_url", t().shop, "primary"], ["website_url", t().website, m.shop_url ? "ghost" : "primary"], ["instagram_url", t().instagram, "ghost"], ["facebook_url", t().facebook, "ghost"]]
      .filter(([k]) => safeUrl(m[k]))
      .map(([k, label, kind]) => `<a class="btn ${kind}" href="${esc(safeUrl(m[k]))}" target="_blank" rel="noopener nofollow">${esc(label)} ↗</a>`).join("");
    box.innerHTML = `<div class="view">${back}<section class="profile">
      <div>
        <div class="profile-top">
          ${m.verified ? `<span class="badge ok">${esc(t().makerVerified)}</span>` : `<span class="badge warn">${esc(t().community)}</span>`}
          ${m.status !== "approved" ? `<span class="badge bad">${esc(t().status[m.status])}</span>` : ""}
          <span class="small">${esc(m.city)}</span>
        </div>
        <div class="profile-title">${logoImg(m.logo_path, m.name, "logo big")}<h2>${esc(m.name)}</h2></div>
        ${m.description ? `<p>${esc(m.description)}</p>` : ""}
        <div class="tags">${makerTags(m)}</div>
        ${links ? `<div class="links">${links}</div>` : ""}
        <p class="small">${esc(t().makerNoContact)}</p>
        ${state.isAdmin && m.status === "approved" ? `<div class="form-actions"><button type="button" class="btn ghost" data-kverify="${esc(m.id)}">${esc(m.verified ? t().unmarkVerified : t().markVerified)}</button><a class="btn ghost" href="/makers/edit/${esc(m.id)}">${esc(t().edit)}</a></div>` : ""}
      </div>
      <div>
        ${m.verified ? "" : `<div class="empty"><strong>${esc(t().makerClaimTitle)}</strong><p class="small">${esc(t().makerClaimText)} <span style="user-select:all">${esc(t().claimMail)}</span></p></div>`}
      </div>
    </section></div>`;
  }

  function renderMakerForm(id) {
    const box = $("maker-form-box");
    box.innerHTML = "";
    if (!DEMO && !state.user) { box.appendChild(loginPanel(t().mLoginTitle)); return; }
    const m = id ? state.makers.find((x) => String(x.id) === String(id)) : null;
    const v = m || { products: [] };
    box.innerHTML = `<form class="panel" id="maker-form" novalidate>
      <h2>${esc(m ? t().mFormEdit : t().mFormNew)}</h2>
      <p class="muted" style="margin:0">${esc(t().mFormLede)}</p>
      <div class="row2">
        <div class="field"><label class="req" for="k-name">${esc(t().mfName)}</label><input id="k-name" maxlength="100" value="${esc(v.name)}"></div>
        <div class="field"><label class="req" for="k-city">${esc(t().fCity)}</label><input id="k-city" maxlength="60" value="${esc(v.city)}"></div>
      </div>
      <div class="field"><span class="label req">${esc(t().mfProducts)}</span><div class="checks">${Object.entries(t().products).map(([k, l]) => `<label><input type="checkbox" name="prod" value="${k}"${(v.products || []).includes(k) ? " checked" : ""}> ${esc(l)}</label>`).join("")}</div></div>
      <div class="field"><span class="label">${esc(t().mfExtras)}</span>
        <label class="toggle"><input type="checkbox" id="k-custom"${v.custom_orders ? " checked" : ""}> <span>${esc(t().mfCustom)}</span></label>
        <label class="toggle"><input type="checkbox" id="k-abroad"${v.ships_abroad ? " checked" : ""}> <span>${esc(t().mfAbroad)}</span></label>
      </div>
      <div class="field"><label for="k-desc">${esc(t().fDesc)}</label><textarea id="k-desc" maxlength="1200">${esc(v.description)}</textarea><p class="hint">${esc(t().mfDescHint)}</p></div>
      <div id="k-alert"></div>
      ${logoField("k", v.logo_path, v.name)}
      <div class="row2">
        <div class="field"><label for="k-web">${esc(t().fWebsite)}</label><input id="k-web" type="url" inputmode="url" placeholder="https://" value="${esc(v.website_url)}"></div>
        <div class="field"><label for="k-shop">${esc(t().mfShop)}</label><input id="k-shop" type="url" inputmode="url" placeholder="https://" value="${esc(v.shop_url)}"></div>
      </div>
      <div class="row2">
        <div class="field"><label for="k-ig">${esc(t().fInstagram)}</label><input id="k-ig" type="url" inputmode="url" placeholder="https://instagram.com/…" value="${esc(v.instagram_url)}"></div>
        <div class="field"><label for="k-fb">${esc(t().fFacebook)}</label><input id="k-fb" type="url" inputmode="url" placeholder="https://facebook.com/…" value="${esc(v.facebook_url)}"></div>
      </div>
      <p class="hint req" style="margin:0">${esc(t().fLinksHint)}</p>
      <label class="toggle"><input type="checkbox" id="k-consent"${m ? " checked" : ""}> <span class="small req">${esc(t().fConsent)}</span></label>
      <div id="k-msg"></div>
      <div class="form-actions"><button type="submit" class="btn primary" id="k-submit">${esc(t().submit)}</button><a class="btn ghost" href="${m ? "/account/" : "/makers/"}">${esc(t().cancel)}</a></div>
    </form>`;

    const desc = $("k-desc");
    const checkDesc = () => {
      const found = contactInText(desc.value);
      desc.classList.toggle("err", found.length > 0);
      $("k-alert").innerHTML = found.length ? `<p class="msg bad" role="alert">${esc(t().errContact(found.join(t().and)))}</p>` : "";
      return found.length === 0;
    };
    desc.addEventListener("input", checkDesc);

    $("maker-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("k-msg");
      const fail = (text) => { msg.innerHTML = `<p class="msg bad" role="alert">${esc(text)}</p>`; };
      const val = (id) => $(id).value.trim();
      const row = {
        name: val("k-name"), city: val("k-city"),
        products: [...document.querySelectorAll('input[name="prod"]:checked')].map((i) => i.value),
        custom_orders: $("k-custom").checked, ships_abroad: $("k-abroad").checked,
        description: val("k-desc") || null,
        website_url: val("k-web") || null, shop_url: val("k-shop") || null, instagram_url: val("k-ig") || null, facebook_url: val("k-fb") || null,
      };
      const urls = [row.website_url, row.shop_url, row.instagram_url, row.facebook_url].filter(Boolean);
      if (row.name.length < 2 || row.city.length < 2 || !row.products.length || !urls.length) return fail(t().mfErrRequired);
      if (urls.some((u) => !/^https:\/\/[^\s.]+\.[^\s]+$/i.test(u))) return fail(t().errUrl);
      if (!checkDesc()) return fail(t().errContact(contactInText(row.description).join(t().and)));
      if (!$("k-consent").checked) return fail(t().errConsent);
      if (DEMO) { msg.innerHTML = `<p class="msg ok">${esc(t().mSaved)} (demo)</p>`; return; }
      const btn = $("k-submit"); btn.disabled = true; btn.textContent = t().saving;
      let logo;
      try { logo = await prepareLogo("k", m?.logo_path); } catch (err) { btn.disabled = false; btn.textContent = t().submit; return fail(err.message === "type" ? t().errLogoType : t().errLogo); }
      row.logo_path = logo.logo_path;
      const { error } = m ? await state.sb.from("makers").update(row).eq("id", m.id) : await state.sb.from("makers").insert(row);
      btn.disabled = false; btn.textContent = t().submit;
      if (error) { console.warn(error); if (logo.logo_path !== (m?.logo_path || null)) dropLogo(logo.logo_path); return fail(error.code === "P0001" ? error.message : t().errSave); }
      if (logo.old && logo.old !== logo.logo_path) dropLogo(logo.old);
      await loadMakers();
      go("/account/");
      notice(t().mSaved);
    });
  }

  // ---------------- 6. Formularz studia ----------------
  const NOMINATIM = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pl&accept-language=pl&q=";
  async function geocode(q) {
    try {
      const r = await fetch(NOMINATIM + encodeURIComponent(q));
      const j = await r.json();
      return Array.isArray(j) && j[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon) } : null;
    } catch { return undefined; }
  }

  function renderForm(id) {
    const box = $("add-box");
    box.innerHTML = "";
    if (!DEMO && !state.user) { box.appendChild(loginPanel(t().loginTitle)); return; }
    const s = id ? state.studios.find((x) => String(x.id) === String(id)) : null;
    const v = s || { disciplines: [], levels: [], kids: false };
    const checks = (name, dict, sel) => `<div class="checks">${Object.entries(dict).map(([k, l]) => `<label><input type="checkbox" name="${name}" value="${k}"${(sel || []).includes(k) ? " checked" : ""}> ${esc(l)}</label>`).join("")}</div>`;
    box.innerHTML = `<form class="panel" id="studio-form" novalidate>
      <h2>${esc(s ? t().formTitleEdit : t().formTitleNew)}</h2>
      <p class="muted" style="margin:0">${esc(t().formLede)}</p>
      <div class="field"><label class="req" for="s-name">${esc(t().fName)}</label><input id="s-name" maxlength="100" value="${esc(v.name)}"></div>
      <div class="row2">
        <div class="field"><label class="req" for="s-city">${esc(t().fCity)}</label><input id="s-city" maxlength="60" value="${esc(v.city)}"></div>
        <div class="field"><label for="s-address">${esc(t().fAddress)}</label><input id="s-address" maxlength="160" value="${esc(v.address)}"><p class="hint">${esc(t().fAddressHint)}</p></div>
      </div>
      <div class="field"><span class="label req">${esc(t().fDisc)}</span>${checks("disc", t().disciplines, v.disciplines)}</div>
      <div class="field"><span class="label">${esc(t().fLevels)}</span>${checks("lvl", t().levels, v.levels)}</div>
      <div class="field"><span class="label">${esc(t().fExtras)}</span>
        <label class="toggle"><input type="checkbox" id="s-kids"${v.kids ? " checked" : ""}> <span>${esc(t().fKids)}</span></label>
        <label class="toggle"><input type="checkbox" id="s-open"${v.open_training ? " checked" : ""}> <span>${esc(t().fOpen)}</span></label>
        <label class="toggle"><input type="checkbox" id="s-rental"${v.rental ? " checked" : ""}> <span>${esc(t().fRental)}</span></label>
      </div>
      <div class="field"><label for="s-desc">${esc(t().fDesc)}</label><textarea id="s-desc" maxlength="1200">${esc(v.description)}</textarea><p class="hint">${esc(t().fDescHint)}</p></div>
      <div id="desc-alert"></div>
      ${logoField("s", v.logo_path, v.name)}
      <div class="field"><label for="s-web">${esc(t().fWebsite)}</label><input id="s-web" type="url" inputmode="url" placeholder="https://" value="${esc(v.website_url)}"></div>
      <div class="row2">
        <div class="field"><label for="s-ig">${esc(t().fInstagram)}</label><input id="s-ig" type="url" inputmode="url" placeholder="https://instagram.com/…" value="${esc(v.instagram_url)}"></div>
        <div class="field"><label for="s-fb">${esc(t().fFacebook)}</label><input id="s-fb" type="url" inputmode="url" placeholder="https://facebook.com/…" value="${esc(v.facebook_url)}"></div>
      </div>
      <p class="hint req" style="margin:0">${esc(t().fLinksHint)}</p>
      <label class="toggle"><input type="checkbox" id="s-consent"${s ? " checked" : ""}> <span class="small req">${esc(t().fConsent)}</span></label>
      <div id="form-msg"></div>
      <div class="form-actions"><button type="submit" class="btn primary" id="s-submit">${esc(t().submit)}</button><a class="btn ghost" href="${s ? "/account/" : "/studios/"}">${esc(t().cancel)}</a></div>
    </form>`;

    const desc = $("s-desc");
    const checkDesc = () => {
      const found = contactInText(desc.value);
      desc.classList.toggle("err", found.length > 0);
      $("desc-alert").innerHTML = found.length ? `<p class="msg bad" role="alert">${esc(t().errContact(found.join(t().and)))}</p>` : "";
      return found.length === 0;
    };
    desc.addEventListener("input", checkDesc);

    $("studio-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("form-msg");
      const val = (id) => $(id).value.trim();
      const picked = (name) => [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);
      const row = {
        name: val("s-name"), city: val("s-city"), address: val("s-address") || null,
        disciplines: picked("disc"), levels: picked("lvl"), kids: $("s-kids").checked,
        open_training: $("s-open").checked, rental: $("s-rental").checked,
        description: val("s-desc") || null,
        website_url: val("s-web") || null, instagram_url: val("s-ig") || null, facebook_url: val("s-fb") || null,
      };
      const urls = [row.website_url, row.instagram_url, row.facebook_url].filter(Boolean);
      const fail = (text) => { msg.innerHTML = `<p class="msg bad" role="alert">${esc(text)}</p>`; };
      if (row.name.length < 2 || row.city.length < 2 || !row.disciplines.length || !urls.length) return fail(t().errRequired);
      if (urls.some((u) => !/^https:\/\/[^\s.]+\.[^\s]+$/i.test(u))) return fail(t().errUrl);
      if (!checkDesc()) return fail(t().errContact(contactInText(row.description).join(t().and)));
      if (!$("s-consent").checked) return fail(t().errConsent);

      const btn = $("s-submit");
      btn.disabled = true; btn.textContent = t().saving;
      const done = () => { btn.disabled = false; btn.textContent = t().submit; };

      // pinezka: adres + miasto, a gdy się nie znajdzie, samo miasto
      const placeChanged = !s || s.city !== row.city || (s.address || null) !== row.address || s.lat == null;
      if (placeChanged) {
        let hit = row.address ? await geocode(`${row.address}, ${row.city}`) : null;
        if (!hit) hit = await geocode(row.city);
        if (!hit) { done(); return fail(t().errGeo); }
        row.lat = hit.lat; row.lng = hit.lng;
      }

      if (DEMO) { done(); msg.innerHTML = `<p class="msg warn">demo: ${esc(JSON.stringify({ lat: row.lat, lng: row.lng }))}</p>`; return; }
      let logo;
      try { logo = await prepareLogo("s", s?.logo_path); } catch (err) { done(); return fail(err.message === "type" ? t().errLogoType : t().errLogo); }
      row.logo_path = logo.logo_path;
      const q = s ? state.sb.from("studios").update(row).eq("id", s.id) : state.sb.from("studios").insert(row);
      const { error } = await q;
      done();
      if (error) { console.warn(error); if (logo.logo_path !== (s?.logo_path || null)) dropLogo(logo.logo_path); return fail(error.code === "P0001" ? error.message : t().errSave); }
      if (logo.old && logo.old !== logo.logo_path) dropLogo(logo.old);
      await loadStudios();
      go("/account/");
      notice(t().saved);
    });
  }

  // ---------------- 7. Moje studia i moderacja ----------------
  function mineRow(s, admin) {
    const st = s.status;
    const kind = st === "approved" ? "ok" : st === "pending" ? "warn" : "bad";
    return `<div class="mine-row">
      <div class="mine-head"><span class="mine-name">${logoImg(s.logo_path, s.name, "logo sm")}<strong>${esc(s.name)}</strong></span><span class="badge ${kind}">${esc(t().status[st])}</span></div>
      ${stamp(s, admin && t().typeStudio)}
      <span class="small">${esc(s.city)}${s.address ? " · " + esc(s.address) : ""} · ${(s.disciplines || []).map((d) => esc(t().disciplines[d] || d)).join(", ")}</span>
      ${s.description ? `<span class="small">${esc(s.description)}</span>` : ""}
      ${[s.website_url, s.instagram_url, s.facebook_url].filter(safeUrl).map((u) => `<a class="small" href="${esc(u)}" target="_blank" rel="noopener nofollow">${esc(u)}</a>`).join("")}
      ${st === "rejected" && s.rejection_reason ? `<p class="msg bad">${esc(s.rejection_reason)}</p>` : ""}
      <div class="form-actions">
        ${admin ? `<button type="button" class="btn ok" data-approve="${esc(s.id)}">${esc(t().approve)}</button>
          <span class="reason" style="flex:1 1 220px"><textarea id="reason-${esc(s.id)}" rows="1" placeholder="${esc(t().reasonPh)}"></textarea></span>
          <button type="button" class="btn bad" data-reject="${esc(s.id)}">${esc(t().reject)}</button>
          <a class="btn ghost" href="/studios/edit/${esc(s.id)}">${esc(t().edit)}</a>`
        : `${st === "approved" ? `<a class="btn ghost" href="${esc(studioPath(s))}">${esc(t().showOnMap)}</a>` : ""}
          <a class="btn ghost" href="/studios/edit/${esc(s.id)}">${esc(t().edit)}</a>
          <button type="button" class="btn bad" data-remove="${esc(s.id)}">${esc(t().remove)}</button>`}
      </div>
    </div>`;
  }

  function listingRow(l, admin) {
    const st = l.status === "approved" && !isLive(l) ? "expired" : l.status;
    const kind = st === "approved" ? "ok" : st === "pending" ? "warn" : "bad";
    const n = state.stats[l.id] || 0;
    return `<div class="mine-row">
      <div class="mine-head"><strong>${esc(l.title)}</strong><span class="badge ${kind}">${esc(t().lStatus[st])}</span></div>
      ${stamp(l, admin && t().typeListing)}
      <span class="small">${esc(t().cats[l.category] || l.category)} · ${esc(kindLabel(l))} · ${esc(l.nick)} · ${esc(l.city)}${l.price ? " · " + esc(l.price) : ""}${st === "approved" ? " · " + esc(t().expiresIn(daysBetween(new Date(), new Date(l.expires_at)) + 1)) : ""}</span>
      <span class="small">${esc(l.description)}</span>
      ${!admin ? `<span class="small"><strong>${esc(t().lMessages(n))}</strong></span>` : ""}
      ${st === "rejected" && l.rejection_reason ? `<p class="msg bad">${esc(l.rejection_reason)}</p>` : ""}
      <div class="form-actions">
        ${admin ? `<button type="button" class="btn ok" data-lapprove="${esc(l.id)}">${esc(t().approve)}</button>
          <span class="reason" style="flex:1 1 220px"><textarea id="lreason-${esc(l.id)}" rows="1" placeholder="${esc(t().reasonPh)}"></textarea></span>
          <button type="button" class="btn bad" data-lreject="${esc(l.id)}">${esc(t().reject)}</button>
          <a class="btn ghost" href="/board/edit/${esc(l.id)}">${esc(t().edit)}</a>`
        : `${st === "approved" ? `<a class="btn ghost" href="${esc(listingPath(l))}">${esc(t().show)}</a><button type="button" class="btn ghost" data-lclose="${esc(l.id)}">${esc(t().close)}</button>` : ""}
          ${st === "pending" || st === "rejected" ? `<a class="btn ghost" href="/board/edit/${esc(l.id)}">${esc(t().edit)}</a>` : ""}
          <button type="button" class="btn bad" data-lremove="${esc(l.id)}">${esc(t().remove)}</button>`}
      </div>
    </div>`;
  }

  // kiedy przyszło zgłoszenie (i czy było poprawiane) + rodzaj wpisu w kolejce admina
  const when = (iso) => new Date(iso).toLocaleString(t().locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  function stamp(x, typeLabel) {
    const edited = x.updated_at && x.created_at && new Date(x.updated_at) - new Date(x.created_at) > 60000;
    return `<span class="stamp">${typeLabel ? `<span class="type-badge">${esc(typeLabel)}</span>` : ""}${esc(t().sentAt(when(x.created_at)))}${edited ? " · " + esc(t().editedAt(when(x.updated_at))) : ""}</span>`;
  }
  const newest = (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);

  function renderMine() {
    const box = $("mine-box");
    box.innerHTML = "";
    if (!state.user) { box.appendChild(loginPanel(t().login)); return; }
    const me = state.user.id;
    const mine = {
      listings: state.listings.filter((l) => l.created_by === me).sort(newest),
      studios: state.studios.filter((s) => s.created_by === me).sort(newest),
      makers: state.makers.filter((m) => m.created_by === me).sort(newest),
    };
    // kolejka admina: wszystkie rodzaje razem, od najnowszego zgłoszenia
    const queue = !state.isAdmin ? [] : [
      ...state.listings.filter((l) => l.status === "pending").map((x) => ({ x, html: () => listingRow(x, true) })),
      ...state.studios.filter((s) => s.status === "pending").map((x) => ({ x, html: () => mineRow(x, true) })),
      ...state.makers.filter((m) => m.status === "pending").map((x) => ({ x, html: () => makerRow(x, true) })),
    ].sort((a, b) => newest(a.x, b.x));
    // opublikowane (admin): tu znajdziesz zatwierdzony wpis, żeby go poprawić
    const published = !state.isAdmin ? [] : [
      ...state.listings.filter((l) => l.status === "approved").map((x) => ({ x, type: t().typeListing, title: x.title, path: listingPath(x), edit: `/board/edit/${x.id}` })),
      ...state.studios.filter((s) => s.status === "approved").map((x) => ({ x, type: t().typeStudio, title: x.name, path: studioPath(x), edit: `/studios/edit/${x.id}` })),
      ...state.makers.filter((m) => m.status === "approved").map((x) => ({ x, type: t().typeMaker, title: x.name, path: makerPath(x), edit: `/makers/edit/${x.id}` })),
    ].sort((a, b) => newest(a.x, b.x));

    const tabs = [
      ...(state.isAdmin ? [["review", t().tabReview, queue.length], ["published", t().tabPublished, published.length]] : []),
      ["listings", t().mineListings, mine.listings.length],
      ["studios", t().mineStudios, mine.studios.length],
      ["makers", t().mineMakers, mine.makers.length],
    ];
    if (!tabs.some(([k]) => k === state.mineTab)) state.mineTab = state.isAdmin ? "review" : "listings";
    const tab = state.mineTab;

    let body = "";
    if (tab === "review") body = queue.length ? `<p class="small">${esc(t().reviewHint)}</p>` + queue.map((q) => q.html()).join("") : `<p class="muted">${esc(t().modEmpty)}</p>`;
    else if (tab === "published") body = published.length ? published.map((q) => `<div class="mine-row pub-row">
        <div class="mine-head"><strong>${esc(q.title)}</strong><span class="type-badge">${esc(q.type)}</span></div>
        ${stamp(q.x)}
        <div class="form-actions"><a class="btn ghost" href="${esc(q.path)}">${esc(t().show)}</a><a class="btn ghost" href="${esc(q.edit)}">${esc(t().edit)}</a></div>
      </div>`).join("") : `<p class="muted">${esc(t().modEmpty)}</p>`;
    else if (tab === "listings") body = mine.listings.length ? mine.listings.map((l) => listingRow(l, false)).join("") : `<p class="muted">${esc(t().mineListingsEmpty)}</p>`;
    else if (tab === "studios") body = mine.studios.length ? mine.studios.map((x) => mineRow(x, false)).join("") : `<p class="muted">${esc(t().mineEmpty)}</p>`;
    else body = mine.makers.length ? mine.makers.map((m) => makerRow(m, false)).join("") : `<p class="muted">${esc(t().mineMakersEmpty)}</p>`;

    box.innerHTML = `<div class="mine"><div class="lead"><h1>${esc(t().mineTitle)}</h1>
      <span class="form-actions"><a class="btn primary" href="/board/add/">${esc(t().addListing)}</a><a class="btn ghost" href="/studios/add/">${esc(t().addStudio)}</a><a class="btn ghost" href="/makers/add/">${esc(t().addMaker)}</a></span></div>
      <nav class="tabs mine-tabs" role="tablist">${tabs.map(([k, label, n]) => `<button type="button" role="tab" data-mtab="${k}" aria-selected="${k === tab}">${esc(label)}${n ? ` <span class="count${k === "review" ? " hot" : ""}">${n}</span>` : ""}</button>`).join("")}</nav>
      ${body}</div>`;
  }

  function makerRow(m, admin) {
    const st = m.status;
    const kind = st === "approved" ? "ok" : st === "pending" ? "warn" : "bad";
    return `<div class="mine-row">
      <div class="mine-head"><span class="mine-name">${logoImg(m.logo_path, m.name, "logo sm")}<strong>${esc(m.name)}</strong></span><span class="badge ${kind}">${esc(t().status[st])}</span></div>
      ${stamp(m, admin && t().typeMaker)}
      <span class="small">${esc(m.city)} · ${(m.products || []).map((p) => esc(t().products[p] || p)).join(", ")}</span>
      ${m.description ? `<span class="small">${esc(m.description)}</span>` : ""}
      ${[m.website_url, m.shop_url, m.instagram_url, m.facebook_url].filter(safeUrl).map((u) => `<a class="small" href="${esc(u)}" target="_blank" rel="noopener nofollow">${esc(u)}</a>`).join("")}
      ${st === "rejected" && m.rejection_reason ? `<p class="msg bad">${esc(m.rejection_reason)}</p>` : ""}
      <div class="form-actions">
        ${admin ? `<button type="button" class="btn ok" data-kapprove="${esc(m.id)}">${esc(t().approve)}</button>
          <span class="reason" style="flex:1 1 220px"><textarea id="kreason-${esc(m.id)}" rows="1" placeholder="${esc(t().reasonPh)}"></textarea></span>
          <button type="button" class="btn bad" data-kreject="${esc(m.id)}">${esc(t().reject)}</button>
          <a class="btn ghost" href="/makers/edit/${esc(m.id)}">${esc(t().edit)}</a>`
        : `${st === "approved" ? `<a class="btn ghost" href="${esc(makerPath(m))}">${esc(t().show)}</a>` : ""}
          <a class="btn ghost" href="/makers/edit/${esc(m.id)}">${esc(t().edit)}</a>
          <button type="button" class="btn bad" data-kremove="${esc(m.id)}">${esc(t().remove)}</button>`}
      </div>
    </div>`;
  }

  async function updateMaker(id, patch) {
    const { error } = await state.sb.from("makers").update(patch).eq("id", id);
    if (error) { notice(t().errSave, "bad"); console.warn(error); return; }
    await loadMakers();
    route();
  }

  async function updateListing(id, patch) {
    const { error } = await state.sb.from("listings").update(patch).eq("id", id);
    if (error) { notice(t().errSave, "bad"); console.warn(error); return; }
    await loadListings();
    route();
  }

  async function updateStudio(id, patch) {
    const { error } = await state.sb.from("studios").update(patch).eq("id", id);
    if (error) { notice(t().errSave, "bad"); console.warn(error); return; }
    await loadStudios();
    route();
  }

  // ---------------- 8. Start ----------------
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const d = b.dataset;
    if (DEMO && (d.approve || d.reject || d.remove || d.verify || d.lapprove || d.lreject || d.lclose || d.lremove || d.kapprove || d.kreject || d.kremove || d.kverify)) { notice("demo: nic nie zostało zapisane", "warn"); return; }
    if (d.lang) { lang = d.lang; store.set("ac-lang", lang); applyTexts(); renderAccount(); setPrivacyHref(); route(); }
    else if (d.disc) { state.filter.disc = d.disc; renderStudios(); }
    else if (d.st) { map?.closePopup(); openStudio(d.st); }
    else if (d.verify) { const s = state.studios.find((x) => String(x.id) === d.verify); if (s) updateStudio(s.id, { verified: !s.verified }); }
    else if (d.approve) updateStudio(d.approve, { status: "approved" });
    else if (d.reject) updateStudio(d.reject, { status: "rejected", rejection_reason: ($("reason-" + d.reject)?.value || "").trim() || null });
    else if (d.mtab) { state.mineTab = d.mtab; renderMine(); }
    else if (d.prod) { state.mfilter.prod = d.prod; renderMakers(); }
    else if (d.kverify) { const m = state.makers.find((x) => String(x.id) === d.kverify); if (m) updateMaker(m.id, { verified: !m.verified }); }
    else if (d.kapprove) updateMaker(d.kapprove, { status: "approved" });
    else if (d.kreject) updateMaker(d.kreject, { status: "rejected", rejection_reason: ($("kreason-" + d.kreject)?.value || "").trim() || null });
    else if (d.kremove) {
      if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = t().removeConfirm; return; }
      const gone = state.makers.find((x) => String(x.id) === d.kremove)?.logo_path;
      const { error } = await state.sb.from("makers").delete().eq("id", d.kremove);
      if (error) { notice(t().errSave, "bad"); return; }
      dropLogo(gone);
      await loadMakers(); renderMine();
    }
    else if (d.lcat) { state.lfilter.cat = d.lcat; state.lfilter.kind = "all"; renderBoard(); }
    else if (d.lkind) { state.lfilter.kind = d.lkind; renderBoard(); }
    else if (d.lapprove) updateListing(d.lapprove, { status: "approved" });
    else if (d.lreject) updateListing(d.lreject, { status: "rejected", rejection_reason: ($("lreason-" + d.lreject)?.value || "").trim() || null });
    else if (d.lclose) {
      if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = t().closeConfirm; return; }
      updateListing(d.lclose, { status: "closed" });
    }
    else if (d.lremove) {
      if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = t().removeConfirm; return; }
      const { error } = await state.sb.from("listings").delete().eq("id", d.lremove);
      if (error) { notice(t().errSave, "bad"); return; }
      await loadListings(); renderMine();
    }
    else if (d.remove) {
      if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = t().removeConfirm; return; }
      const gone = state.studios.find((x) => String(x.id) === d.remove)?.logo_path;
      const { error } = await state.sb.from("studios").delete().eq("id", d.remove);
      if (error) { notice(t().errSave, "bad"); return; }
      dropLogo(gone);
      await loadStudios(); renderMine();
    }
  });
  $("f-q").addEventListener("input", (e) => { state.filter.q = e.target.value; renderStudios(); });
  $("f-level").addEventListener("change", (e) => { state.filter.level = e.target.value; renderStudios(); });
  $("f-kids").addEventListener("change", (e) => { state.filter.kids = e.target.checked; renderStudios(); });
  $("f-open").addEventListener("change", (e) => { state.filter.open = e.target.checked; renderStudios(); });
  $("f-rental").addEventListener("change", (e) => { state.filter.rental = e.target.checked; renderStudios(); });
  $("l-q").addEventListener("input", (e) => { state.lfilter.q = e.target.value; renderBoard(); });
  $("m-q").addEventListener("input", (e) => { state.mfilter.q = e.target.value; renderMakers(); });
  $("m-custom").addEventListener("change", (e) => { state.mfilter.custom = e.target.checked; renderMakers(); });
  $("m-abroad").addEventListener("change", (e) => { state.mfilter.abroad = e.target.checked; renderMakers(); });
  const setPrivacyHref = () => { $("foot-privacy").href = privacyHref(); };
  setPrivacyHref();
  // linki wewnętrzne bez przeładowania; /calendar/ i polityka ładują się normalnie
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || a.target || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/^\/(studios|board|makers|account)?(\/|$)/.test(url.pathname) || url.hash) return;
    e.preventDefault();
    go(url.pathname);
  });
  window.addEventListener("popstate", () => { notice(""); route(); });
  window.addEventListener("hashchange", () => { if (legacyPath()) route(); });

  applyTexts();
  renderAccount();
  route();
  (async () => {
    try { await initDb(); } catch (err) { console.warn(err); }
    await Promise.all([loadStudios(), loadEvents(), loadListings(), loadMakers()]);
    route();
  })();
})();
