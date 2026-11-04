// =====================================================================
// Aerial · Fundacja Cyrkarium · Edge Function „aerial-notify”
//
// Osobna funkcja dla aerial.cyrkarium.com. Funkcja „notify” z Aerial Events
// zostaje bez zmian.
//
// Wywoływana przez trzy Database Webhooki (nagłówek x-webhook-secret):
//   • listing_messages INSERT → wiadomość do autora ogłoszenia, reply-to nadawcy
//   • listings INSERT/UPDATE  → nowe / poprawione ogłoszenie do adminów,
//                               zatwierdzone / odrzucone do autora
//   • studios INSERT/UPDATE   → nowe / poprawione studio do adminów
//
// Sekrety (Edge Functions → Secrets), te same co dla „notify”:
//   RESEND_API_KEY, WEBHOOK_SECRET
// SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY Supabase podaje sam.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const FROM = "Aerial w Polsce <aerialevents@cyrkarium.com>";
const SITE = "https://aerial.cyrkarium.com";
const C = { violet: "#4B3373", green: "#3D562B", lilac: "#CAC2DF", lime: "#D1DFA8", bg: "#F4F2F8", ink: "#2A2140", muted: "#6B6280" };
const CATS: Record<string, string> = { partner: "Szukam partnera", gear: "Sprzęt", space: "Sala / studio", job: "Praca / zastępstwo" };

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
    button(`${SITE}/moje/`, "Zamknij ogłoszenie, już znalazłam/em", true) +
    p(`To spam albo coś niepokojącego? Przekaż tego maila na <a href="mailto:office@cyrkarium.com" style="color:${C.green};">office@cyrkarium.com</a>. Twojego adresu nie udostępniliśmy nikomu.`, 12, C.muted) +
    p(`<em>${esc(first)} wrote about your listing. Hit Reply to answer directly; only then will they see your email address.</em>`, 12, C.muted);
  return {
    to: [authorEmail],
    reply_to: m.sender_email,
    subject: `Nowa wiadomość: ${l.title}`,
    html: layout(inner),
    text: `${m.sender_name} odpisał(a) na Twoje ogłoszenie „${l.title}”:\n\n${m.message}\n\nOdpowiedz na tego maila, żeby napisać bezpośrednio do nadawcy.\nZamknij ogłoszenie: ${SITE}/moje/`,
  };
}

function listingCard(l: Row): string {
  return quote(`${CATS[l.category] ?? l.category} · ${l.city} · ${l.nick}${l.price ? " · " + l.price : ""}\n\n${l.title}\n\n${l.description}`);
}

export function adminListingMail(l: Row, edited: boolean, admins: string[]): Mail {
  const lead = edited ? "Autor poprawił ogłoszenie, więc wróciło do kolejki." : "Nowe ogłoszenie czeka na sprawdzenie.";
  return {
    to: admins,
    subject: `${edited ? "Poprawione" : "Nowe"} ogłoszenie: ${l.title} (${l.city})`,
    html: layout(p(lead) + listingCard(l) + button(`${SITE}/moje/`, "Otwórz kolejkę")),
    text: `${lead}\n\n${l.title}\n${l.city} · ${l.nick}\n\n${l.description}\n\n${SITE}/moje/`,
  };
}

export function authorListingMail(l: Row, to: string): Mail {
  if (l.status === "approved") {
    return {
      to: [to],
      subject: `Opublikowane: ${l.title}`,
      html: layout(p("Cześć!", 16) + p("Twoje ogłoszenie jest już na tablicy. Wiadomości od chętnych będą przychodzić na ten adres, a na stronie nikt go nie zobaczy.") + listingCard(l) +
        p("Ogłoszenie zniknie samo po 60 dniach. Gdy znajdziesz to, czego szukasz, zamknij je w „Moich wpisach”.", 14, C.muted) + button(`${SITE}/ogloszenia/${l.id}`, "Zobacz ogłoszenie")),
      text: `Twoje ogłoszenie „${l.title}” jest już na tablicy: ${SITE}/ogloszenia/${l.id}`,
    };
  }
  const reason = String(l.rejection_reason ?? "").trim();
  return {
    to: [to],
    subject: `Ogłoszenie nieopublikowane: ${l.title}`,
    html: layout(p("Cześć!", 16) + p(`Tym razem nie możemy opublikować ogłoszenia <strong>„${esc(l.title)}”</strong>.`) + (reason ? quote("Powód: " + reason) : "") +
      p("Możesz je poprawić i wysłać ponownie. Jeśli masz pytania, napisz na office@cyrkarium.com.", 14) + button(`${SITE}/moje/`, "Popraw ogłoszenie")),
    text: `Nie możemy opublikować ogłoszenia „${l.title}”.${reason ? "\nPowód: " + reason : ""}\n\nPopraw: ${SITE}/moje/`,
  };
}

export function adminStudioMail(s: Row, edited: boolean, admins: string[]): Mail {
  const lead = edited ? "Autor poprawił studio, więc wróciło do kolejki." : "Nowe studio czeka na sprawdzenie.";
  const links = [s.website_url, s.instagram_url, s.facebook_url].filter(Boolean).join("\n");
  return {
    to: admins,
    subject: `${edited ? "Poprawione" : "Nowe"} studio: ${s.name} (${s.city})`,
    html: layout(p(lead) + quote(`${s.name}\n${s.city}${s.address ? ", " + s.address : ""}\n\n${s.description ?? ""}\n\n${links}`) + button(`${SITE}/moje/`, "Otwórz kolejkę")),
    text: `${lead}\n\n${s.name}, ${s.city}\n${links}\n\n${SITE}/moje/`,
  };
}

// --- kto dostaje maila (czysta funkcja) ---------------------------------
export type Kind = "message" | "admin_listing_new" | "admin_listing_edited" | "author_listing" | "admin_studio_new" | "admin_studio_edited";
export function decide(pl: Payload): Kind | null {
  if (pl.schema !== "public" || !pl.record) return null;
  const r = pl.record, o = pl.old_record;
  if (pl.table === "listing_messages") return pl.type === "INSERT" ? "message" : null;
  if (pl.table === "listings") {
    if (pl.type === "INSERT") return r.status === "pending" ? "admin_listing_new" : null;
    if (pl.type !== "UPDATE" || !o || o.status === r.status) return null;
    if (r.status === "pending") return "admin_listing_edited";
    if (r.status === "approved" || r.status === "rejected") return "author_listing";
    return null;
  }
  if (pl.table === "studios") {
    if (pl.type === "INSERT") return r.status === "pending" ? "admin_studio_new" : null;
    if (pl.type === "UPDATE" && o && o.status !== "pending" && r.status === "pending") return "admin_studio_edited";
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
  const r = pl.record!;
  if (kind === "message") {
    const { data: l } = await sb.from("listings").select("*").eq("id", r.listing_id).single();
    const to = l ? await emailOf(l.created_by) : null;
    if (l && to) mail = messageMail(l, r, to);
  } else if (kind === "admin_listing_new" || kind === "admin_listing_edited") {
    mail = adminListingMail(r, kind === "admin_listing_edited", await admins());
  } else if (kind === "author_listing") {
    const to = await emailOf(r.created_by);
    if (to) mail = authorListingMail(r, to);
  } else {
    mail = adminStudioMail(r, kind === "admin_studio_edited", await admins());
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
