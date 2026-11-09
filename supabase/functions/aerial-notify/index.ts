// =====================================================================
// Aerial · Fundacja Cyrkarium · Edge Function „aerial-notify”
//
// Osobna funkcja dla aerial.cyrkarium.com. Funkcja „notify” z Aerial Events
// zostaje bez zmian.
//
// Wywoływana przez Database Webhooki (nagłówek x-webhook-secret):
//   • listing_messages INSERT → wiadomość do autora ogłoszenia, reply-to nadawcy
//   • listings INSERT/UPDATE  → nowe / poprawione ogłoszenie do adminów (ze zdjęciami i zmianami),
//                               zatwierdzone / odrzucone do autora
//   • studios INSERT/UPDATE   → nowe / poprawione studio do adminów (szczegóły, zmiany, ostrzeżenia),
//                               zatwierdzone / odrzucone do autora, przejęcie profilu do adminów
//   • makers INSERT/UPDATE    → jak studia
//   • entry_reports INSERT    → zgłoszenie nieaktualnych danych do adminów
//
// Sekrety (Edge Functions → Secrets), te same co dla „notify”:
//   RESEND_API_KEY, WEBHOOK_SECRET
// SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY Supabase podaje sam.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const FROM = "Aerial w Polsce <aerialevents@cyrkarium.com>";
const SITE = "https://aerial.cyrkarium.com";
const C = { violet: "#4B3373", green: "#3D562B", lilac: "#CAC2DF", lime: "#D1DFA8", bg: "#F4F2F8", ink: "#2A2140", muted: "#6B6280" };
const CATS: Record<string, string> = { partner: "Partner", gear: "Sprzęt i stroje", space: "Sala / studio", job: "Praca / zastępstwo" };
// rodzaj ogłoszenia (te same nazwy co w i18n.js strony)
const KINDS: Record<string, Record<string, string>> = {
  partner: { seek: "Szukam partnera" },
  gear: { sell: "Sprzedam", buy: "Kupię / szukam", give: "Oddam za darmo" },
  space: { offer: "Wynajmę", seek: "Szukam sali" },
  job: { offer: "Szukam instruktora", seek: "Szukam pracy / zastępstwa" },
};

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
interface Payload { type: "INSERT" | "UPDATE" | "DELETE"; table: string; schema: string; record: Row | null; old_record: Row | null }
interface Mail { to: string[]; subject: string; html: string; text: string; reply_to?: string }

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const p = (t: string, size = 15, color = C.ink) => `<p style="margin:0 0 14px;font-size:${size}px;line-height:1.6;color:${color};">${t}</p>`;
const quote = (t: string) => `<div style="margin:6px 0 18px;padding:14px 16px;background:${C.bg};border-left:4px solid ${C.violet};font-size:15px;line-height:1.6;color:${C.ink};white-space:pre-wrap;">${esc(t)}</div>`;
const button = (href: string, label: string, ghost = false) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px;"><tr><td bgcolor="${ghost ? "#FFFFFF" : C.violet}" style="background:${ghost ? "#FFFFFF" : C.violet};border:1px solid ${C.violet};border-radius:999px;">
<a href="${esc(href)}" style="display:inline-block;padding:12px 26px;font-size:15px;font-weight:bold;color:${ghost ? C.violet : "#FFFFFF"};text-decoration:none;border-radius:999px;">${esc(label)}</a></td></tr></table>`;

