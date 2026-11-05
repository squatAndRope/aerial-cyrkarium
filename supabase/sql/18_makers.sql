-- =====================================================================
-- Aerial · producenci sprzętu i strojów aerial w Polsce
--
-- Ta sama baza i zasady co studia (12_studios.sql):
--   • każdy widzi zatwierdzonych producentów
--   • zalogowana osoba dodaje wpis; trafia do kolejki ('pending')
--   • autor poprawia swoje wpisy; każda poprawka wraca do kolejki
--   • tylko admin zatwierdza, odrzuca i oznacza profil jako potwierdzony
--   • bez e-maili i telefonów: kontakt to linki do strony, sklepu i profili
-- Tylko producenci (sami szyją / robią sprzęt). Dystrybucję dodamy osobno.
--
-- Uruchom w SQL Editorze PRZED wypchnięciem nowej wersji strony.
-- Skrypt można uruchomić ponownie.
-- =====================================================================

create table if not exists public.makers (
  id               uuid primary key default gen_random_uuid(),
  created_by       uuid not null default auth.uid()
                   references auth.users (id) on delete cascade,

  status           text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text check (char_length(rejection_reason) <= 500),
  reviewed_at      timestamptz,
  reviewed_by      uuid references auth.users (id) on delete set null,
  verified         boolean not null default false,

  name             text not null check (char_length(name) between 2 and 100),
  city             text not null check (char_length(city) between 2 and 60),
  products         text[] not null default '{}',
  custom_orders    boolean not null default false,   -- robi na zamówienie / na wymiar
  ships_abroad     boolean not null default false,   -- wysyła za granicę
  description      text check (char_length(description) <= 1200),

  website_url      text check (website_url   ~* '^https?://' and char_length(website_url)   <= 300),
  shop_url         text check (shop_url      ~* '^https?://' and char_length(shop_url)      <= 300),
  instagram_url    text check (instagram_url ~* '^https?://' and char_length(instagram_url) <= 300),
  facebook_url     text check (facebook_url  ~* '^https?://' and char_length(facebook_url)  <= 300),

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint makers_products_ok check (
    products <@ array['hoops', 'silks', 'frames', 'rigging', 'costumes', 'mats', 'accessories', 'other']::text[]
    and cardinality(products) between 1 and 8
  ),
  constraint makers_no_contact check (not public.has_contact(description))
);

create index if not exists makers_status_idx     on public.makers (status);
create index if not exists makers_created_by_idx on public.makers (created_by);

alter table public.makers enable row level security;


-- strażnik zapisów (jak studios_guard)
create or replace function public.makers_guard()
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

      if (select count(*) from public.makers m
          where m.created_by = auth.uid() and m.status = 'pending') >= 5 then
        raise exception using
          message = 'Masz już 5 wpisów czekających na akceptację. / You already have 5 entries waiting for review.',
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

drop trigger if exists makers_guard on public.makers;
create trigger makers_guard
  before insert or update on public.makers
  for each row execute function public.makers_guard();


drop policy if exists "makers: read"       on public.makers;
drop policy if exists "makers: insert own" on public.makers;
drop policy if exists "makers: update"     on public.makers;
drop policy if exists "makers: delete"     on public.makers;

create policy "makers: read" on public.makers
  for select to anon, authenticated
  using (
    status = 'approved'
    or created_by = (select auth.uid())
    or (select public.is_admin())
  );

create policy "makers: insert own" on public.makers
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "makers: update" on public.makers
  for update to authenticated
  using      (created_by = (select auth.uid()) or (select public.is_admin()))
  with check (created_by = (select auth.uid()) or (select public.is_admin()));

create policy "makers: delete" on public.makers
  for delete to authenticated
  using (created_by = (select auth.uid()) or (select public.is_admin()));

grant select                 on public.makers to anon, authenticated;
grant insert, update, delete on public.makers to authenticated;
grant select, insert, update, delete on public.makers to service_role;

-- kontrola: powinno zwrócić 0 i nie zgłosić błędu
select count(*) as producenci from public.makers;
