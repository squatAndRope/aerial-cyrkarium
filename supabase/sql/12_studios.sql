-- =====================================================================
-- Aerial · Fundacja Cyrkarium · studia na mapie
--
-- Ta sama baza Supabase co Aerial Events (te same konta, ta sama lista
-- adminów i funkcja is_admin()). Numeracja ciągnie się dalej po
-- skryptach z repozytorium aerial-events (01–11).
--
-- Uruchom w Supabase: SQL Editor → New query → wklej całość → Run.
-- Skrypt można bezpiecznie uruchomić ponownie.
--
-- Zasady:
--   • każdy (także niezalogowany) widzi zatwierdzone studia
--   • zalogowana osoba dodaje studio; trafia ono do kolejki ('pending')
--   • autor widzi i poprawia swoje wpisy; każda poprawka wraca do kolejki
--   • tylko admin zatwierdza, odrzuca i oznacza profil jako zweryfikowany
--   • w tabeli NIE MA e-maili ani telefonów; kontakt to linki do strony
--     i profili studia
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------
create table if not exists public.studios (
  id               uuid primary key default gen_random_uuid(),
  created_by       uuid not null default auth.uid()
                   references auth.users (id) on delete cascade,

  -- moderacja
  status           text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text check (char_length(rejection_reason) <= 500),
  reviewed_at      timestamptz,
  reviewed_by      uuid references auth.users (id) on delete set null,
  verified         boolean not null default false,  -- profil potwierdzony przez studio

  -- co i gdzie
  name             text not null check (char_length(name) between 2 and 100),
  city             text not null check (char_length(city) between 2 and 60),
  address          text check (char_length(address) <= 160),   -- ulica, publiczny adres sali
  lat              double precision,
  lng              double precision,

  disciplines      text[] not null default '{}',
  levels           text[] not null default '{}',
  kids             boolean not null default false,
  description      text check (char_length(description) <= 1200),

  -- kontakt tylko przez linki
  website_url      text check (website_url   ~* '^https?://' and char_length(website_url)   <= 300),
  instagram_url    text check (instagram_url ~* '^https?://' and char_length(instagram_url) <= 300),
  facebook_url     text check (facebook_url  ~* '^https?://' and char_length(facebook_url)  <= 300),

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint studios_coords_ok check (
    (lat is null and lng is null)
    or (lat between 48.5 and 55.5 and lng between 13.5 and 24.5)
  ),
  constraint studios_disciplines_ok check (
    disciplines <@ array['rope', 'silks', 'hoop', 'trapeze', 'straps', 'pole', 'hammock', 'hair', 'other']::text[]
    and cardinality(disciplines) <= 10
  ),
  constraint studios_levels_ok check (
    levels <@ array['beginner', 'intermediate', 'advanced']::text[]
  )
);

create index if not exists studios_status_idx     on public.studios (status);
create index if not exists studios_created_by_idx on public.studios (created_by);

alter table public.studios enable row level security;


-- ---------------------------------------------------------------------
-- 2. Strażnik zapisów: autor nie zatwierdzi sam siebie, nie oznaczy
--    profilu jako zweryfikowanego i nie przepisze autora. Zapisy
--    z SQL Editora (service_role / postgres) przechodzą bez zmian.
-- ---------------------------------------------------------------------
create or replace function public.studios_guard()
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
      new.verified         := false;
      new.rejection_reason := null;
      new.reviewed_at      := null;
      new.reviewed_by      := null;

      -- prosty limit antyspamowy
      if (select count(*) from public.studios s
          where s.created_by = auth.uid() and s.status = 'pending') >= 5 then
        raise exception using
          message = 'Masz już 5 studiów czekających na akceptację. / You already have 5 studios waiting for review.',
          errcode = 'P0001';
      end if;
    end if;

  else -- UPDATE
    new.id         := old.id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;

    if not is_adm then
      new.status           := 'pending';
      new.verified         := old.verified;
      new.rejection_reason := null;
      new.reviewed_at      := null;
      new.reviewed_by      := null;
    elsif new.status is distinct from old.status then
      new.reviewed_at := now();
      new.reviewed_by := auth.uid();
      if new.status <> 'rejected' then
        new.rejection_reason := null;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists studios_guard on public.studios;
create trigger studios_guard
  before insert or update on public.studios
  for each row execute function public.studios_guard();


-- ---------------------------------------------------------------------
-- 3. Reguły dostępu (RLS)
-- ---------------------------------------------------------------------
drop policy if exists "studios: read"       on public.studios;
drop policy if exists "studios: insert own" on public.studios;
drop policy if exists "studios: update"     on public.studios;
drop policy if exists "studios: delete"     on public.studios;

create policy "studios: read" on public.studios
  for select to anon, authenticated
  using (
    status = 'approved'
    or created_by = (select auth.uid())
    or (select public.is_admin())
  );

create policy "studios: insert own" on public.studios
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "studios: update" on public.studios
  for update to authenticated
  using      (created_by = (select auth.uid()) or (select public.is_admin()))
  with check (created_by = (select auth.uid()) or (select public.is_admin()));

create policy "studios: delete" on public.studios
  for delete to authenticated
  using (created_by = (select auth.uid()) or (select public.is_admin()));


-- ---------------------------------------------------------------------
-- 4. Uprawnienia
-- ---------------------------------------------------------------------
grant select                 on public.studios to anon, authenticated;
grant insert, update, delete on public.studios to authenticated;
grant select, insert, update, delete on public.studios to service_role;


-- kontrola: powinno zwrócić 0 wierszy i nie zgłosić błędu
select count(*) as studia from public.studios;