function layout(inner: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:${C.ink};">
<tr><td bgcolor="${C.violet}" style="background:${C.violet};padding:26px 32px 22px;">
<div style="font-size:22px;line-height:1.2;font-weight:bold;color:#FFFFFF;">Aerial w Polsce</div>
<div style="font-size:13px;color:${C.lilac};padding-top:4px;">Fundacja Cyrkarium</div></td></tr>
<tr><td bgcolor="${C.lime}" style="background:${C.lime};height:5px;line-height:5px;font-size:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 16px;">${inner}</td></tr>
<tr><td bgcolor="${C.bg}" style="background:${C.bg};padding:18px 32px;font-size:12px;line-height:1.6;color:#5A4F6E;">
Studia, wydarzenia i ogłoszenia aerial w Polsce · <a href="${SITE}" style="color:${C.green};">aerial.cyrkarium.com</a><br>
Prowadzi Fundacja Cyrkarium</td></tr>
</table></td></tr></table></body></html>`;
}

// --- treści ------------------------------------------------------------
export function messageMail(l: Row, m: Row, authorEmail: string): Mail {
  const first = String(m.sender_name).trim().split(/\s+/)[0];
  const inner =
    p(`Cześć ${esc(l.nick)}!`, 16) +
    p(`<strong>${esc(m.sender_name)}</strong> odpisał(a) na Twoje ogłoszenie <strong>„${esc(l.title)}”</strong>:`) +
    quote(m.message) +
    // bez przycisku mailto: w Gmailu i części programów otwiera on obcą aplikację albo nic;
    // zwykłe „Odpowiedz” działa wszędzie, bo mail ma reply-to nadawcy
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr>
<td bgcolor="${C.lime}" style="background:${C.lime};border-radius:10px;padding:14px 16px;font-size:15px;line-height:1.55;color:${C.ink};">
<strong>Jak odpowiedzieć?</strong> Kliknij <strong>Odpowiedz</strong> w swojej poczcie, tak jak przy zwykłym mailu. Odpowiedź trafi prosto do: ${esc(first)}.<br>
<span style="font-size:13px;color:${C.muted};">Adres nadawcy: ${esc(m.sender_email)}. Twój adres zobaczy dopiero, gdy odpiszesz.</span>
</td></tr></table>` +
    button(`${SITE}/account/`, "Zamknij ogłoszenie, już znalazłam/em", true) +
    p(`To spam albo coś niepokojącego? Przekaż tego maila na <a href="mailto:office@cyrkarium.com" style="color:${C.green};">office@cyrkarium.com</a>. Twojego adresu nie udostępniliśmy nikomu.`, 12, C.muted) +
    p(`<em>${esc(first)} wrote about your listing. Hit Reply to answer directly; only then will they see your email address.</em>`, 12, C.muted);
  return {
    to: [authorEmail],
    reply_to: m.sender_email,
    subject: `Nowa wiadomość: ${l.title}`,
    html: layout(inner),
    text: `${m.sender_name} odpisał(a) na Twoje ogłoszenie „${l.title}”:\n\n${m.message}\n\nOdpowiedz na tego maila, żeby napisać bezpośrednio do nadawcy.\nZamknij ogłoszenie: ${SITE}/account/`,
  };
}

function listingCard(l: Row): string {
  const kind = KINDS[l.category]?.[l.kind] ?? "";
  const price = l.kind === "give" ? "za darmo" : l.price;
  return quote(`${CATS[l.category] ?? l.category}${kind ? " · " + kind : ""} · ${l.city} · ${l.nick}${price ? " · " + price : ""}\n\n${l.title}\n\n${l.description}`);
}

// słowniki (te same nazwy co w i18n.js strony)
const DISC: Record<string, string> = { hoop: "koło", silks: "szarfy", rope: "lina", hammock: "hamak", aerial_yoga: "aerial joga", trapeze: "trapez", straps: "pasy", pole: "pole", hair: "wiszenie na włosach", other: "inne przyrządy" };
const ACT: Record<string, string> = { stretching: "stretching", yoga: "joga", pilates: "pilates", dance: "taniec", acro: "akrobatyka", fitness: "fitness" };
const LVL: Record<string, string> = { beginner: "początkujący", intermediate: "średniozaawansowany", advanced: "zaawansowany" };
const PROD: Record<string, string> = { hoops: "koła", silks: "szarfy i tkaniny", frames: "ramy i stojaki", rigging: "sprzęt do zawieszenia", costumes: "stroje", mats: "materace", accessories: "akcesoria", other: "inne" };
const REASONS: Record<string, string> = { closed: "Już nie działa / zamknięte", address: "Zmienił się adres", links: "Nieaktualne linki", classes: "Inne zajęcia lub dyscypliny", other: "Coś innego" };
const STORAGE = "https://ggggimsfdusczeorobpm.supabase.co/storage/v1/object/public";
const labels = (keys: unknown, dict: Record<string, string>) => (Array.isArray(keys) ? keys : []).map((k) => dict[k] ?? k).join(", ");

