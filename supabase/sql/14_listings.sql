-- =====================================================================
-- Aerial · Fundacja Cyrkarium · ogłoszenia
--
-- Ta sama baza co Aerial Events i studia. Uruchom w SQL Editorze
-- (New query → wklej całość → Run). Skrypt można uruchomić ponownie.
--
-- Zasady:
--   • ogłoszenia dodają zalogowani; każde trafia do moderacji ('pending')
--   • publicznie widać tylko zatwierdzone i niewygasłe (60 dni)
--   • na stronie nie ma e-maili ani telefonów: baza odrzuca je w tytule
--     i opisie, a autor jest podpisany tylko nickiem
--   • kontakt: formularz pod ogłoszeniem zapisuje wiadomość w
--     listing_messages (nikt z zewnątrz jej nie odczyta), a funkcja
--     aerial-notify przesyła ją mailem do autora z reply-to nadawcy.
--     Adres autora nie trafia do nadawcy, dopóki autor sam nie odpisze.
--   • autor może zamknąć ogłoszenie; każda inna poprawka wraca do moderacji
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Czy tekst zawiera e-mail albo numer telefonu?
--    Telefon = ciąg cyfr, spacji i myślników z co najmniej 9 cyframi
--    (daty typu 12.03–14.03 i ceny typu 1 200 zł przechodzą).
--    Ta sama reguła jest w app.js (contactInText).
-- ---------------------------------------------------------------------
create or replace function public.has_contact(t text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(t, '') ~* '[^\s@]+@[^\s@]+\.[a-z]{2,}'
      or exists (
        select 1 from regexp_matches(coalesce(t, ''), '\+?\d[\d -]{7,}\d', 'g') as m(x)
        where char_length(regexp_replace(m.x[1], '\D', '', 'g')) >= 9
      );
$$;


-- ---------------------------------------------------------------------
-- 2. Ogłoszenia
-- ---------------------------------------------------------------------
create table if not exists public.listings (
  id               uuid primary key default gen_random_uuid(),
  created_by       uuid not null default auth.uid()
                   references auth.users (id) on delete cascade,

  status           text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected', 'closed')),
  rejection_reason text check (char_length(rejection_reason) <= 500),
  reviewed_at      timestamptz,
  reviewed_by      uuid references auth.users (id) on delete set null,

  category         text not null check (category in ('partner', 'gear', 'space', 'job')),
  title            text not null check (char_length(title) between 5 and 120),
  description      text not null check (char_length(description) between 10 and 1500),
  city             text not null check (char_length(city) between 2 and 60),
  nick             text not null check (char_length(nick) between 2 and 40),
  price            text check (char_length(price) <= 40),

  expires_at       timestamptz not null default now() + interval '60 days',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint listings_no_contact check (
    not public.has_contact(title) and not public.has_contact(description)
    and not public.has_contact(nick) and not public.has_contact(price)
  )
);

create index if not exists listings_status_idx     on public.listings (status, expires_at);
create index if not exists listings_created_by_idx on public.listings (created_by);

alter table public.listings enable row level security;


-- strażnik: autor nie zatwierdzi sam siebie i nie przedłuży sobie terminu;
-- zamknięcie ogłoszenia jest jedyną zmianą bez ponownej moderacji
create or replace function public.listings_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_adm boolean;
begin
  new.updated_at := now();

  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  is_adm := public.is_admin();

  if tg_op = 'INSERT' then
    new.created_at := now();
    if not is_adm then
      new.created_by       := auth.uid();
      new.status           := 'pending';
      new.rejection_reason := null;
      new.reviewed_at      := null;
      new.reviewed_by      := null;
      new.expires_at       := now() + interval '60 days';

      if (select count(*) from public.listings l
          where l.created_by = auth.uid()
            and (l.status = 'pending' or (l.status = 'approved' and l.expires_at > now()))) >= 5 then
        raise exception using
          message = 'Masz już 5 aktywnych ogłoszeń. Zamknij któreś, żeby dodać nowe. / You already have 5 active listings. Close one to add another.',
          errcode = 'P0001';
      end if;
    end if;

  else -- UPDATE
    new.id         := old.id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;

    if not is_adm then
      if new.status = 'closed' then
        -- zamknięcie: zostawiamy resztę bez zmian
        new := old;
        new.status := 'closed';
        new.updated_at := now();
      else
        new.status           := 'pending';
        new.rejection_reason := null;
        new.reviewed_at      := null;
        new.reviewed_by      := null;
        new.expires_at       := old.expires_at;
      end if;
    elsif new.status is distinct from old.status then
      new.reviewed_at := now();
      new.reviewed_by := auth.uid();
      if new.status <> 'rejected' then
        new.rejection_reason := null;
      end if;
      -- zatwierdzenie liczy 60 dni od momentu publikacji
      if new.status = 'approved' and old.status = 'pending' then
        new.expires_at := now() + interval '60 days';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists listings_guard on public.listings;
create trigger listings_guard
  before insert or update on public.listings
  for each row execute function public.listings_guard();


drop policy if exists "listings: read"       on public.listings;
drop policy if exists "listings: insert own" on public.listings;
drop policy if exists "listings: update"     on public.listings;
drop policy if exists "listings: delete"     on public.listings;

create policy "listings: read" on public.listings
  for select to anon, authenticated
  using (
    (status = 'approved' and expires_at > now())
    or created_by = (select auth.uid())
    or (select public.is_admin())
  );

create policy "listings: insert own" on public.listings
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "listings: update" on public.listings
  for update to authenticated
  using      (created_by = (select auth.uid()) or (select public.is_admin()))
  with check (created_by = (select auth.uid()) or (select public.is_admin()));

create policy "listings: delete" on public.listings
  for delete to authenticated
  using (created_by = (select auth.uid()) or (select public.is_admin()));

grant select                 on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;
grant select, insert, update, delete on public.listings to service_role;


-- ---------------------------------------------------------------------
-- 3. Wiadomości do autorów
--    Strona może TYLKO dodawać. Czyta je wyłącznie funkcja aerial-notify
--    (service_role). Autor dostaje treść mailem; na stronie widzi tylko liczbę.
-- ---------------------------------------------------------------------
create table if not exists public.listing_messages (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings (id) on delete cascade,
  sender_name  text not null check (char_length(sender_name) between 1 and 60),
  sender_email text not null check (char_length(sender_email) between 5 and 200
                                     and sender_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  message      text not null check (char_length(message) between 5 and 2000),
  consent      boolean not null check (consent),
  lang         text check (lang in ('pl', 'en')),
  created_at   timestamptz not null default now()
);

create index if not exists listing_messages_listing_idx on public.listing_messages (listing_id);
create index if not exists listing_messages_sender_idx  on public.listing_messages (sender_email, created_at);

alter table public.listing_messages enable row level security;

drop policy if exists "listing_messages: insert" on public.listing_messages;
create policy "listing_messages: insert" on public.listing_messages
  for insert to anon, authenticated
  with check (true);

grant insert on public.listing_messages to anon, authenticated;
grant select, insert, update, delete on public.listing_messages to service_role;

-- strażnik: tylko do aktywnych ogłoszeń, limit antyspamowy
create or replace function public.listing_messages_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  new.sender_email := lower(trim(new.sender_email));

  if not exists (select 1 from public.listings l
                 where l.id = new.listing_id and l.status = 'approved' and l.expires_at > now()) then
    raise exception using message = 'listing_closed', errcode = 'P0001';
  end if;

  if (select count(*) from public.listing_messages m
      where m.sender_email = new.sender_email and m.created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.listing_messages m
      where m.listing_id = new.listing_id and m.sender_email = new.sender_email) >= 3
     or (select count(*) from public.listing_messages m
      where m.created_at > now() - interval '1 hour') >= 60 then
    raise exception using message = 'too_many', errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists listing_messages_guard on public.listing_messages;
create trigger listing_messages_guard
  before insert on public.listing_messages
  for each row execute function public.listing_messages_guard();


-- ---------------------------------------------------------------------
-- 4. Liczba wiadomości przy moich ogłoszeniach (bez treści i adresów)
-- ---------------------------------------------------------------------
create or replace function public.my_listing_stats()
returns table (listing_id uuid, messages integer)
language sql
stable
security definer
set search_path = ''
as $$
  select m.listing_id, count(*)::integer
  from public.listing_messages m
  join public.listings l on l.id = m.listing_id
  where l.created_by = auth.uid()
  group by m.listing_id;
$$;

revoke all on function public.my_listing_stats() from public;
grant execute on function public.my_listing_stats() to authenticated;


-- ---------------------------------------------------------------------
-- 5. Sprzątanie (zgodnie z polityką prywatności)
--    Uruchamiaj co jakiś czas albo ustaw w Database → Cron (raz dziennie):
--
-- delete from public.listing_messages where created_at < now() - interval '90 days';
-- delete from public.listings
--   where (status in ('closed', 'rejected') and updated_at < now() - interval '90 days')
--      or expires_at < now() - interval '90 days';
-- ---------------------------------------------------------------------


-- kontrola: has_contact powinno dać true, false, false, true
select public.has_contact('Dzwoń 601 234 567')        as tel,
       public.has_contact('Warsztaty 12.03 - 14.03.2026') as daty,
       public.has_contact('Cena 1 200 zł')             as cena,
       public.has_contact('pisz: ola@example.com')     as mail;
