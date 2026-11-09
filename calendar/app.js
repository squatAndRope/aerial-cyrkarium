/* Aerial Events · logika strony
   Teksty i słowniki: i18n.js (window.AE_TEXTS). Konfiguracja: config.js (window.AE_CONFIG).
   Dane: Supabase (tabela public.events; kto co może, pilnują reguły RLS w bazie).
   Widoki: #events (kalendarz), #add (dodaj/popraw), #mine (moje), #admin (zatwierdzanie). */
(function () {
  "use strict";

  const TEXTS = window.AE_TEXTS;
  const CFG = window.AE_CONFIG || {};

  // Listy opcji biorą się z kluczy w i18n.js, więc nowy typ czy dyscyplinę dopisuje się w jednym miejscu.
  const TYPES = Object.keys(TEXTS.pl.types);
  const LEVELS = Object.keys(TEXTS.pl.levels);
  const AUDIENCES = Object.keys(TEXTS.pl.audiences); // all, adults, kids
  const DISCIPLINES = Object.keys(TEXTS.pl.disciplines).filter((k) => k !== "mixed"); // „Różne” tylko w starych wpisach
  const VIEWS = ["events", "add", "mine", "admin"];

  // ------------------------------------------------------------------
  // Narzędzia
  // ------------------------------------------------------------------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  // język: zapamiętany wybór, a jeśli go nie ma, język przeglądarki
  function detectLang() {
    const saved = store.get("ac-lang");
    if (saved === "pl" || saved === "en") return saved;
    return (navigator.language || "pl").toLowerCase().startsWith("pl") ? "pl" : "en";
  }
  let lang = detectLang();
  const t = () => TEXTS[lang]; // t().klucz → tekst w bieżącym języku
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const btn = (cls, text, onClick) => { const b = el("button", "btn " + cls, text); b.type = "button"; if (onClick) b.addEventListener("click", onClick); return b; };
  const safeUrl = (u) => (typeof u === "string" && /^https?:\/\/[^\s/]+\.[^\s]+/i.test(u.trim())) ? u.trim() : null;
  const todayISO = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const parseD = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const loc = () => (lang === "pl" ? "pl-PL" : "en-GB");
  const fmt = (opts, s) => new Intl.DateTimeFormat(loc(), opts).format(parseD(s));
  const monthShort = (iso) => fmt({ month: "short" }, iso).replace(".", "");
  const weekdayShort = (iso) => fmt({ weekday: "short" }, iso);
  const isMultiDay = (e) => !!e.date_end && e.date_end !== e.date_start;
  // dyscypliny wydarzenia (nowa kolumna disciplines, a dla starych wpisów pojedyncze discipline)
  const discsOf = (e) => (Array.isArray(e.disciplines) && e.disciplines.length) ? e.disciplines : (e.discipline ? [e.discipline] : []);
  // klasy koloru typu: .typed włącza zabarwienie, .t-<typ> wybiera kolor (styles.css)
  const typeClass = (e) => (TYPES.includes(e.type) ? " typed t-" + e.type : "");

  const state = {
    sb: null, user: null, isAdmin: false,
    events: [], eventsLoaded: false, eventsError: false,
    mine: [], pending: [],
    filter: { type: "", city: new URLSearchParams(location.search).get("city") || "", level: "", disc: "", aud: "", q: "", past: false },
    studios: [], studioById: {},
    view: "events", editing: null, authReady: false, mode: "list",
  };

  function notice(kind, msg) {
    const box = $("notice"); box.textContent = "";
    if (msg) box.appendChild(el("div", "notice " + kind, msg));
  }

  // ------------------------------------------------------------------
  // Teksty statyczne i przełącznik języka
  // ------------------------------------------------------------------
  function fillSelect(sel, pairs, placeholder) {
    const cur = sel.value;
    sel.textContent = "";
    if (placeholder) { const o = el("option", null, "—"); o.value = ""; sel.appendChild(o); }
    pairs.forEach(([v, l]) => { const o = el("option", null, l); o.value = v; sel.appendChild(o); });
    sel.value = cur;
  }
  function applyText() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i]").forEach((n) => { const v = t()[n.dataset.i]; if (typeof v === "string") n.textContent = v; });
    document.querySelectorAll("[data-ph]").forEach((n) => { n.placeholder = t()[n.dataset.ph]; });
    document.querySelectorAll("[data-aria]").forEach((n) => { n.setAttribute("aria-label", t()[n.dataset.aria]); });
    $("lang-pl").setAttribute("aria-pressed", String(lang === "pl"));
    $("lang-en").setAttribute("aria-pressed", String(lang === "en"));
    fillSelect($("i-type"), TYPES.map((k) => [k, t().types[k]]), true);
    fillSelect($("i-level"), LEVELS.map((k) => [k, t().levels[k]]), true);
    renderLevelChips();
    renderDiscChecks();
    fillSelect($("f-level"), [["", t().allLevels]].concat(LEVELS.filter((k) => k !== "all").map((k) => [k, t().levels[k]])));
    fillSelect($("f-disc"), [["", t().allDisc]].concat(DISCIPLINES.map((k) => [k, t().disciplines[k]])));
    fillSelect($("f-aud"), [["", t().allAges], ["kids", t().audFilter.kids], ["adults", t().audFilter.adults]]);
    fillSelect($("i-aud"), AUDIENCES.map((k) => [k, t().audiences[k]]));
    if (!$("i-aud").value) $("i-aud").value = "all";
    if (CFG.privacyUrl) $("privacy-link").href = CFG.privacyUrl;
    renderAll();
  }
  document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => {
    lang = b.dataset.lang; store.set("ac-lang", lang); applyText();
  }));

  // ------------------------------------------------------------------
  // Nawigacja (#events, #add, #mine, #admin)
  // ------------------------------------------------------------------
  function viewFromHash() {
    const h = (location.hash || "").replace(/^#/, "");
    return VIEWS.includes(h) ? h : null;
  }
  function setView(v, push) {
    // panel admina: niezalogowany widzi logowanie, zalogowany nie-admin wraca do kalendarza
    if (v === "admin" && !state.isAdmin && state.authReady && state.user) v = "events";
    state.view = v;
    document.querySelectorAll("[role=tab]").forEach((a) => a.setAttribute("aria-selected", String(a.dataset.view === v)));
    VIEWS.forEach((x) => { $("view-" + x).hidden = x !== v; });
    if (push && location.hash !== "#" + v) history.replaceState(null, "", "#" + v);
    if (v !== "add" && state.editing) { state.editing = null; resetForm(); }
    renderAll();
  }
  window.addEventListener("hashchange", () => { const v = viewFromHash(); if (v) setView(v); });
  document.querySelectorAll("[role=tab]").forEach((a) => a.addEventListener("click", () => notice()));

  // ------------------------------------------------------------------
  // Konto (nagłówek)
  // ------------------------------------------------------------------
  function renderAccount() {
    const box = $("account"); box.textContent = "";
    if (!state.user) return;
    box.appendChild(el("span", "who", state.user.email || ""));
    box.appendChild(btn("link", t().logout, async () => { await state.sb.auth.signOut(); }));
  }

  function loginCard(textKey) {
    const card = el("div", "card");
    card.appendChild(el("h3", null, t().loginTitle));
    card.appendChild(el("p", null, t()[textKey]));
    const form = el("form", "login");
    const input = el("input"); input.type = "email"; input.required = true; input.autocomplete = "email";
    input.placeholder = t().email; input.id = "login-email-" + textKey;
    const send = el("button", "btn primary", t().sendLink); send.type = "submit";
    form.appendChild(input); form.appendChild(send);
    const msg = el("div");
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); msg.textContent = "";
      const email = input.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.appendChild(el("div", "notice bad", t().badEmail)); return; }
      send.disabled = true;
      store.set("ae-after-login", state.view);
      const { error } = await state.sb.auth.signInWithOtp({
        email, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true },
      });
      send.disabled = false;
      msg.appendChild(el("div", "notice " + (error ? "bad" : "ok"), error ? t().loginError : t().linkSent));
      if (error) console.error(error);
    });
    card.appendChild(form);
    const consent = el("p", "small");
    consent.appendChild(document.createTextNode(t().consent));
    const a = el("a", null, t().consentLink); a.href = CFG.privacyUrl || "#"; a.target = "_blank"; a.rel = "noopener";
    consent.appendChild(a); consent.appendChild(document.createTextNode("."));
    card.appendChild(consent);
    card.appendChild(msg);
    if (textKey === "loginTextAdmin") card.appendChild(passwordForm());
    return card;
  }

  function passwordForm() {
    const box = el("div", "pw-login");
    box.appendChild(el("p", "small", t().orPassword));
    const form = el("form", "login");
    const em = el("input"); em.type = "email"; em.autocomplete = "username"; em.placeholder = t().email; em.id = "pw-email";
    const pw = el("input"); pw.type = "password"; pw.autocomplete = "current-password"; pw.placeholder = t().password; pw.id = "pw-pass";
    const go = el("button", "btn ghost", t().signIn); go.type = "submit";
    form.appendChild(em); form.appendChild(pw); form.appendChild(go);
    const msg = el("div");
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); msg.textContent = ""; go.disabled = true;
      const { error } = await state.sb.auth.signInWithPassword({ email: em.value.trim(), password: pw.value });
      go.disabled = false;
      if (error) msg.appendChild(el("div", "notice bad", t().badLogin));
      else store.set("ae-after-login", "admin");
    });
    box.appendChild(form); box.appendChild(msg);
    return box;
  }

  function passwordSettings() {
    const card = el("div", "card pw-settings");
    card.appendChild(el("h3", null, t().pwTitle));
    card.appendChild(el("p", null, t().pwText));
    const form = el("form", "login");
    const user = el("input"); user.type = "email"; user.autocomplete = "username"; user.value = state.user.email || ""; user.hidden = true;
    const pw = el("input"); pw.type = "password"; pw.autocomplete = "new-password"; pw.placeholder = t().pwNew; pw.id = "pw-new"; pw.minLength = 12;
    const save = el("button", "btn ghost", t().pwSave); save.type = "submit";
    form.appendChild(user); form.appendChild(pw); form.appendChild(save);
    const msg = el("div");
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); msg.textContent = "";
      if (pw.value.length < 12) { msg.appendChild(el("div", "notice bad", t().pwShort)); return; }
      save.disabled = true;
      const { error } = await state.sb.auth.updateUser({ password: pw.value });
      save.disabled = false;
      if (error) { console.error(error); msg.appendChild(el("div", "notice bad", t().pwError)); return; }
      pw.value = ""; msg.appendChild(el("div", "notice ok", t().pwSaved));
    });
    card.appendChild(form); card.appendChild(msg);
    return card;
  }

  // wybór kilku dyscyplin (chipy z checkboxami)
  function selectedDiscs() {
    return [...document.querySelectorAll('#i-disc input[type=checkbox]:checked')].map((i) => i.value);
  }
  function renderDiscChecks(selected) {
    const box = $("i-disc");
    const keep = selected || selectedDiscs();
    box.textContent = "";
    DISCIPLINES.forEach((k) => {
      const lab = el("label", "chip check");
      const cb = el("input"); cb.type = "checkbox"; cb.value = k; cb.id = "disc-" + k; cb.checked = keep.includes(k);
      lab.appendChild(cb); lab.appendChild(document.createTextNode(" " + t().disciplines[k]));
      box.appendChild(lab);
    });
  }

  // poziom jako słupki: 1/2/3 rosnące, „wszystkie” = trzy równe
  function levelIcon(k) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 14 14"); svg.setAttribute("width", "14"); svg.setAttribute("height", "14");
    svg.setAttribute("aria-hidden", "true"); svg.setAttribute("class", "lvl-ico lvl-" + k);
    const n = { beginner: 1, intermediate: 2, advanced: 3 }[k];
    [0, 1, 2].forEach((i) => {
      const h = k === "all" ? 8 : 5 + i * 4;
      const r = document.createElementNS(NS, "rect");
      r.setAttribute("x", String(1 + i * 4.5)); r.setAttribute("y", String(k === "all" ? 3 : 13 - h));
      r.setAttribute("width", "3"); r.setAttribute("height", String(h)); r.setAttribute("rx", "1");
      if (k !== "all" && i >= n) r.setAttribute("class", "off");
      svg.appendChild(r);
    });
    return svg;
  }
  function levelTag(k) {
    const tag = el("span", "tag lvl");
    tag.appendChild(levelIcon(k)); tag.appendChild(document.createTextNode(t().levels[k]));
    return tag;
  }
  function renderLevelChips() {
    const sel = $("i-level"), box = $("i-level-chips");
    box.textContent = "";
    LEVELS.forEach((k) => {
      const b = el("button", "chip lvl-chip"); b.type = "button";
      b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(sel.value === k));
      b.appendChild(levelIcon(k)); b.appendChild(document.createTextNode(t().levels[k]));
      b.addEventListener("click", () => { sel.value = k; renderLevelChips(); });
      box.appendChild(b);
    });
  }

  // opis zwinięty do 3 linijek z przyciskiem „Więcej”
  function setupClamps(root) {
    requestAnimationFrame(() => {
      root.querySelectorAll(".desc.clamp").forEach((p) => {
        const more = p.nextElementSibling;
        if (!more || !more.classList.contains("more")) return;
        more.hidden = !(p.scrollHeight > p.clientHeight + 2 || p.classList.contains("open"));
      });
    });
  }

  // ------------------------------------------------------------------
  // Wspólne kawałki wydarzenia (kafelek, okienko, lista admina i „Moje”)
  // ------------------------------------------------------------------
  // „24–25 paź”, „31 paź – 3 lis”, „24 paź”
  function dateRangeText(e) {
    const s = parseD(e.date_start);
    if (!isMultiDay(e)) return s.getDate() + " " + monthShort(e.date_start);
    const end = parseD(e.date_end);
    const sameMonth = end.getMonth() === s.getMonth() && end.getFullYear() === s.getFullYear();
    return sameMonth
      ? s.getDate() + "–" + end.getDate() + " " + monthShort(e.date_end)
      : s.getDate() + " " + monthShort(e.date_start) + " – " + end.getDate() + " " + monthShort(e.date_end);
  }
  function weekdayText(e) {
    return isMultiDay(e) ? weekdayShort(e.date_start) + "–" + weekdayShort(e.date_end) : weekdayShort(e.date_start);
  }
  // plakietka daty na kafelku i w okienku
  function dateChip(e) {
    const chip = el("div", "date-chip");
    chip.appendChild(el("span", "dc-main", dateRangeText(e)));
    chip.appendChild(el("span", "dc-wd", weekdayText(e)));
    return chip;
  }
  // pionowy „bilet” daty na liście admina i w „Moich wydarzeniach”: dzień / – / dzień
  function dateBlock(e) {
    const box = el("div", "date");
    const s = parseD(e.date_start);
    box.appendChild(el("span", "d", String(s.getDate())));
    if (isMultiDay(e)) {
      const end = parseD(e.date_end);
      const sameMonth = end.getMonth() === s.getMonth() && end.getFullYear() === s.getFullYear();
      if (!sameMonth) box.appendChild(el("span", "m", monthShort(e.date_start)));
      box.appendChild(el("span", "dash", "–"));
      box.appendChild(el("span", "d", String(end.getDate())));
      box.appendChild(el("span", "m", monthShort(e.date_end)));
    } else {
      box.appendChild(el("span", "m", monthShort(e.date_start)));
    }
    box.appendChild(el("span", "w", weekdayText(e)));
    return box;
  }
  function priceText(e) {
    if (e.is_free) return null;
    if (typeof e.price_pln === "number") return t().from + " " + e.price_pln.toLocaleString(loc()) + " zł";
    return null;
  }
  // etykiety: [status] typ, dyscypliny, poziom, bezpłatne
  function eventTags(e, withStatus) {
    const tags = el("div", "tags");
    if (withStatus) tags.appendChild(el("span", "pill " + e.status, t().status[e.status]));
    if (t().types[e.type]) tags.appendChild(el("span", "tag type t-" + e.type, t().types[e.type]));
    discsOf(e).forEach((d) => { if (t().disciplines[d]) tags.appendChild(el("span", "tag", t().disciplines[d])); });
    if (t().levels[e.level]) tags.appendChild(levelTag(e.level));
    if (e.audience === "kids" || e.audience === "adults") tags.appendChild(el("span", "tag aud " + e.audience, t().audiences[e.audience]));
    if (e.is_free) tags.appendChild(el("span", "tag free", t().free));
    return tags;
  }
  // miasto · miejsce, cena, organizator, termin zapisów
  function eventMeta(e) {
    const meta = el("div", "meta");
    meta.appendChild(el("span", "where", [e.city, e.venue].filter(Boolean).join(" · ")));
    const price = priceText(e); if (price) meta.appendChild(el("span", null, price));
    if (e.organizer) meta.appendChild(el("span", null, t().by + ": " + e.organizer));
    const st = e.studio_id && state.studioById[e.studio_id];
    if (st) meta.appendChild(studioChip(st));
    if (e.reg_deadline) meta.appendChild(el("span", null, t().deadline + " " + fmt({ day: "numeric", month: "long" }, e.reg_deadline)));
    return meta;
  }
  // ramka studia z mapy (wydarzenie odbywa się w tym studiu); link do profilu w zakładce Studia
  const LOGOS = CFG.supabaseUrl + "/storage/v1/object/public/logos/";
  function studioChip(s) {
    const a = el("a", "studio-chip"); a.href = "/studios/" + s.id;
    const badge = el("span", "sc-logo");
    if (s.logo_path) { const img = el("img"); img.src = LOGOS + s.logo_path; img.alt = ""; img.loading = "lazy"; badge.appendChild(img); }
    else badge.textContent = ((s.name || "").match(/[\p{L}\p{N}]/u) || ["•"])[0].toUpperCase();
    a.appendChild(badge);
    const txt = el("span", "sc-txt");
    txt.appendChild(el("strong", null, s.name));
    txt.appendChild(el("small", null, [s.city, s.address].filter(Boolean).join(" · ")));
    a.appendChild(txt);
    a.appendChild(el("span", "sc-go", t().studioProfile + " →"));
    return a;
  }
  // studia z mapy w podanym mieście (podpowiedzi w polu „Miejsce”)
  const studioLabel = (s) => s.name + (s.address ? ", " + s.address : "");
  function fillVenueHints() {
    const list = $("venue-list"); if (!list) return;
    const c = cityKey($("i-city").value);
    list.textContent = "";
    state.studios.filter((s) => c && cityKey(s.city) === c).forEach((s) => { const o = el("option"); o.value = studioLabel(s); list.appendChild(o); });
  }
  // przypięcie wydarzenia do studia: nazwa studia (albo „nazwa, adres”) wpisana w polu „Miejsce”, to samo miasto
  function matchStudio(venue, city) {
    const v = cityKey(venue), c = cityKey(city);
    if (!v || !c) return null;
    const inCity = state.studios.filter((s) => cityKey(s.city) === c);
    const hit = inCity.find((s) => v === cityKey(studioLabel(s))) || inCity.find((s) => v === cityKey(s.name))
      || inCity.find((s) => v.startsWith(cityKey(s.name) + ","));
    return hit ? hit.id : null;
  }

  // przycisk „Zapisy ↗” (null, gdy link jest niepoprawny)
  function registerLink(e) {
    const url = safeUrl(e.reg_url);
    if (!url) return null;
    const a = el("a", "btn primary", t().register + " ↗");
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    return a;
  }
  function registerActions(e) {
    const a = registerLink(e);
    if (!a) return null;
    const acts = el("div", "card-actions"); acts.appendChild(a);
    return acts;
  }

  // wiersz na liście admina i w „Moich wydarzeniach”; opis rozwija się w miejscu
  function eventRow(e, opts) {
    opts = opts || {};
    const row = el("article", "ev");
    row.appendChild(dateBlock(e));
    const body = el("div", "ev-body");
    body.appendChild(eventTags(e, opts.status));
    body.appendChild(el("h3", "ev-title", e.title || ""));
    body.appendChild(eventMeta(e));
    if (e.description) {
      const desc = el("p", "desc clamp", e.description);
      const more = btn("link more", t().more);
      more.hidden = true;
      more.addEventListener("click", () => { const open = desc.classList.toggle("open"); more.textContent = open ? t().less : t().more; });
      body.appendChild(desc); body.appendChild(more);
    }
    if (opts.status && e.status === "rejected" && e.rejection_reason) {
      const r = el("div", "reason-note");
      r.appendChild(el("strong", null, t().reasonLabel + ": "));
      r.appendChild(document.createTextNode(e.rejection_reason));
      body.appendChild(r);
    }
    const acts = el("div", "ev-actions");
    const reg = !opts.hideRegister && registerLink(e);
    if (reg) acts.appendChild(reg);
    (opts.actions || []).forEach((x) => acts.appendChild(x));
    body.appendChild(acts);
    if (opts.after) body.appendChild(opts.after);
    row.appendChild(body);
    return row;
  }

  // ------------------------------------------------------------------
  // Kalendarz
  // ------------------------------------------------------------------
  function renderChips() {
    const box = $("type-chips"); box.textContent = "";
    [["", t().allTypes]].concat(TYPES.map((k) => [k, t().types[k]])).forEach(([k, l]) => {
      const b = el("button", "chip" + (k ? " typed t-" + k : ""), l); b.type = "button";
      b.setAttribute("aria-pressed", String(state.filter.type === k));
      b.addEventListener("click", () => { state.filter.type = k; renderChips(); renderEvents(); });
      box.appendChild(b);
    });
  }
  function renderCityFilter() {
    const cities = [...new Set(state.events.map((e) => e.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pl"));
    fillSelect($("f-city"), [["", t().allCities]].concat(cities.map((c) => [c, c])));
    if (state.filter.city) $("f-city").value = state.filter.city;
    // podpowiedzi w polu „Miasto” w formularzu: miejscowości, które już są w kalendarzu
    const hints = $("cities"); hints.textContent = "";
    cities.forEach((c) => { const o = el("option"); o.value = c; hints.appendChild(o); });
  }
  $("f-q").addEventListener("input", (e) => { state.filter.q = e.target.value.trim().toLowerCase(); renderEvents(); });
  $("f-city").addEventListener("change", (e) => { state.filter.city = e.target.value; renderEvents(); });
  $("f-level").addEventListener("change", (e) => { state.filter.level = e.target.value; renderEvents(); });
  $("f-disc").addEventListener("change", (e) => { state.filter.disc = e.target.value; renderEvents(); });
  $("f-aud").addEventListener("change", (e) => { state.filter.aud = e.target.value; renderEvents(); });
  $("f-past").addEventListener("change", (e) => { state.filter.past = e.target.checked; renderEvents(); });

  // ---------------- wyszukiwanie miejscowości (OpenStreetMap / Nominatim) ----------------
  // Współrzędne zapisujemy przy wydarzeniu (kolumny lat/lng). OSM pytamy tylko przy dodawaniu
  // wydarzenia w formularzu i w panelu admina (uzupełnianie starych wpisów), nigdy u odwiedzających.
  const NOMINATIM = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pl&accept-language=pl&q=";
  const cityKey = (c) => (c || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/\s+/g, " ");
  const placeLabel = (s) => (s || "").split(", ").filter((x) => x !== "Polska").slice(0, 3).join(", ");
  const geoMemo = new Map(); // miejscowość → wynik (na czas wizyty)
  // { lat, lng, label } | null (nie znaleziono) | undefined (błąd sieci, spróbujemy później)
  function geocodeCity(city) {
    const k = cityKey(city);
    if (!k) return Promise.resolve(null);
    if (!geoMemo.has(k)) {
      const p = fetch(NOMINATIM + encodeURIComponent(city.trim()))
        .then((r) => r.json())
        .then((j) => {
          const hit = Array.isArray(j) && j[0];
          return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), label: placeLabel(hit.display_name) } : null;
        })
        .catch(() => { geoMemo.delete(k); return undefined; });
      geoMemo.set(k, p);
    }
    return geoMemo.get(k);
  }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((res) => setTimeout(() => res(undefined), ms))]);

  // panel admina: jednorazowo uzupełnia pinezki wydarzeniom, które ich nie mają
  // (stare wpisy sprzed tej zmiany, wpisy dodane w SQL Editorze, wyszukiwanie, które się nie udało)
  let backfillDone = false;
  async function backfillCoords() {
    if (backfillDone || !state.isAdmin) return;
    backfillDone = true;
    const missing = state.events.concat(state.pending).filter((e) => e.lat == null && e.city);
    let changed = false;
    for (const e of missing) {
      const cached = geoMemo.has(cityKey(e.city));
      const hit = await geocodeCity(e.city);
      if (hit) {
        const { error } = await state.sb.from("events").update({ lat: hit.lat, lng: hit.lng }).eq("id", e.id);
        if (error) console.error(error); else { e.lat = hit.lat; e.lng = hit.lng; changed = true; }
      }
      if (!cached) await new Promise((res) => setTimeout(res, 1100)); // limit OSM: 1 zapytanie na sekundę
    }
    if (changed && state.mode === "map") renderEvents();
  }

  // najpierw data startu, przy tej samej dacie krótsze wydarzenie wcześniej, potem alfabetycznie
  function byDate(a, b) {
    return a.date_start.localeCompare(b.date_start)
      || (a.date_end || a.date_start).localeCompare(b.date_end || b.date_start)
      || (a.title || "").localeCompare(b.title || "", "pl");
  }
  function filteredEvents(opts) {
    const f = state.filter, today = todayISO();
    // widok miesiąca pokazuje wszystko; lista i mapa: nadchodzące albo (po zaznaczeniu) tylko minione
    const all = opts && opts.keepPast, onlyPast = f.past && !all;
    const out = state.events.filter((e) => {
      const last = e.date_end || e.date_start;
      if (!all && (onlyPast ? last >= today : last < today)) return false;
      if (f.type && e.type !== f.type) return false;
      if (f.city && e.city !== f.city) return false;
      if (f.level && !(e.level === f.level || e.level === "all")) return false;
      if (f.disc && !discsOf(e).includes(f.disc)) return false;
      // „tylko dla dzieci” = oznaczone dla dzieci; „bez wydarzeń dla dzieci” = wszystko poza nimi
      if (f.aud === "kids" && e.audience !== "kids") return false;
      if (f.aud === "adults" && e.audience === "kids") return false;
      if (f.q && !((e.title || "") + " " + (e.organizer || "") + " " + (e.city || "")).toLowerCase().includes(f.q)) return false;
      return true;
    }).sort(byDate);
    return onlyPast ? out.reverse() : out;   // minione: od najświeższych
  }

  // licznik do startu: „za 12 dni”, „jutro”, „dziś”, „trwa”; soon = ostatni tydzień (wyróżniony kolorem)
  function countdown(e) {
    const day = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
    const now = day(todayISO()), start = day(e.date_start), end = day(e.date_end || e.date_start);
    const n = start - now;
    if (end < now) return { text: t().cdPast };
    if (n < 0) return { text: t().cdOn, soon: true };
    if (n === 0) return { text: t().cdToday, soon: true };
    if (n === 1) return { text: t().cdTomorrow, soon: true };
    return { text: t().cdIn(n), soon: n <= 7 };
  }

  // kafelek w kalendarzu; dotknięcie w dowolnym miejscu otwiera okienko ze szczegółami
  function eventCard(e) {
    const card = el("article", "ev-card clickable" + typeClass(e));
    const top = el("div", "card-top");
    top.appendChild(dateChip(e));
    const cd = countdown(e);
    top.appendChild(el("span", "countdown" + (cd.soon ? " soon" : ""), cd.text));
    card.appendChild(top);
    card.appendChild(eventTags(e));
    card.appendChild(el("h3", "ev-title", e.title || ""));
    card.appendChild(eventMeta(e));
    if (e.description) {
      card.appendChild(el("p", "desc clamp", e.description));
      const more = btn("link more", t().more); more.hidden = true; // setupClamps pokaże, gdy opis się nie mieści
      more.setAttribute("aria-haspopup", "dialog");
      more.addEventListener("click", () => openDetails(e, card));
      card.appendChild(more);
    }
    const acts = registerActions(e); if (acts) card.appendChild(acts);
    card.addEventListener("click", (ev) => {
      if (ev.target.closest("a, button")) return;           // „Zapisy” i „Więcej” działają po swojemu
      const sel = window.getSelection && window.getSelection();
      if (sel && String(sel).trim()) return;                 // zaznaczanie tekstu nie otwiera okienka
      openDetails(e, card);
    });
    return card;
  }

  // ---------------- okienko ze szczegółami ----------------
  const CLOSE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>';
  let detailsDlg = null;
  function openDetails(e, card) {
    if (!detailsDlg) {
      detailsDlg = el("dialog", "details");
      detailsDlg.addEventListener("click", (ev) => { if (ev.target === detailsDlg) detailsDlg.close(); }); // klik w tło
      detailsDlg.addEventListener("close", () => { document.body.classList.remove("no-scroll"); if (detailsDlg._back) detailsDlg._back.focus(); });
      document.body.appendChild(detailsDlg);
    }
    const dlg = detailsDlg; dlg.textContent = "";
    dlg.className = "details" + typeClass(e);
    dlg.setAttribute("aria-labelledby", "details-title");
    const inner = el("div", "details-inner");
    const head = el("div", "card-top");
    head.appendChild(dateChip(e));
    const x = btn("ghost details-close", null, () => dlg.close());
    x.setAttribute("aria-label", t().close); x.innerHTML = CLOSE_ICON;
    head.appendChild(x);
    inner.appendChild(head);
    inner.appendChild(eventTags(e));
    const h = el("h2", "ev-title", e.title || ""); h.id = "details-title"; inner.appendChild(h);
    inner.appendChild(eventMeta(e));
    if (e.description) inner.appendChild(el("p", "desc", e.description));
    const acts = registerActions(e); if (acts) inner.appendChild(acts);
    dlg.appendChild(inner);
    // po zamknięciu fokus wraca na kafelek (ważne przy nawigacji klawiaturą)
    dlg._back = card && (card.tagName === "BUTTON" ? card : (card.querySelector(".more:not([hidden])") || card.querySelector(".card-actions a")));
    document.body.classList.add("no-scroll");
    dlg.showModal();
    inner.scrollTop = 0; x.focus();
  }

  // ---------------- mapa ----------------
  let leafletPromise = null, map = null, markerLayer = null;
  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(css);
      const js = document.createElement("script");
      js.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      js.onload = () => resolve(window.L);
      js.onerror = () => { leafletPromise = null; reject(new Error("leaflet")); };
      document.head.appendChild(js);
    });
    return leafletPromise;
  }
  // dymek pinezki: miasto i małe kafelki wydarzeń; kliknięcie otwiera okienko ze szczegółami
  function mapPopup(g) {
    const pop = el("div", "pop");
    const head = el("div", "pop-head");
    head.appendChild(el("strong", "pop-city", g.name));
    head.appendChild(el("span", "pop-count", t().eventsCount(g.events.length)));
    pop.appendChild(head);
    const list = el("div", "pop-list");
    g.events.forEach((e) => list.appendChild(eventMiniRow(e, e.venue)));
    pop.appendChild(list);
    return pop;
  }
  // mały wiersz: data i kategoria, tytuł, miejsce i cena; kliknięcie otwiera okienko ze szczegółami
  function eventMiniRow(e, place) {
    const row = el("button", "pop-row" + typeClass(e)); row.type = "button";
    const top = el("span", "pop-top");
    top.appendChild(el("span", "pop-date", dateRangeText(e)));
    if (t().types[e.type]) top.appendChild(el("span", "pop-type", t().types[e.type]));
    row.appendChild(top);
    row.appendChild(el("span", "pop-title", e.title || ""));
    const bits = [place, priceText(e) || (e.is_free ? t().free : null)].filter(Boolean);
    if (bits.length) row.appendChild(el("span", "pop-meta", bits.join(" · ")));
    row.addEventListener("click", () => openDetails(e, row));
    return row;
  }

  // ---------------- widok miesiąca ----------------
  const isoOf = (y, m, d) => y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  const cal = { y: new Date().getFullYear(), m: new Date().getMonth(), sel: null };
  function renderMonth(items, box) {
    const today = todayISO();
    const first = isoOf(cal.y, cal.m, 1);
    const days = new Date(cal.y, cal.m + 1, 0).getDate();
    const last = isoOf(cal.y, cal.m, days);
    // wydarzenia każdego dnia miesiąca (kilkudniowe zaznaczają każdy swój dzień)
    const byDay = {};
    items.forEach((e) => {
      const s = e.date_start, end = e.date_end || e.date_start;
      if (end < first || s > last) return;
      for (let d = 1; d <= days; d++) {
        const iso = isoOf(cal.y, cal.m, d);
        if (iso >= s && iso <= end) (byDay[iso] = byDay[iso] || []).push(e);
      }
    });
    if (!cal.sel || cal.sel < first || cal.sel > last || !byDay[cal.sel]) {
      cal.sel = byDay[today] ? today : (Object.keys(byDay).sort()[0] || null);
    }

    const wrap = el("div", "cal");
    const head = el("div", "cal-head");
    const move = (delta) => { const d = new Date(cal.y, cal.m + delta, 1); cal.y = d.getFullYear(); cal.m = d.getMonth(); cal.sel = null; renderEvents(); };
    // strzałka jako SVG, żeby była idealnie na środku kółka (znaki ‹ › siedzą krzywo w czcionce)
    const chevron = (d) => '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const prev = btn("ghost cal-nav", "", () => move(-1)); prev.innerHTML = chevron("M15 5l-7 7 7 7"); prev.setAttribute("aria-label", t().calPrev);
    const next = btn("ghost cal-nav", "", () => move(1)); next.innerHTML = chevron("M9 5l7 7-7 7"); next.setAttribute("aria-label", t().calNext);
    const title = el("h3", "cal-title", fmt({ month: "long", year: "numeric" }, first));
    title.setAttribute("aria-live", "polite");
    // trzy kolumny: [‹] [tytuł na środku] [Dziś ›] — tytuł zawsze w środku, strzałki przy krawędziach
    const left = el("div", "cal-side"), right = el("div", "cal-side end");
    left.appendChild(prev);
    const now = new Date();
    if (cal.y !== now.getFullYear() || cal.m !== now.getMonth()) {
      right.appendChild(btn("link cal-today", t().calToday, () => { cal.y = now.getFullYear(); cal.m = now.getMonth(); cal.sel = null; renderEvents(); }));
    }
    right.appendChild(next);
    head.appendChild(left); head.appendChild(title); head.appendChild(right);
    wrap.appendChild(head);

    const grid = el("div", "cal-grid");
    grid.setAttribute("role", "grid");
    // nagłówki dni tygodnia, od poniedziałku (5–11.01.2026 to poniedziałek–niedziela)
    for (let i = 0; i < 7; i++) grid.appendChild(el("span", "cal-wd", fmt({ weekday: "short" }, isoOf(2026, 0, 5 + i))));
    const offset = (new Date(cal.y, cal.m, 1).getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) grid.appendChild(el("span", "cal-blank"));
    for (let d = 1; d <= days; d++) {
      const iso = isoOf(cal.y, cal.m, d), evs = byDay[iso] || [];
      const cell = el("button", "cal-day" + (evs.length ? " has" : "") + (iso === today ? " today" : "") + (iso < today ? " past" : ""));
      cell.type = "button";
      cell.disabled = !evs.length;
      cell.setAttribute("aria-pressed", String(iso === cal.sel));
      cell.setAttribute("aria-label", fmt({ weekday: "long", day: "numeric", month: "long" }, iso) + (evs.length ? ": " + t().eventsCount(evs.length) : ""));
      cell.appendChild(el("span", "cal-num", String(d)));
      if (evs.length) {
        const dots = el("span", "cal-dots");
        evs.slice(0, 3).forEach((e) => dots.appendChild(el("span", "cal-dot" + typeClass(e))));
        if (evs.length > 3) dots.appendChild(el("span", "cal-more", "+" + (evs.length - 3)));
        cell.appendChild(dots);
        cell.addEventListener("click", () => { cal.sel = iso; renderEvents(); });
      }
      grid.appendChild(cell);
    }
    wrap.appendChild(grid);

    const day = el("div", "cal-daylist");
    if (!Object.keys(byDay).length) day.appendChild(el("p", "small", t().calEmpty));
    else if (cal.sel) {
      day.appendChild(el("h4", "cal-dayhead", fmt({ weekday: "long", day: "numeric", month: "long" }, cal.sel)));
      const list = el("div", "pop-list");
      byDay[cal.sel].forEach((e) => list.appendChild(eventMiniRow(e, [e.city, e.venue].filter(Boolean).join(", "))));
      day.appendChild(list);
    }
    wrap.appendChild(day);
    box.appendChild(wrap);
  }

  async function renderMap(items) {
    const box = $("event-map"), note = $("map-note");
    note.textContent = "";
    let L;
    try { L = await loadLeaflet(); }
    catch (err) { note.appendChild(el("div", "notice bad", t().mapError)); return; }
    if (state.mode !== "map") return;
    if (!map) {
      map = L.map(box, { scrollWheelZoom: false }).setView([52.0, 19.2], 6);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: t().mapAttribution }).addTo(map);
      markerLayer = L.layerGroup().addTo(map);
    }
    setTimeout(() => map.invalidateSize(), 0);
    markerLayer.clearLayers();
    if (!items.length) note.appendChild(el("p", "small", t().noMatch));
    const groups = new Map(), unknown = [];
    items.forEach((e) => {
      if (e.lat == null || e.lng == null) { unknown.push(e); return; }
      const k = cityKey(e.city);
      if (!groups.has(k)) groups.set(k, { name: e.city, coords: [e.lat, e.lng], events: [] });
      groups.get(k).events.push(e);
    });
    const pts = [];
    groups.forEach((g) => {
      const n = g.events.length;
      const icon = L.divIcon({ className: "pin", html: "<span>" + n + "</span>", iconSize: [34, 34], iconAnchor: [17, 17] });
      const m = L.marker(g.coords, { icon, title: g.name });
      m.bindPopup(mapPopup(g), { maxWidth: 320, minWidth: 260, className: "ae-popup" });
      markerLayer.addLayer(m); pts.push(g.coords);
    });
    if (pts.length === 1) map.setView(pts[0], 10);
    else if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40], maxZoom: 10 });
    if (unknown.length) {
      const p = el("p", "small");
      p.appendChild(document.createTextNode(t().mapNoPin + " "));
      p.appendChild(document.createTextNode(unknown.map((e) => e.title + " (" + e.city + ")").join(", ")));
      note.appendChild(p);
    }
  }

  function renderModeSwitch() {
    const box = $("mode-switch"); if (!box) return;
    box.textContent = "";
    [["list", t().modeList], ["month", t().modeMonth], ["map", t().modeMap]].forEach(([k, l]) => {
      const b = el("button", "seg", l); b.type = "button";
      b.setAttribute("aria-pressed", String(state.mode === k));
      b.addEventListener("click", () => { if (state.mode === k) return; state.mode = k; store.set("ae-mode", k); renderModeSwitch(); renderEvents(); });
      box.appendChild(b);
    });
  }

  function renderEvents() {
    const list = $("event-list"); list.textContent = ""; list.hidden = false;
    $("map-note").textContent = "";
    if (state.mode !== "map" || !state.events.length) $("map-wrap").hidden = true;
    if (!state.sb) { list.appendChild(el("div", "notice bad", t().configMissing)); return; }
    if (state.eventsError) { list.appendChild(el("div", "notice bad", t().loadError)); return; }
    if (!state.eventsLoaded) { list.appendChild(el("p", "small", t().loading)); return; }
    if (!state.events.length) {
      const box = el("div", "empty");
      box.appendChild(el("h3", null, t().emptyTitle));
      box.appendChild(el("p", null, t().emptyText));
      const a = el("a", "btn primary", t().emptyCta); a.href = "#add";
      box.appendChild(a); list.appendChild(box); return;
    }
    const items = filteredEvents();
    const isMap = state.mode === "map";
    $("map-wrap").hidden = !isMap;
    list.hidden = isMap;
    if (state.mode === "month") { renderMonth(filteredEvents({ keepPast: true }), list); return; }
    if (!items.length && !isMap) { list.appendChild(el("p", "small", state.filter.past ? t().noMatchPast : t().noMatch)); return; }
    if (isMap) { renderMap(items); return; }
    let curMonth = "", grid = null;
    items.forEach((e) => {
      const m = e.date_start.slice(0, 7);
      if (m !== curMonth) {
        curMonth = m;
        list.appendChild(el("div", "month", fmt({ month: "long", year: "numeric" }, e.date_start)));
        grid = el("div", "grid"); list.appendChild(grid);
      }
      grid.appendChild(eventCard(e));
    });
    setupClamps(list);
  }

  // ------------------------------------------------------------------
  // Formularz (dodaj / popraw)
  // ------------------------------------------------------------------
  const FIELDS = [
    ["i-title", "title"], ["i-type", "type"], ["i-level", "level"], ["i-aud", "audience"], ["i-org", "organizer"],
    ["i-start", "date_start"], ["i-end", "date_end"], ["i-city", "city"], ["i-venue", "venue"],
    ["i-deadline", "reg_deadline"], ["i-url", "reg_url"], ["i-desc", "description"],
  ];
  function resetForm() {
    $("event-form").reset();
    renderDiscChecks([]);
    renderLevelChips();
    $("i-aud").value = "all";
    $("i-price").disabled = false;
    $("form-msg").textContent = "";
    formGeo = null; $("geo-note").textContent = "";
  }
  function startEdit(e) {
    state.editing = e;
    resetForm();
    FIELDS.forEach(([id, k]) => { $(id).value = e[k] == null ? "" : e[k]; });
    if (!$("i-aud").value) $("i-aud").value = "all";
    if (e.date_end === e.date_start) $("i-end").value = "";
    renderDiscChecks(discsOf(e));
    renderLevelChips();
    fillVenueHints();
    if (e.lat != null) { formGeo = { city: e.city, lat: e.lat, lng: e.lng }; $("geo-note").className = "hint geo-ok"; $("geo-note").textContent = t().geoFound + " " + e.city; }
    $("i-free").checked = !!e.is_free;
    $("i-price").disabled = !!e.is_free;
    $("i-price").value = e.price_pln == null ? "" : e.price_pln;
    location.hash = "#add";
    setView("add");
    window.scrollTo(0, 0);
  }
  // pinezka: po wpisaniu miejscowości szukamy jej raz w OSM i pokazujemy, co znaleźliśmy
  let formGeo = null; // { city, lat, lng } dla miejscowości wpisanej w formularzu
  async function lookupFormCity() {
    const input = $("i-city"), note = $("geo-note");
    const city = input.value.trim();
    if (!city) { formGeo = null; note.textContent = ""; return; }
    if (formGeo && formGeo.city === city) return;
    note.className = "hint"; note.textContent = t().geoSearching;
    const hit = await withTimeout(geocodeCity(city), 6000);
    if (input.value.trim() !== city) return; // w międzyczasie wpisano coś innego
    formGeo = { city, lat: hit ? hit.lat : null, lng: hit ? hit.lng : null };
    note.className = "hint " + (hit ? "geo-ok" : "geo-miss");
    note.textContent = hit ? t().geoFound + " " + hit.label : (hit === null ? t().geoNotFound : "");
  }
  $("i-city").addEventListener("change", lookupFormCity);
  $("i-city").addEventListener("input", fillVenueHints);
  $("i-city").addEventListener("change", fillVenueHints);

  $("i-free").addEventListener("change", (e) => { $("i-price").disabled = e.target.checked; if (e.target.checked) $("i-price").value = ""; });

  // link do zapisów: od razu „https://”, a adres bez protokołu sam dostaje „https://”
  function normalizeUrl(v) {
    v = (v || "").trim().replace(/^(?:https?:\/\/)+(https?:\/\/)/i, "$1");
    if (!v || /^https?:\/\/$/i.test(v)) return "";
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = "https://" + v.replace(/^\/+/, "");
    return v;
  }
  const urlInput = $("i-url");
  urlInput.addEventListener("focus", () => { if (!urlInput.value.trim()) urlInput.value = "https://"; });
  urlInput.addEventListener("blur", () => { urlInput.value = normalizeUrl(urlInput.value); });
  urlInput.addEventListener("paste", (e) => {
    const txt = (e.clipboardData && e.clipboardData.getData("text")) || "";
    if (/^https?:\/\//i.test(txt.trim()) && /^https?:\/\/$/i.test(urlInput.value.trim())) { e.preventDefault(); urlInput.value = txt.trim(); }
  });
  $("cancel-edit").addEventListener("click", () => { state.editing = null; resetForm(); location.hash = state.isAdmin ? "#admin" : "#mine"; });

  function renderForm() {
    const loginBox = $("add-login"); loginBox.textContent = "";
    const form = $("event-form");
    if (!state.sb) { loginBox.appendChild(el("div", "notice bad", t().configMissing)); form.hidden = true; return; }
    if (!state.user) { loginBox.appendChild(loginCard("loginTextAdd")); form.hidden = true; return; }
    form.hidden = false;
    const editing = !!state.editing;
    $("form-title").textContent = editing ? t().formEditTitle : t().formAddTitle;
    $("form-intro").textContent = state.isAdmin ? t().formAdminIntro : (editing ? t().formEditIntro : t().formIntro);
    $("submit-btn").textContent = state.isAdmin ? (editing ? t().submitEdit : t().submitAdmin) : (editing ? t().submitEdit : t().submitNew);
    $("cancel-edit").hidden = !editing;
  }

  $("event-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const msg = $("form-msg"); msg.textContent = "";
    const say = (k, txt) => msg.appendChild(el("div", "notice " + k, txt));
    const v = (id) => $(id).value.trim();
    const data = {};
    $("i-url").value = normalizeUrl($("i-url").value);
    await lookupFormCity(); // gdyby ktoś wysłał formularz, nie wychodząc z pola „Miasto”
    FIELDS.forEach(([id, k]) => { data[k] = v(id) || null; });
    data.studio_id = matchStudio(data.venue, data.city);
    const geo = formGeo && formGeo.city === data.city ? formGeo : null; // bez pinezki uzupełni ją panel admina
    data.lat = geo ? geo.lat : null;
    data.lng = geo ? geo.lng : null;
    if (!AUDIENCES.includes(data.audience)) data.audience = "all";
    data.disciplines = selectedDiscs();
    data.discipline = data.disciplines.length === 1 ? data.disciplines[0] : (data.disciplines.length > 1 ? "mixed" : null);
    data.is_free = $("i-free").checked;
    data.price_pln = data.is_free || v("i-price") === "" ? null : Math.max(0, Math.round(Number(v("i-price"))));
    const missing = [];
    if (!data.title) missing.push(t().fTitle);
    if (!data.type) missing.push(t().fType);
    if (!data.level) missing.push(t().fLevel);
    if (!data.date_start) missing.push(t().fStart);
    if (!data.city) missing.push(t().fCity);
    if (!data.reg_url) missing.push(t().fUrl);
    if (missing.length) { say("bad", t().errRequired + missing.join(", ")); return; }
    if (!safeUrl(data.reg_url)) { say("bad", t().errUrl); return; }
    if (!data.date_end) data.date_end = data.date_start;
    if (data.date_end < data.date_start) { say("bad", t().errDates); return; }

    const submit = $("submit-btn"); submit.disabled = true;
    let res;
    if (state.editing) {
      res = await state.sb.from("events").update(data).eq("id", state.editing.id);
    } else {
      if (state.isAdmin) data.status = "approved";
      res = await state.sb.from("events").insert(data);
    }
    submit.disabled = false;
    if (res.error) {
      console.error(res.error);
      say("bad", res.error.code === "P0001" ? res.error.message : t().errSave);
      return;
    }
    const doneMsg = state.isAdmin ? t().published : (state.editing ? t().saved : t().sent);
    state.editing = null; resetForm();
    await Promise.all([loadEvents(), loadMine(), loadPending()]);
    location.hash = state.isAdmin ? "#events" : "#mine";
    notice("ok", doneMsg);
  });

  // ------------------------------------------------------------------
  // Moje wydarzenia
  // ------------------------------------------------------------------
  function confirmButton(label, confirmLabel, action) {
    const b = btn("ghost", label);
    let armed = false;
    b.addEventListener("click", async () => {
      if (!armed) { armed = true; b.textContent = confirmLabel; b.className = "btn bad"; return; }
      b.disabled = true; await action(); b.disabled = false;
    });
    return b;
  }
  function renderMine() {
    const loginBox = $("mine-login"); loginBox.textContent = "";
    const list = $("mine-list"); list.textContent = "";
    if (!state.sb) return;
    if (!state.user) { loginBox.appendChild(loginCard("loginTextMine")); return; }
    if (!state.mine.length) {
      const box = el("div", "empty");
      box.appendChild(el("p", null, t().mineEmpty));
      const a = el("a", "btn primary", t().emptyCta); a.href = "#add"; box.appendChild(a);
      list.appendChild(box); return;
    }
    state.mine.forEach((e) => {
      const edit = btn("ghost", t().edit, () => startEdit(e));
      const del = confirmButton(t().del, t().confirmDel, async () => {
        const { error } = await state.sb.from("events").delete().eq("id", e.id);
        if (error) { console.error(error); notice("bad", t().errSave); return; }
        await Promise.all([loadEvents(), loadMine()]);
        notice("ok", t().deleted);
      });
      list.appendChild(eventRow(e, { status: true, hideRegister: true, actions: [edit, del] }));
    });
    setupClamps(list);
  }

  // ------------------------------------------------------------------
  // Panel admina
  // ------------------------------------------------------------------
  function decisionUI(e, rejectLabel) {
    const wrap = el("div", "reason"); wrap.hidden = true;
    const ta = el("textarea"); ta.rows = 2; ta.maxLength = 500; ta.placeholder = t().reasonPh; ta.id = "reason-" + e.id;
    const send = btn("bad", t().confirmReject);
    const err = el("div");
    wrap.appendChild(ta); wrap.appendChild(send); wrap.appendChild(err);
    send.addEventListener("click", async () => {
      err.textContent = "";
      const reason = ta.value.trim();
      if (!reason) { err.appendChild(el("div", "notice bad", t().needReason)); return; }
      send.disabled = true;
      await decide(e, "rejected", reason);
      send.disabled = false;
    });
    const open = btn("bad", rejectLabel, () => { wrap.hidden = !wrap.hidden; if (!wrap.hidden) ta.focus(); });
    return { open, wrap };
  }
  async function decide(e, status, reason) {
    const patch = { status };
    patch.rejection_reason = status === "rejected" ? reason : null;
    const { error } = await state.sb.from("events").update(patch).eq("id", e.id);
    if (error) { console.error(error); notice("bad", t().errSave); return; }
    await Promise.all([loadEvents(), loadPending(), loadMine()]);
    notice("ok", t().decided);
  }
  // znacznik „Zgłoszone … · poprawione …” na górze wiersza w panelu admina
  function submittedStamp(e) {
    const f = (d) => new Intl.DateTimeFormat(loc(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
    const edited = e.updated_at && e.created_at && new Date(e.updated_at) - new Date(e.created_at) > 60000;
    return el("p", "stamp", t().submitted + " " + f(e.created_at) + (edited ? " · " + t().editedAt + " " + f(e.updated_at) : ""));
  }
  const newestFirst = (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
  let adminTab = "review", adminQ = "";
  $("admin-q").addEventListener("input", (ev) => { adminQ = ev.target.value.trim().toLowerCase(); renderAdmin(); });

  function renderAdmin() {
    $("tab-admin").hidden = !state.isAdmin;
    const cnt = $("pending-count"); cnt.hidden = !state.pending.length; cnt.textContent = String(state.pending.length);
    const list = $("admin-list"); list.textContent = "";
    const pub = $("admin-published"); pub.textContent = "";
    const settings = $("admin-settings"); settings.textContent = "";
    const tabs = $("admin-tabs"); tabs.textContent = "";
    tabs.hidden = !state.isAdmin;
    $("admin-intro").hidden = true; $("admin-pub-box").hidden = true; settings.hidden = true; list.hidden = false;
    if (!state.isAdmin) {
      if (!state.sb) return;
      if (!state.authReady) list.appendChild(el("p", "small", t().loading));
      else if (!state.user) list.appendChild(loginCard("loginTextAdmin"));
      return;
    }
    // zakładki: Do sprawdzenia / Opublikowane / Konto
    [["review", t().adminTabReview, state.pending.length], ["published", t().adminTabPublished, state.events.length], ["settings", t().adminTabSettings, 0]].forEach(([k, label, n]) => {
      const b = el("button", null, label); b.type = "button"; b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(adminTab === k));
      if (n) { const c = el("span", "count" + (k === "review" ? " hot" : ""), String(n)); b.appendChild(document.createTextNode(" ")); b.appendChild(c); }
      b.addEventListener("click", () => { adminTab = k; renderAdmin(); });
      tabs.appendChild(b);
    });

    if (adminTab === "review") {
      $("admin-intro").hidden = false;
      $("admin-intro").textContent = t().adminIntro + " " + t().adminReviewHint;
      if (!state.pending.length) list.appendChild(el("p", "small", t().adminEmpty));
      state.pending.slice().sort(newestFirst).forEach((e) => {
        const ok = btn("ok", t().approve, async () => { ok.disabled = true; await decide(e, "approved"); });
        const { open, wrap } = decisionUI(e, t().reject);
        const edit = btn("ghost", t().edit, () => startEdit(e));
        const row = eventRow(e, { actions: [ok, open, edit], after: wrap });
        row.querySelector(".ev-body").prepend(submittedStamp(e));
        list.appendChild(row);
      });
    } else if (adminTab === "published") {
      list.hidden = true;
      $("admin-pub-box").hidden = false;
      pub.appendChild(el("p", "small", t().adminPubHint));
      const q = adminQ;
      const items = state.events.filter((e) => !q || [e.title, e.city, e.organizer, e.venue].filter(Boolean).join(" ").toLowerCase().includes(q));
      if (!items.length) pub.appendChild(el("p", "small", t().adminEmpty));
      items.slice().sort(newestFirst).forEach((e) => {
        const { open, wrap } = decisionUI(e, t().unpublish);
        const edit = btn("ghost", t().edit, () => startEdit(e));
        const row = eventRow(e, { hideRegister: true, actions: [edit, open], after: wrap });
        row.querySelector(".ev-body").prepend(submittedStamp(e));
        pub.appendChild(row);
      });
    } else {
      list.hidden = true;
      settings.hidden = false;
      settings.appendChild(passwordSettings());
    }
    setupClamps($("view-admin"));
  }

  function renderAll() {
    renderAccount(); renderModeSwitch(); renderChips(); renderCityFilter(); renderEvents(); renderForm(); renderMine(); renderAdmin();
  }

  // ------------------------------------------------------------------
  // Dane
  // ------------------------------------------------------------------
  // studia z mapy (do ramki przy wydarzeniu i podpowiedzi miejsca); wczytywane raz
  async function loadStudios() {
    const { data, error } = await state.sb.from("studios").select("id,name,city,address,logo_path").eq("status", "approved").order("name");
    if (error) { console.warn("studios:", error.message); return; }
    state.studios = data || [];
    state.studioById = Object.fromEntries(state.studios.map((s) => [s.id, s]));
    renderEvents();
  }
  async function loadEvents() {
    const { data, error } = await state.sb.from("events").select("*").eq("status", "approved").order("date_start");
    state.eventsLoaded = true;
    state.eventsError = !!error;
    if (error) console.error(error);
    state.events = data || [];
    renderAll();
  }
  async function loadMine() {
    if (!state.user) { state.mine = []; return; }
    const { data, error } = await state.sb.from("events").select("*").eq("created_by", state.user.id).order("created_at", { ascending: false });
    if (error) console.error(error);
    state.mine = data || [];
    renderMine();
  }
  async function loadPending() {
    if (!state.isAdmin) { state.pending = []; return; }
    const { data, error } = await state.sb.from("events").select("*").eq("status", "pending").order("date_start");
    if (error) console.error(error);
    state.pending = data || [];
    renderAdmin();
  }
  async function onAuth(session) {
    state.user = session ? session.user : null;
    state.isAdmin = false;
    state.authReady = true;
    if (state.user) {
      const { data } = await state.sb.rpc("is_admin");
      state.isAdmin = data === true;
    }
    await Promise.all([loadMine(), loadPending()]);
    if (state.isAdmin) loadEvents().then(backfillCoords); // świeża lista, potem uzupełnianie pinezek w tle
    const after = store.get("ae-after-login");
    if (state.user && after) { store.del("ae-after-login"); location.hash = "#" + after; setView(after); return; }
    setView(viewFromHash() || state.view);
  }

  // ------------------------------------------------------------------
  // Start
  // ------------------------------------------------------------------
  store.del("ae-geo"); // sprzątanie po starej wersji mapy, która zapamiętywała współrzędne w przeglądarce

  // błąd z linku logowania (np. wygasły link)
  const rawHash = location.hash || "";
  if (/error_description=|error_code=/.test(rawHash)) {
    history.replaceState(null, "", location.pathname + "#" + (store.get("ae-after-login") || "add"));
    setTimeout(() => notice("bad", t().linkExpired), 0);
  }

  const configured = CFG.supabaseUrl && CFG.supabaseAnonKey && !/WKLEJ/.test(CFG.supabaseAnonKey) && window.supabase;
  if (configured) {
    state.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  state.mode = ["map", "month"].includes(store.get("ae-mode")) ? store.get("ae-mode") : "list";
  state.view = viewFromHash() || "events";
  applyText();
  setView(state.view);

  if (state.sb) {
    loadEvents();
    loadStudios();
    let first = true;
    state.sb.auth.onAuthStateChange((event, session) => {
      // po kliknięciu linku z maila usuwamy tokeny z paska adresu
      if (/access_token=/.test(location.hash)) history.replaceState(null, "", location.pathname + "#" + (store.get("ae-after-login") || state.view));
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT" || first) {
        first = false;
        // poza callbackiem, żeby nie blokować klienta Supabase
        setTimeout(() => onAuth(session), 0);
      }
    });
  }
})();