// tabelka „pole: wartość” (puste wiersze pomijamy)
function details(rows: [string, string][]): string {
  const tr = rows.filter(([, v]) => v).map(([k, v]) =>
    `<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:${C.muted};vertical-align:top;white-space:nowrap;">${esc(k)}</td><td style="padding:6px 0;font-size:14px;line-height:1.5;color:${C.ink};">${v}</td></tr>`).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;width:100%;">${tr}</table>`;
}
const linkList = (urls: unknown[]) => urls.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u))
  .map((u) => `<a href="${esc(u)}" style="color:${C.green};word-break:break-all;">${esc(u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a>`).join("<br>");
const warnBox = (items: string[]) => items.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;"><tr>
<td bgcolor="#FBF0D4" style="background:#FBF0D4;border-radius:10px;padding:12px 14px;font-size:14px;line-height:1.55;color:#5A4300;"><strong>Zwróć uwagę:</strong><br>${items.map((i) => "• " + i).join("<br>")}</td></tr></table>` : "";
const badge = (t: string) => `<span style="display:inline-block;margin:0 6px 10px 0;padding:3px 10px;border-radius:999px;background:#E8EFD3;color:${C.green};font-size:12px;font-weight:bold;">${esc(t)}</span>`;
const logoHtml = (path: unknown) => path ? `<img src="${STORAGE}/logos/${esc(path)}" alt="logo" width="72" height="72" style="display:block;width:72px;height:72px;object-fit:contain;border-radius:50%;border:1px solid ${C.lilac};background:#FFFFFF;margin:0 0 14px;">` : "";
const photosHtml = (paths: unknown) => (Array.isArray(paths) && paths.length) ? `<div style="margin:0 0 16px;">${paths.map((ph) =>
  `<a href="${STORAGE}/listing-photos/${esc(ph)}"><img src="${STORAGE}/listing-photos/${esc(ph)}" alt="zdjęcie" width="120" height="120" style="width:120px;height:120px;object-fit:cover;border-radius:8px;margin:0 6px 6px 0;border:1px solid ${C.lilac};"></a>`).join("")}</div>` : "";

// co się zmieniło przy poprawce (było → jest)
function changes(o: Row | null, r: Row, fields: [string, string, ((v: unknown) => string)?][]): string {
  if (!o) return "";
  const show = (v: unknown, f?: (v: unknown) => string) => f ? f(v) : Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "tak" : "nie") : String(v ?? "");
  const rows = fields.filter(([k]) => JSON.stringify(o[k] ?? null) !== JSON.stringify(r[k] ?? null)).map(([k, label, f]) => {
    const was = show(o[k], f) || "—", now = show(r[k], f) || "—";
    return `<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:${C.muted};vertical-align:top;white-space:nowrap;">${esc(label)}</td><td style="padding:6px 0;font-size:14px;line-height:1.5;"><span style="color:#8A2E2E;text-decoration:line-through;">${esc(was.slice(0, 300))}</span><br><span style="color:${C.green};">${esc(now.slice(0, 300))}</span></td></tr>`;
  });
  return rows.length ? p("<strong>Co się zmieniło</strong>", 14) + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;width:100%;">${rows.join("")}</table>`
    : p("Bez zmian w treści (np. tylko ponowny zapis).", 13, C.muted);
}

// ten sam „slug” co w app.js (do linku „Zobacz profil”)
const slugify = (x: string) => x.toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
export function uniqueSlug(rows: Row[], x: Row, extraOf: (y: Row) => string): string {
  const base = slugify(`${x.name} ${x.city}`);
  if (!base) return String(x.id);
  const twins = rows.filter((y) => slugify(`${y.name} ${y.city}`) === base && (y.status === "approved" || String(y.id) === String(x.id)));
  if (twins.length < 2) return base;
  const ex = slugify(extraOf(x) || "");
  const clash = !ex || twins.filter((y) => slugify(extraOf(y) || "") === ex).length > 1;
  return clash ? `${base}${ex ? "-" + ex : ""}-${String(x.id).slice(0, 8)}` : `${base}-${ex}`;
}


