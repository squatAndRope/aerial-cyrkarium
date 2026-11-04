/* Aerial · Fundacja Cyrkarium · logika strony

   Spis treści
     1. Ustawienia, język, pomocnicze
     2. Baza (Supabase), logowanie, wczytywanie danych
     3. Nawigacja (adres po #)
     4. Studia: filtry, mapa, lista, profil
     5. Kalendarz (podgląd z Aerial Events)
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
  const privacyHref = () => "polityka-prywatnosci.html" + (lang === "en" ? "#en" : "");
  const privacyLink = () => ` <a href="${privacyHref()}" target="_blank" rel="noopener">${esc(t().privacy)}</a>`;
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : null);

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
    filter: { disc: "all", q: "", level: "", kids: false },
    current: null,      // id otwartego profilu
    listings: [],       // ogłoszenia, które baza pozwala przeczytać tej osobie
    stats: {},          // liczba wiadomości przy moich ogłoszeniach
    lfilter: { cat: "all", q: "" },
    listingsLoaded: false,
  };

  const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();
  const DEMO_LISTINGS = [
    { id: "l1", category: "partner", title: "Partnerka do duetu na kole, poziom średni (przykład)", description: "Chcę przygotować duet na zawody wiosną. Trenuję 2 razy w tygodniu, mogę dojeżdżać do 30 km. Mam własne koło 90 cm.", city: "Poznań", nick: "Ola_hoop", price: null, status: "approved", created_at: inDays(-2), expires_at: inDays(58) },
    { id: "l2", category: "gear", title: "Sprzedam szarfy 9 m, fioletowe (przykład)", description: "Używane jeden sezon, bez zaciągnięć. Odbiór osobisty albo wysyłka.", city: "Gdańsk", nick: "Marta", price: "450 zł", status: "approved", created_at: inDays(-5), expires_at: inDays(55) },
    { id: "l3", category: "job", title: "Studio szuka instruktorki aerial hoop (przykład)", description: "Zajęcia we wtorki wieczorem, grupa początkująca, od stycznia.", city: "Łódź", nick: "Studio Lot", price: null, status: "approved", created_at: inDays(-8), expires_at: inDays(52) },
    { id: "l4", category: "space", title: "Wynajmę salę z punktami do zawieszenia (przykład)", description: "Wysokość 6 m, 4 punkty, materace. Wolne weekendy i poranki w tygodniu.", city: "Warszawa", nick: "Hala Wzlot", price: "80 zł / h", status: "approved", created_at: inDays(-9), expires_at: inDays(51) },
  ];
  const publicStudios = () => state.studios.filter((s) => s.status === "approved" && s.lat != null);

  const DEMO_STUDIOS = [
    { id: "d1", name: "Studio Orbita (przykład)", city: "Warszawa", address: "ul. Przykładowa 1", lat: 52.19, lng: 21.0, disciplines: ["hoop", "silks", "hammock"], levels: ["beginner", "intermediate", "advanced"], kids: true, verified: true, description: "Dwie sale, 9 punktów zawieszenia, wysokość 7 m. Open training w niedziele.", website_url: "https://example.com", instagram_url: "https://instagram.com/", status: "approved" },
    { id: "d2", name: "Lina i Koło (przykład)", city: "Warszawa", address: "", lat: 52.26, lng: 21.06, disciplines: ["rope", "hoop"], levels: ["beginner", "intermediate"], kids: false, verified: false, description: "Kameralne studio, grupy do 6 osób.", instagram_url: "https://instagram.com/", status: "approved" },
    { id: "d3", name: "Nad Wisłą Aerial (przykład)", city: "Kraków", address: "", lat: 50.04, lng: 19.96, disciplines: ["silks", "trapeze", "hoop"], levels: ["beginner", "intermediate", "advanced"], kids: true, verified: true, description: "Sufit 8 m, kursy trapezu i przygotowanie do zawodów.", website_url: "https://example.com", status: "approved" },
    { id: "d4", name: "Wzlot (przykład)", city: "Wrocław", address: "", lat: 51.12, lng: 17.03, disciplines: ["hoop", "hammock"], levels: ["beginner"], kids: true, verified: true, description: "Joga w hamakach i koło, zajęcia dla dzieci od 7 lat.", website_url: "https://example.com", status: "approved" },
    { id: "d5", name: "Mewa Aerial (przykład)", city: "Gdańsk", address: "", lat: 54.38, lng: 18.6, disciplines: ["hoop", "silks"], levels: ["beginner", "intermediate"], kids: false, verified: false, description: "Zajęcia popołudniowe i weekendowe warsztaty.", facebook_url: "https://facebook.com/", status: "approved" },
  ];

  async function initDb() {
    if (DEMO) { state.studios = DEMO_STUDIOS; state.loaded = true; state.listings = DEMO_LISTINGS; state.listingsLoaded = true; return; }
    state.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const { data } = await state.sb.auth.getSession();
    await setUser(data.session?.user || null);
    state.sb.auth.onAuthStateChange((_e, session) => {
      const u = session?.user || null;
      if ((u?.id || null) !== (state.user?.id || null)) setUser(u).then(() => Promise.all([loadStudios(), loadListings()]).then(route));
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
      box.innerHTML = `<span class="who">${esc(state.user.email)}</span><a href="#moje">${esc(t().mine)}</a><button type="button" class="link" id="logout">${esc(t().logout)}</button>`;
      $("logout").addEventListener("click", async () => { await state.sb.auth.signOut(); location.hash = "#studia"; });
    } else {
      box.innerHTML = `<a href="#moje">${esc(t().login)}</a>`;
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
  const VIEWS = ["studia", "kalendarz", "ogloszenia", "ogloszenie", "dodaj-ogloszenie", "dodaj-studio", "moje"];
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    let view = "studia", id = null;
    if (h.startsWith("studio-")) { id = h.slice(7); }
    else if (h.startsWith("ogloszenie-")) { view = "ogloszenie"; id = h.slice(11); }
    else if (h.startsWith("edytuj-ogl-")) { view = "dodaj-ogloszenie"; id = h.slice(11); }
    else if (h.startsWith("edytuj-")) { view = "dodaj-studio"; id = h.slice(7); }
    else if (VIEWS.includes(h)) view = h;
    // stary podgląd kalendarza: teraz pełny kalendarz mieszka w podfolderze
    if (view === "kalendarz") { location.replace("kalendarz/"); return; }

    VIEWS.forEach((v) => { $("view-" + v).hidden = v !== view; });
    const tab = view === "kalendarz" ? "kalendarz" : view.includes("ogloszeni") ? "ogloszenia" : "studia";
    document.querySelectorAll(".sections a").forEach((a) => a.setAttribute("aria-selected", String(a.dataset.view === tab)));

    if (view === "studia") { state.current = id; renderStudios(); }
    else if (view === "kalendarz") renderCalendar();
    else if (view === "ogloszenia") renderBoard();
    else if (view === "ogloszenie") renderListing(id);
    else if (view === "dodaj-ogloszenie") renderListingForm(id);
    else if (view === "dodaj-studio") renderForm(id);
    else if (view === "moje") renderMine();
  }

  // ---------------- 4. Studia ----------------
  function matches(s) {
    const f = state.filter;
    if (f.disc !== "all" && !(s.disciplines || []).includes(f.disc)) return false;
    if (f.level && !(s.levels || []).includes(f.level)) return false;
    if (f.kids && !s.kids) return false;
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
  }

  function renderStudios() {
    renderFilters();
    const all = publicStudios();
    const list = all.filter(matches);
    $("studios-count").textContent = state.loadFailed ? t().loadError : t().studiosCount(all.length, new Set(all.map((s) => cityKey(s.city))).size);

    const box = $("studio-list");
    if (!state.loaded) box.innerHTML = "";
    else if (!all.length) box.innerHTML = `<div class="empty"><p>${esc(t().emptyMap)}</p><a class="btn primary" href="#dodaj-studio">${esc(t().addStudio)}</a></div>`;
    else if (!list.length) box.innerHTML = `<div class="empty"><p>${esc(t().noMatch)}</p><button type="button" class="btn ghost" id="clear-f">${esc(t().clearFilters)}</button></div>`;
    else box.innerHTML = list.map((s) => `<button type="button" class="st" data-st="${esc(s.id)}" aria-current="${s.id === state.current}">
        <span class="st-head"><strong>${esc(s.name)}</strong>${s.verified ? `<span class="badge ok">✓ ${esc(t().verifiedShort)}</span>` : ""}</span>
        <span class="st-meta">${esc(s.city)}${s.address ? " · " + esc(s.address) : ""}</span>
        <span class="tags">${(s.disciplines || []).map((d) => `<span class="tag">${esc(t().disciplines[d] || d)}</span>`).join("")}</span>
      </button>`).join("");
    $("clear-f")?.addEventListener("click", () => { state.filter = { disc: "all", q: "", level: "", kids: false }; $("f-q").value = ""; renderStudios(); });

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
    if (location.hash === "#studio-" + id) { state.current = id; renderStudios(); }
    else location.hash = "#studio-" + id;
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
        <h2>${esc(s.name)}</h2>
        ${s.description ? `<p>${esc(s.description)}</p>` : ""}
        <div class="tags">${(s.disciplines || []).map((d) => `<span class="tag">${esc(t().disciplines[d] || d)}</span>`).join("")}${levels.map((l) => `<span class="tag">${esc(l)}</span>`).join("")}${s.kids ? `<span class="tag">${esc(t().kids)}</span>` : ""}</div>
        ${links ? `<div class="links">${links}</div>` : ""}
        <p class="small">${esc(t().noContactNote)}</p>
        ${s.verified ? "" : `<div class="empty"><strong>${esc(t().claimTitle)}</strong><p class="small">${esc(t().claimText)} <span style="user-select:all">${esc(t().claimMail)}</span></p></div>`}
        ${state.isAdmin && s.status === "approved" ? `<div class="form-actions"><button type="button" class="btn ghost" data-verify="${esc(s.id)}">${esc(s.verified ? t().unmarkVerified : t().markVerified)}</button><a class="btn ghost" href="#edytuj-${esc(s.id)}">${esc(t().edit)}</a></div>` : ""}
      </div>
      <div>
        <div class="linked"><h3>${esc(t().eventsHere(s.city))}</h3>
          ${evs.length ? evs.map(eventRow).join("") : `<p class="small">${esc(t().noEventsHere)}</p>`}
          <a class="small" href="${esc(CFG.eventsUrl)}/#add" target="_blank" rel="noopener">${esc(t().addEventLink)} ↗</a>
        </div>
        <button type="button" class="btn ghost" id="close-profile" style="align-self:flex-start">${esc(t().closeProfile)}</button>
      </div>`;
    $("close-profile").addEventListener("click", () => { location.hash = "#studia"; });
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
  function renderCalendar() {
    $("cal-link").href = CFG.eventsUrl;
    const box = $("event-list");
    box.innerHTML = state.events.length ? state.events.slice(0, 12).map(eventRow).join("") : `<p class="muted">${esc(t().calEmpty)}</p>`;
  }

  // ---------------- 5b. Ogłoszenia ----------------
  function catTag(c) { return `<span class="cat cat-${esc(c)}">${esc(t().cats[c] || c)}</span>`; }

  function renderBoard() {
    $("cat-chips").innerHTML = [["all", t().all], ...Object.entries(t().cats)]
      .map(([k, v]) => `<button type="button" class="chip" data-lcat="${k}" aria-pressed="${state.lfilter.cat === k}">${esc(v)}</button>`).join("");
    const live = state.listings.filter(isLive);
    const q = cityKey(state.lfilter.q);
    const list = live.filter((l) => (state.lfilter.cat === "all" || l.category === state.lfilter.cat)
      && (!q || cityKey(l.title + " " + l.description + " " + l.city).includes(q)));
    const box = $("listing-grid");
    if (!state.listingsLoaded) { box.innerHTML = ""; return; }
    if (!live.length) { box.innerHTML = `<div class="empty"><p>${esc(t().boardEmpty)}</p><a class="btn primary" href="#dodaj-ogloszenie">${esc(t().addListing)}</a></div>`; return; }
    if (!list.length) { box.innerHTML = `<div class="empty"><p>${esc(t().boardNoMatch)}</p></div>`; return; }
    const now = new Date();
    box.innerHTML = list.map((l) => `<article class="card">
      <div class="card-top">${catTag(l.category)}<span>${esc(t().ago(daysBetween(new Date(l.created_at), now)))}</span></div>
      <h3>${esc(l.title)}</h3>
      <p>${esc(l.description)}</p>
      <div class="card-foot"><span class="who">${esc(l.nick)} · ${esc(l.city)}${l.price ? ` · <span class="price">${esc(l.price)}</span>` : ""}</span>
        <a class="btn primary" href="#ogloszenie-${esc(l.id)}">${esc(t().write)}</a></div>
    </article>`).join("");
  }

  function renderListing(id) {
    const box = $("listing-box");
    const l = state.listings.find((x) => String(x.id) === String(id));
    const back = `<a class="back" href="#ogloszenia">${esc(t().backToBoard)}</a>`;
    if (!state.listingsLoaded) { box.innerHTML = back; return; }
    if (!l) { box.innerHTML = `<div class="view">${back}<p class="msg warn">${esc(t().listingGone)}</p></div>`; return; }
    const own = state.user && l.created_by === state.user.id;
    const left = daysBetween(new Date(), new Date(l.expires_at)) + 1;
    const meta = [l.nick, l.city, t().ago(daysBetween(new Date(l.created_at), new Date())), isLive(l) ? t().expiresIn(left) : t().lStatus[l.status]].map(esc).join(" · ");
    const report = `mailto:office@cyrkarium.com?subject=${encodeURIComponent(t().reportSubject + " " + l.id)}`;
    let form;
    if (own) form = `<div class="panel"><p class="msg ok">${esc(t().ownListing)}</p><a class="btn ghost" href="#moje">${esc(t().mine)}</a></div>`;
    else if (!isLive(l)) form = `<div class="panel"><p class="msg warn">${esc(t().mErrClosed)}</p></div>`;
    else form = `<form class="panel" id="msg-form" novalidate>
      <h2>${esc(t().writeTo(l.nick))}</h2>
      <div class="field"><label for="m-name">${esc(t().mName)}</label><input id="m-name" maxlength="60" autocomplete="given-name"></div>
      <div class="field"><label for="m-mail">${esc(t().mEmail)}</label><input id="m-mail" type="email" maxlength="200" autocomplete="email"></div>
      <div class="field"><label for="m-text">${esc(t().mText)}</label><textarea id="m-text" maxlength="2000"></textarea></div>
      <label class="toggle"><input type="checkbox" id="m-ok"> <span class="small">${esc(t().mConsent)}</span></label>
      <div id="m-status"></div>
      <button type="submit" class="btn primary" id="m-send">${esc(t().mSend)}</button>
      <p class="small" style="margin:0">${esc(t().mHint)}${privacyLink()}</p>
    </form>`;
    box.innerHTML = `<div class="view">${back}<div class="detail">
      <section class="panel">
        <div>${catTag(l.category)}</div>
        <h1>${esc(l.title)}</h1>
        <p class="small" style="margin:0">${meta}${l.price ? ` · <strong class="price">${esc(l.price)}</strong>` : ""}</p>
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
      <div class="field"><label for="f-cat">${esc(t().lCat)}</label><select id="f-cat"><option value=""></option>${Object.entries(t().cats).map(([k, c]) => `<option value="${k}"${v.category === k ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
      <div class="field"><label for="f-title">${esc(t().lTitle)}</label><input id="f-title" maxlength="120" value="${esc(v.title)}"></div>
      <div class="field"><label for="f-desc">${esc(t().lDesc)}</label><textarea id="f-desc" maxlength="1500">${esc(v.description)}</textarea><p class="hint">${esc(t().lDescHint)}</p></div>
      <div id="f-alert"></div>
      <div class="row2">
        <div class="field"><label for="f-nick">${esc(t().lNick)}</label><input id="f-nick" maxlength="40" value="${esc(v.nick)}"></div>
        <div class="field"><label for="f-city">${esc(t().lCity)}</label><input id="f-city" maxlength="60" value="${esc(v.city)}"></div>
      </div>
      <div class="field"><label for="f-price">${esc(t().lPrice)}</label><input id="f-price" maxlength="40" placeholder="${esc(t().lPricePh)}" value="${esc(v.price)}"></div>
      <p class="small" style="margin:0">${esc(t().emailPrivate)}${privacyLink()}</p>
      <div id="f-msg"></div>
      <div class="form-actions"><button type="submit" class="btn primary" id="f-submit">${esc(t().lSubmit)}</button><a class="btn ghost" href="${l ? "#moje" : "#ogloszenia"}">${esc(t().cancel)}</a></div>
    </form>`;

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
      const row = { category: val("f-cat"), title: val("f-title"), description: val("f-desc"), nick: val("f-nick"), city: val("f-city"), price: val("f-price") || null };
      if (!row.category || row.title.length < 5 || row.description.length < 10 || row.nick.length < 2 || row.city.length < 2) return fail(t().lErrRequired);
      const found = check();
      if (found.length) return fail(t().lErrContact(found.join(t().and)));
      if (DEMO) { msg.innerHTML = `<p class="msg ok">${esc(t().lSaved)} (demo)</p>`; return; }
      const btn = $("f-submit"); btn.disabled = true; btn.textContent = t().saving;
      const { error } = l ? await state.sb.from("listings").update(row).eq("id", l.id) : await state.sb.from("listings").insert(row);
      btn.disabled = false; btn.textContent = t().lSubmit;
      if (error) { console.warn(error); return fail(error.code === "P0001" ? error.message : /no_contact/.test(error.message) ? t().lErrContact(t().phone + t().and + t().email) : t().errSave); }
      await loadListings();
      location.hash = "#moje";
      notice(t().lSaved);
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
      <div class="field"><label for="s-name">${esc(t().fName)}</label><input id="s-name" maxlength="100" value="${esc(v.name)}"></div>
      <div class="row2">
        <div class="field"><label for="s-city">${esc(t().fCity)}</label><input id="s-city" maxlength="60" value="${esc(v.city)}"></div>
        <div class="field"><label for="s-address">${esc(t().fAddress)}</label><input id="s-address" maxlength="160" value="${esc(v.address)}"><p class="hint">${esc(t().fAddressHint)}</p></div>
      </div>
      <div class="field"><span class="label">${esc(t().fDisc)}</span>${checks("disc", t().disciplines, v.disciplines)}</div>
      <div class="field"><span class="label">${esc(t().fLevels)}</span>${checks("lvl", t().levels, v.levels)}</div>
      <label class="toggle"><input type="checkbox" id="s-kids"${v.kids ? " checked" : ""}> <span>${esc(t().fKids)}</span></label>
      <div class="field"><label for="s-desc">${esc(t().fDesc)}</label><textarea id="s-desc" maxlength="1200">${esc(v.description)}</textarea><p class="hint">${esc(t().fDescHint)}</p></div>
      <div id="desc-alert"></div>
      <div class="field"><label for="s-web">${esc(t().fWebsite)}</label><input id="s-web" type="url" inputmode="url" placeholder="https://" value="${esc(v.website_url)}"></div>
      <div class="row2">
        <div class="field"><label for="s-ig">${esc(t().fInstagram)}</label><input id="s-ig" type="url" inputmode="url" placeholder="https://instagram.com/…" value="${esc(v.instagram_url)}"></div>
        <div class="field"><label for="s-fb">${esc(t().fFacebook)}</label><input id="s-fb" type="url" inputmode="url" placeholder="https://facebook.com/…" value="${esc(v.facebook_url)}"></div>
      </div>
      <p class="hint" style="margin:0">${esc(t().fLinksHint)}</p>
      <label class="toggle"><input type="checkbox" id="s-consent"${s ? " checked" : ""}> <span class="small">${esc(t().fConsent)}</span></label>
      <div id="form-msg"></div>
      <div class="form-actions"><button type="submit" class="btn primary" id="s-submit">${esc(t().submit)}</button><a class="btn ghost" href="${s ? "#moje" : "#studia"}">${esc(t().cancel)}</a></div>
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
      const q = s ? state.sb.from("studios").update(row).eq("id", s.id) : state.sb.from("studios").insert(row);
      const { error } = await q;
      done();
      if (error) { console.warn(error); return fail(error.code === "P0001" ? error.message : t().errSave); }
      await loadStudios();
      location.hash = "#moje";
      notice(t().saved);
    });
  }

  // ---------------- 7. Moje studia i moderacja ----------------
  function mineRow(s, admin) {
    const st = s.status;
    const kind = st === "approved" ? "ok" : st === "pending" ? "warn" : "bad";
    return `<div class="mine-row">
      <div class="mine-head"><strong>${esc(s.name)}</strong><span class="badge ${kind}">${esc(t().status[st])}</span></div>
      <span class="small">${esc(s.city)}${s.address ? " · " + esc(s.address) : ""} · ${(s.disciplines || []).map((d) => esc(t().disciplines[d] || d)).join(", ")}</span>
      ${s.description ? `<span class="small">${esc(s.description)}</span>` : ""}
      ${[s.website_url, s.instagram_url, s.facebook_url].filter(safeUrl).map((u) => `<a class="small" href="${esc(u)}" target="_blank" rel="noopener nofollow">${esc(u)}</a>`).join("")}
      ${st === "rejected" && s.rejection_reason ? `<p class="msg bad">${esc(s.rejection_reason)}</p>` : ""}
      <div class="form-actions">
        ${admin ? `<button type="button" class="btn ok" data-approve="${esc(s.id)}">${esc(t().approve)}</button>
          <span class="reason" style="flex:1 1 220px"><textarea id="reason-${esc(s.id)}" rows="1" placeholder="${esc(t().reasonPh)}"></textarea></span>
          <button type="button" class="btn bad" data-reject="${esc(s.id)}">${esc(t().reject)}</button>`
        : `${st === "approved" ? `<a class="btn ghost" href="#studio-${esc(s.id)}">${esc(t().showOnMap)}</a>` : ""}
          <a class="btn ghost" href="#edytuj-${esc(s.id)}">${esc(t().edit)}</a>
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
      <span class="small">${esc(t().cats[l.category] || l.category)} · ${esc(l.nick)} · ${esc(l.city)}${l.price ? " · " + esc(l.price) : ""}${st === "approved" ? " · " + esc(t().expiresIn(daysBetween(new Date(), new Date(l.expires_at)) + 1)) : ""}</span>
      <span class="small">${esc(l.description)}</span>
      ${!admin ? `<span class="small"><strong>${esc(t().lMessages(n))}</strong></span>` : ""}
      ${st === "rejected" && l.rejection_reason ? `<p class="msg bad">${esc(l.rejection_reason)}</p>` : ""}
      <div class="form-actions">
        ${admin ? `<button type="button" class="btn ok" data-lapprove="${esc(l.id)}">${esc(t().approve)}</button>
          <span class="reason" style="flex:1 1 220px"><textarea id="lreason-${esc(l.id)}" rows="1" placeholder="${esc(t().reasonPh)}"></textarea></span>
          <button type="button" class="btn bad" data-lreject="${esc(l.id)}">${esc(t().reject)}</button>`
        : `${st === "approved" ? `<a class="btn ghost" href="#ogloszenie-${esc(l.id)}">${esc(t().show)}</a><button type="button" class="btn ghost" data-lclose="${esc(l.id)}">${esc(t().close)}</button>` : ""}
          ${st === "pending" || st === "rejected" ? `<a class="btn ghost" href="#edytuj-ogl-${esc(l.id)}">${esc(t().edit)}</a>` : ""}
          <button type="button" class="btn bad" data-lremove="${esc(l.id)}">${esc(t().remove)}</button>`}
      </div>
    </div>`;
  }

  function renderMine() {
    const box = $("mine-box");
    box.innerHTML = "";
    if (DEMO) { box.innerHTML = `<p class="msg warn">demo</p>`; return; }
    if (!state.user) { box.appendChild(loginPanel(t().login)); return; }
    const me = state.user.id;
    const myStudios = state.studios.filter((s) => s.created_by === me);
    const myListings = state.listings.filter((l) => l.created_by === me);
    const h2 = (txt) => `<h2 style="font-size:20px;font-weight:400;margin-top:12px">${esc(txt)}</h2>`;
    let html = `<div class="mine"><div class="lead"><h1>${esc(t().mineTitle)}</h1>
      <span class="form-actions"><a class="btn primary" href="#dodaj-ogloszenie">${esc(t().addListing)}</a><a class="btn ghost" href="#dodaj-studio">${esc(t().addStudio)}</a></span></div>`;
    html += h2(t().mineListings) + (myListings.length ? myListings.map((l) => listingRow(l, false)).join("") : `<p class="muted">${esc(t().mineListingsEmpty)}</p>`);
    html += h2(t().mineStudios) + (myStudios.length ? myStudios.map((s) => mineRow(s, false)).join("") : `<p class="muted">${esc(t().mineEmpty)}</p>`);
    if (state.isAdmin) {
      const pl = state.listings.filter((l) => l.status === "pending");
      const ps = state.studios.filter((s) => s.status === "pending");
      html += h2(t().modListings) + (pl.length ? pl.map((l) => listingRow(l, true)).join("") : `<p class="muted">${esc(t().modEmpty)}</p>`);
      html += h2(t().modStudios) + (ps.length ? ps.map((s) => mineRow(s, true)).join("") : `<p class="muted">${esc(t().modEmpty)}</p>`);
    }
    box.innerHTML = html + "</div>";
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
    if (d.lang) { lang = d.lang; store.set("ac-lang", lang); applyTexts(); renderAccount(); setPrivacyHref(); route(); }
    else if (d.disc) { state.filter.disc = d.disc; renderStudios(); }
    else if (d.st) { map?.closePopup(); openStudio(d.st); }
    else if (d.verify) { const s = state.studios.find((x) => String(x.id) === d.verify); if (s) updateStudio(s.id, { verified: !s.verified }); }
    else if (d.approve) updateStudio(d.approve, { status: "approved" });
    else if (d.reject) updateStudio(d.reject, { status: "rejected", rejection_reason: ($("reason-" + d.reject)?.value || "").trim() || null });
    else if (d.lcat) { state.lfilter.cat = d.lcat; renderBoard(); }
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
      const { error } = await state.sb.from("studios").delete().eq("id", d.remove);
      if (error) { notice(t().errSave, "bad"); return; }
      await loadStudios(); renderMine();
    }
  });
  $("f-q").addEventListener("input", (e) => { state.filter.q = e.target.value; renderStudios(); });
  $("f-level").addEventListener("change", (e) => { state.filter.level = e.target.value; renderStudios(); });
  $("f-kids").addEventListener("change", (e) => { state.filter.kids = e.target.checked; renderStudios(); });
  $("l-q").addEventListener("input", (e) => { state.lfilter.q = e.target.value; renderBoard(); });
  $("foot-events").href = CFG.eventsUrl;
  const setPrivacyHref = () => { $("foot-privacy").href = privacyHref(); };
  setPrivacyHref();
  window.addEventListener("hashchange", () => { notice(""); route(); window.scrollTo({ top: 0 }); if (location.hash.startsWith("#studio-")) $("studio-profile").scrollIntoView({ block: "start" }); });

  applyTexts();
  renderAccount();
  route();
  (async () => {
    try { await initDb(); } catch (err) { console.warn(err); }
    await Promise.all([loadStudios(), loadEvents(), loadListings()]);
    route();
  })();
})();
