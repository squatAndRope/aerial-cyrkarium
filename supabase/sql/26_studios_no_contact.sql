-- =====================================================================
-- Aerial · e-mail kontaktowy studia (tylko za zgodą) i blokada kontaktów
--
-- Zasada:
--  • nazwa, adres i opis studia NIE mogą zawierać e-maila ani telefonu,
--  • studio MOŻE podać e-mail w osobnym polu, z zaznaczoną zgodą na publikację.
--    Taki e-mail nie jest w tabeli studiów: leży w osobnej tabeli, której nikt
--    nie czyta wprost. Odwiedzający widzi go dopiero po kliknięciu „Pokaż e-mail”
--    (funkcja studio_email), i tylko przy zatwierdzonym studiu. Autor wpisu
--    i admin widzą go w formularzu i w kolejce.
--
-- Dodatkowo: czyści e-mail wpisany w pole adresu (Pole by Daria Tarnów; bez zgody,
-- więc go nie przenosimy) i usuwa dopiski śledzące z linków do Instagrama/Facebooka.
--
-- Uruchom raz w SQL Editorze. Można uruchomić ponownie.
-- =====================================================================

-- 1. porządki w istniejących wpisach
update public.studios set address = null where public.has_contact(address);
update public.studios
   set instagram_url = regexp_replace(instagram_url, '\?.*$', '')
 where instagram_url ~ '\?';
update public.studios
   set facebook_url = regexp_replace(facebook_url, '\?.*$', '')
 where facebook_url ~ '\?' and facebook_url !~* 'profile\.php';

-- 2. blokada e-maili i telefonów w nazwie, adresie i opisie
alter table public.studios drop constraint if exists studios_no_contact;
alter table public.studios add constraint studios_no_contact check (
  not public.has_contact(name) and not public.has_contact(address) and not public.has_contact(description)
);

-- 3. e-mail kontaktowy za zgodą
create table if not exists public.studio_emails (
  studio_id  uuid primary key references public.studios(id) on delete cascade,
  email      text not null check (email ~* '^[^\s@]+@[^\s@]+\.[a-z]{2,}$' and char_length(email) <= 120),
  consent_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.studio_emails enable row level security;

-- czytać, dodawać, zmieniać i usuwać może tylko autor studia albo admin
drop policy if exists "studio_emails: owner or admin" on public.studio_emails;
create policy "studio_emails: owner or admin" on public.studio_emails
  for all to authenticated
  using (public.is_admin() or exists (
    select 1 from public.studios s where s.id = studio_id and s.created_by = auth.uid()))
  with check (public.is_admin() or exists (
    select 1 from public.studios s where s.id = studio_id and s.created_by = auth.uid()));

-- „Pokaż e-mail”: zwraca adres tylko dla zatwierdzonego studia
create or replace function public.studio_email(sid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select e.email from public.studio_emails e
  join public.studios s on s.id = e.studio_id
  where e.studio_id = sid and s.status = 'approved';
$$;

-- które zatwierdzone studia mają e-mail (żeby wiedzieć, gdzie pokazać przycisk); same id, bez adresów
create or replace function public.studio_email_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.studio_id from public.studio_emails e
  join public.studios s on s.id = e.studio_id
  where s.status = 'approved';
$$;

revoke all on function public.studio_email(uuid) from public;
revoke all on function public.studio_email_ids() from public;
grant execute on function public.studio_email(uuid) to anon, authenticated;
grant execute on function public.studio_email_ids() to anon, authenticated;

-- kontrola
select name, city, address, instagram_url, facebook_url from public.studios
 where name in ('Pole by Daria Tarnów', 'Pole Dance House', 'Fundacja AstraFly Academy');