export function adminListingMail(l: Row, old: Row | null, edited: boolean, admins: string[]): Mail {
  const lead = edited ? "Autor poprawił ogłoszenie, więc wróciło do kolejki." : "Nowe ogłoszenie czeka na sprawdzenie.";
  const n = Array.isArray(l.photos) ? l.photos.length : 0;
  const warn = n ? ["Sprawdź zdjęcia: tylko sprzęt lub strój, bez osób."] : [];
  return {
    to: admins,
    subject: `${edited ? "Poprawione" : "Nowe"} ogłoszenie: ${l.title} (${l.city})`,
    html: layout(p(lead) + warnBox(warn) + listingCard(l) + photosHtml(l.photos) +
      (edited ? changes(old, l, [["title", "Tytuł"], ["description", "Opis"], ["city", "Miasto"], ["price", "Cena"], ["category", "Kategoria"], ["kind", "Rodzaj"], ["photos", "Zdjęcia", (v) => `${Array.isArray(v) ? v.length : 0} szt.`]]) : "") +
      button(`${SITE}/account/`, "Otwórz kolejkę")),
    text: `${lead}\n\n${l.title}\n${l.city} · ${l.nick}${n ? ` · ${n} zdjęć` : ""}\n\n${l.description}\n\n${SITE}/account/`,
  };
}

export function authorListingMail(l: Row, to: string): Mail {
  if (l.status === "approved") {
    return {
      to: [to],
      subject: `Opublikowane: ${l.title}`,
      html: layout(p("Cześć!", 16) + p("Twoje ogłoszenie jest już na tablicy. Wiadomości od chętnych będą przychodzić na ten adres, a na stronie nikt go nie zobaczy.") + listingCard(l) +
        p("Ogłoszenie zniknie samo po 60 dniach. Gdy znajdziesz to, czego szukasz, zamknij je w „Moich wpisach”.", 14, C.muted) + button(`${SITE}/board/${l.id}`, "Zobacz ogłoszenie")),
      text: `Twoje ogłoszenie „${l.title}” jest już na tablicy: ${SITE}/board/${l.id}`,
    };
  }
  const reason = String(l.rejection_reason ?? "").trim();
  return {
    to: [to],
    subject: `Ogłoszenie nieopublikowane: ${l.title}`,
    html: layout(p("Cześć!", 16) + p(`Tym razem nie możemy opublikować ogłoszenia <strong>„${esc(l.title)}”</strong>.`) + (reason ? quote("Powód: " + reason) : "") +
      p("Możesz je poprawić i wysłać ponownie. Jeśli masz pytania, napisz na office@cyrkarium.com.", 14) + button(`${SITE}/account/`, "Popraw ogłoszenie")),
    text: `Nie możemy opublikować ogłoszenia „${l.title}”.${reason ? "\nPowód: " + reason : ""}\n\nPopraw: ${SITE}/account/`,
  };
}


const STUDIO_FIELDS: [string, string, ((v: unknown) => string)?][] = [
  ["name", "Nazwa"], ["city", "Miasto"], ["address", "Adres"], ["description", "Opis"],
  ["disciplines", "Dyscypliny", (v) => labels(v, DISC)], ["activities", "Inne zajęcia", (v) => labels(v, ACT)], ["levels", "Poziomy", (v) => labels(v, LVL)],
  ["kids", "Dla dzieci"], ["open_training", "Open training"], ["rental", "Wynajem sali"], ["birthdays", "Urodziny"],
  ["website_url", "Strona"], ["instagram_url", "Instagram"], ["facebook_url", "Facebook"], ["logo_path", "Logo", (v) => v ? "jest" : "brak"],
];

export function adminStudioMail(s: Row, old: Row | null, edited: boolean, admins: string[], similar: Row[], hasEmail: boolean): Mail {
  const lead = edited ? "Autor poprawił studio, więc wróciło do kolejki." : "Nowe studio czeka na sprawdzenie.";
  const opts = [s.kids && "zajęcia dla dzieci", s.open_training && "open training", s.rental && "wynajem sali", s.birthdays && "urodziny"].filter(Boolean).join(", ");
  const warn = [
    ...similar.map((x) => `Podobne studio już jest: <a href="${SITE}/studios/${esc(x.id)}" style="color:#5A4300;">${esc(x.name)}, ${esc(x.city)}${x.address ? ", " + esc(x.address) : ""}</a> (${x.status === "approved" ? "na mapie" : "w kolejce"})`),
    !s.description ? "Brak opisu." : "",
    !s.address ? "Brak adresu: pinezka stoi w centrum miasta." : "",
  ].filter(Boolean);
  const badges = (s.submitted_by_owner ? badge("Zgłoszenie od właściciela") : "") + (hasEmail ? badge("Podany e-mail kontaktowy") : "");
  const body = p(lead) + badges + warnBox(warn) + logoHtml(s.logo_path) +
    p(`<strong style="font-size:17px;">${esc(s.name)}</strong><br>${esc(s.city)}${s.address ? " · " + esc(s.address) : ""}`) +
    (s.description ? quote(s.description) : "") +
    details([["Dyscypliny", esc(labels(s.disciplines, DISC))], ["Inne zajęcia", esc(labels(s.activities, ACT))], ["Poziomy", esc(labels(s.levels, LVL))], ["Oferta", esc(opts)], ["Linki", linkList([s.website_url, s.instagram_url, s.facebook_url])]]) +
    (edited ? changes(old, s, STUDIO_FIELDS) : "") +
    button(`${SITE}/account/`, "Otwórz kolejkę") + button(`${SITE}/studios/${s.id}`, "Pokaż na mapie", true);
  return {
    to: admins,
    subject: `${edited ? "Poprawione" : "Nowe"} studio: ${s.name} (${s.city})${s.submitted_by_owner ? " · od właściciela" : ""}`,
    html: layout(body),
    text: `${lead}\n\n${s.name}, ${s.city}${s.address ? ", " + s.address : ""}\n${s.description ?? ""}\n\n${[s.website_url, s.instagram_url, s.facebook_url].filter(Boolean).join("\n")}\n\n${SITE}/account/`,
  };
}

const MAKER_FIELDS: [string, string, ((v: unknown) => string)?][] = [
  ["name", "Nazwa"], ["city", "Miasto"], ["description", "Opis"], ["products", "Produkty", (v) => labels(v, PROD)],
  ["custom_orders", "Na zamówienie"], ["ships_abroad", "Wysyłka za granicę"],
  ["website_url", "Strona"], ["shop_url", "Sklep"], ["instagram_url", "Instagram"], ["facebook_url", "Facebook"], ["logo_path", "Logo", (v) => v ? "jest" : "brak"],
];

export function adminMakerMail(m: Row, old: Row | null, edited: boolean, admins: string[], similar: Row[]): Mail {
  const lead = edited ? "Autor poprawił producenta, więc wrócił do kolejki." : "Nowy producent czeka na sprawdzenie.";
  const warn = [
    ...similar.map((x) => `Podobny producent już jest: ${esc(x.name)}, ${esc(x.city)} (${x.status === "approved" ? "na liście" : "w kolejce"})`),
    !m.description ? "Brak opisu." : "",
  ].filter(Boolean);
  const body = p(lead) + warnBox(warn) + logoHtml(m.logo_path) +
    p(`<strong style="font-size:17px;">${esc(m.name)}</strong><br>${esc(m.city)}`) + (m.description ? quote(m.description) : "") +
    details([["Produkty", esc(labels(m.products, PROD))], ["Oferta", esc([m.custom_orders && "na zamówienie", m.ships_abroad && "wysyłka za granicę"].filter(Boolean).join(", "))],
      ["Linki", linkList([m.website_url, m.shop_url, m.instagram_url, m.facebook_url])]]) +
    (edited ? changes(old, m, MAKER_FIELDS) : "") +
    button(`${SITE}/account/`, "Otwórz kolejkę") + button(`${SITE}/makers/${m.id}`, "Pokaż na liście", true);
  return {
    to: admins,
    subject: `${edited ? "Poprawiony" : "Nowy"} producent: ${m.name} (${m.city})`,
    html: layout(body),
    text: `${lead}\n\n${m.name}, ${m.city}\n${m.description ?? ""}\n\n${[m.website_url, m.shop_url, m.instagram_url, m.facebook_url].filter(Boolean).join("\n")}\n\n${SITE}/account/`,
  };
}

// do autora studia / producenta: zatwierdzone („jesteś na mapie”) albo odrzucone (z powodem)
export function ownerEntryMail(x: Row, kind: "studio" | "maker", slug: string, to: string, again = false): Mail {
  const isStudio = kind === "studio";
  const url = `${SITE}/${isStudio ? "studios" : "makers"}/${slug}`;
  if (x.status === "approved" && again) {
    // poprawka już opublikowanego wpisu: krótko, bez porad
    return {
      to: [to],
      subject: `Zmiany zatwierdzone: ${x.name}`,
      html: layout(p("Cześć!", 16) + p(`Twoje zmiany w <strong>${esc(x.name)}</strong> są już widoczne.`) + button(url, "Zobacz profil")),
      text: `Zmiany w ${x.name} są już widoczne: ${url}`,
    };
  }
  if (x.status === "approved") {
    const tips = isStudio
      ? [!x.logo_path && "dodaj logo, będzie widoczne na mapie i w podglądzie linku", !x.description && "dopisz krótki opis zajęć", "zaznacz urodziny, open training albo wynajem sali, jeśli je macie", "wydarzenia i warsztaty dodasz w kalendarzu: wybierz swoje studio w polu „Miejsce”"].filter(Boolean) as string[]
      : [!x.logo_path && "dodaj logo", !x.description && "dopisz krótki opis"].filter(Boolean) as string[];
    return {
      to: [to],
      subject: isStudio ? `Twoje studio jest na mapie: ${x.name}` : `Jesteś na liście producentów: ${x.name}`,
      html: layout(p("Cześć!", 16) +
        p(isStudio ? `<strong>${esc(x.name)}</strong> jest już na mapie studiów aerial w Polsce.` : `<strong>${esc(x.name)}</strong> jest już na liście polskich producentów aerial.`) +
        button(url, isStudio ? "Zobacz profil studia" : "Zobacz profil") +
        p(`Podziel się linkiem z uczniami i obserwującymi: <a href="${esc(url)}" style="color:${C.green};">${esc(url.replace("https://", ""))}</a><br><span style="font-size:13px;color:${C.muted};">Podgląd linku z nazwą i logo pojawi się w ciągu kilku godzin.</span>`) +
        (tips.length ? p("<strong>Warto jeszcze:</strong><br>" + tips.map((t) => "• " + esc(t)).join("<br>"), 14) : "") +
        p(`Poprawki zrobisz w <a href="${SITE}/account/" style="color:${C.green};">Moich wpisach</a>. Każda zmiana wraca na chwilę do sprawdzenia.`, 13, C.muted)),
      text: `${x.name} jest już ${isStudio ? "na mapie studiów" : "na liście producentów"}: ${url}\n\nPoprawki: ${SITE}/account/`,
    };
  }
  const reason = String(x.rejection_reason ?? "").trim();
  return {
    to: [to],
    subject: `Wymaga poprawki: ${x.name}`,
    html: layout(p("Cześć!", 16) + p(`Dziękujemy za zgłoszenie <strong>${esc(x.name)}</strong>. Tym razem nie możemy go opublikować w tej formie.`) +
      (reason ? quote("Powód: " + reason) : "") +
      p("Możesz je poprawić i wysłać ponownie. Jeśli masz pytania, napisz na office@cyrkarium.com.", 14) + button(`${SITE}/account/`, "Popraw zgłoszenie")),
    text: `Nie możemy opublikować „${x.name}” w tej formie.${reason ? "\nPowód: " + reason : ""}\n\nPopraw: ${SITE}/account/`,
  };
}

export function adminReportMail(r: Row, target: Row | null, kind: "studio" | "maker", admins: string[]): Mail {
  const name = target?.name ?? "(usunięty wpis)";
  const reasons = (r.reasons ?? []).map((k: string) => REASONS[k] ?? k);
  return {
    to: admins,
    reply_to: r.email || undefined,
    subject: `Zgłoszenie: ${name}${target ? ` (${target.city})` : ""}`,
    html: layout(p(`Ktoś zgłosił nieaktualne dane ${kind === "studio" ? "studia" : "producenta"} <strong>${esc(name)}</strong>${target ? `, ${esc(target.city)}` : ""}.`) +
      (reasons.length ? details([["Powód", esc(reasons.join(", "))]]) : "") + (r.message ? quote(r.message) : "") +
      (r.email ? p(`Odpowiedź: kliknij <strong>Odpowiedz</strong>, trafi do ${esc(r.email)}.`, 13, C.muted) : p("Zgłoszenie bez adresu e-mail.", 13, C.muted)) +
      (target ? button(`${SITE}/${kind === "studio" ? "studios" : "makers"}/${target.id}`, "Pokaż wpis") : "") + button(`${SITE}/account/`, "Zgłoszenia w Moich wpisach", true)),
    text: `Zgłoszenie: ${name}\n${reasons.join(", ")}\n${r.message ?? ""}\n${r.email ? "Od: " + r.email : ""}\n\n${SITE}/account/`,
  };
}

export function adminClaimMail(s: Row, ownerEmail: string, admins: string[]): Mail {
  return {
    to: admins,
    subject: `Profil przejęty: ${s.name} (${s.city})`,
    html: layout(p(`Profil studia <strong>${esc(s.name)}</strong>, ${esc(s.city)} ma nową osobę do edycji: <strong>${esc(ownerEmail)}</strong>.`) +
      p("Nic nie musisz robić. To informacja dla porządku. Jeśli to pomyłka, napisz do nas, a cofniemy zmianę w SQL.", 13, C.muted) +
      button(`${SITE}/studios/${s.id}`, "Pokaż profil", true)),
    text: `Profil ${s.name} (${s.city}) przejęty przez ${ownerEmail}.`,
  };
}

// --- kto dostaje maila (czysta funkcja) ---------------------------------
export type Kind = "message" | "admin_listing_new" | "admin_listing_edited" | "author_listing"
  | "admin_studio_new" | "admin_studio_edited" | "owner_studio" | "admin_claim"
  | "admin_maker_new" | "admin_maker_edited" | "owner_maker" | "admin_report";
export function decide(pl: Payload): Kind | null {
  if (pl.schema !== "public" || !pl.record) return null;
  const r = pl.record, o = pl.old_record;
  if (pl.table === "listing_messages") return pl.type === "INSERT" ? "message" : null;
  if (pl.table === "entry_reports") return pl.type === "INSERT" ? "admin_report" : null;
  if (pl.table === "listings") {
    if (pl.type === "INSERT") return r.status === "pending" ? "admin_listing_new" : null;
    if (pl.type !== "UPDATE" || !o || o.status === r.status) return null;
    if (r.status === "pending") return "admin_listing_edited";
    if (r.status === "approved" || r.status === "rejected") return "author_listing";
    return null;
  }
  if (pl.table === "studios" || pl.table === "makers") {
    const st = pl.table === "studios";
    if (pl.type === "INSERT") return r.status === "pending" ? (st ? "admin_studio_new" : "admin_maker_new") : null;
    if (pl.type !== "UPDATE" || !o) return null;
    if (o.status !== "pending" && r.status === "pending") return st ? "admin_studio_edited" : "admin_maker_edited";
    if (o.status === "pending" && (r.status === "approved" || r.status === "rejected")) return st ? "owner_studio" : "owner_maker";
    if (st && r.status === "approved" && o.created_by !== r.created_by) return "admin_claim";
  }
  return null;
}

// --- serwer -------------------------------------------------------------
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) return json({ error: "unauthorized" }, 401);

  let pl: Payload;
  try { pl = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const kind = decide(pl);
  if (!kind) return json({ skipped: true });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  const emailOf = async (id: string) => (await sb.auth.admin.getUserById(id)).data?.user?.email ?? null;
  const admins = async () => {
    const { data } = await sb.from("admins").select("user_id");
    return (await Promise.all((data ?? []).map((r: Row) => emailOf(r.user_id)))).filter((x): x is string => !!x);
  };

  let mail: Mail | null = null;
  const r = pl.record!, o = pl.old_record;
  const adminIds = async () => ((await sb.from("admins").select("user_id")).data ?? []).map((x: Row) => String(x.user_id));
  const words = (n: string) => slugify(n).split("-").filter((w) => w.length > 2 && !["studio", "aerial", "dance", "pole", "szkola", "akademia", "klub", "sportowy", "fundacja", "the"].includes(w));
  // podobne wpisy: to samo miasto i wspólne słowo w nazwie albo ta sama strona / Instagram
  const similarIn = async (table: string, x: Row) => {
    const { data } = await sb.from(table).select("id,name,city,address,status,website_url,instagram_url").ilike("city", x.city).neq("id", x.id).neq("status", "rejected");
    const mine = words(x.name);
    const host = (u: unknown) => typeof u === "string" ? u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "").toLowerCase() : "";
    return (data ?? []).filter((y: Row) => mine.some((w) => words(y.name).includes(w))
      || (x.website_url && host(y.website_url) === host(x.website_url) && !/fitssey|facebook|instagram/.test(host(x.website_url)))
      || (x.instagram_url && y.instagram_url && String(y.instagram_url).toLowerCase() === String(x.instagram_url).toLowerCase())).slice(0, 3);
  };
  if (kind === "message") {
    const { data: l } = await sb.from("listings").select("*").eq("id", r.listing_id).single();
    const to = l ? await emailOf(l.created_by) : null;
    if (l && to) mail = messageMail(l, r, to);
  } else if (kind === "admin_listing_new" || kind === "admin_listing_edited") {
    mail = adminListingMail(r, o, kind === "admin_listing_edited", await admins());
  } else if (kind === "author_listing") {
    const to = await emailOf(r.created_by);
    if (to) mail = authorListingMail(r, to);
  } else if (kind === "admin_studio_new" || kind === "admin_studio_edited") {
    const { data: em } = await sb.from("studio_emails").select("studio_id").eq("studio_id", r.id).maybeSingle();
    mail = adminStudioMail(r, o, kind === "admin_studio_edited", await admins(), await similarIn("studios", r), !!em);
  } else if (kind === "admin_maker_new" || kind === "admin_maker_edited") {
    mail = adminMakerMail(r, o, kind === "admin_maker_edited", await admins(), await similarIn("makers", r));
  } else if (kind === "owner_studio" || kind === "owner_maker") {
    // nie piszemy do adminów o ich własnych wpisach (np. import z mapy)
    if (!(await adminIds()).includes(String(r.created_by))) {
      const to = await emailOf(r.created_by);
      const table = kind === "owner_studio" ? "studios" : "makers";
      const { data: rows } = await sb.from(table).select("id,name,city,address,status").ilike("city", r.city);
      const slug = uniqueSlug(rows ?? [r], r, kind === "owner_studio" ? (y) => y.address : () => "");
      if (to) mail = ownerEntryMail(r, kind === "owner_studio" ? "studio" : "maker", slug, to, !!o?.reviewed_at);
    }
  } else if (kind === "admin_claim") {
    const who = await emailOf(r.created_by);
    if (who && !(await adminIds()).includes(String(r.created_by))) mail = adminClaimMail(r, who, await admins());
  } else if (kind === "admin_report") {
    const isStudio = !!r.studio_id;
    const { data: target } = await sb.from(isStudio ? "studios" : "makers").select("id,name,city").eq("id", isStudio ? r.studio_id : r.maker_id).maybeSingle();
    mail = adminReportMail(r, target ?? null, isStudio ? "studio" : "maker", await admins());
  }
  if (!mail || !mail.to.length) return json({ skipped: "no recipients" });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: mail.to, reply_to: mail.reply_to, subject: mail.subject, html: mail.html, text: mail.text }),
  });
  if (!res.ok) { console.error("resend", kind, res.status, await res.text()); return json({ error: "send failed" }, 502); }
  return json({ sent: kind, recipients: mail.to.length });
});
