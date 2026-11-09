-- =====================================================================
-- Aerial · zdjęcia w ogłoszeniach (do 4, bez osób)
--
-- Strona zmniejsza zdjęcie w przeglądarce (do 1200 px, WebP, bez danych
-- z aparatu, np. lokalizacji GPS) i wysyła je do publicznego pojemnika
-- „listing-photos”. W ogłoszeniu zapisujemy tylko ścieżki plików.
-- Zdjęcia przechodzą moderację razem z ogłoszeniem (edycja = ponowne sprawdzenie).
--
-- Zasady:
--   • każdy może oglądać zdjęcia (pojemnik publiczny, losowe nazwy plików)
--   • zalogowana osoba wgrywa pliki tylko do własnego folderu (<id konta>/…)
--   • usuwać może autor pliku albo admin
--   • limit 600 KB na plik, tylko obrazki, maks. 4 zdjęcia na ogłoszenie
--   • sprzątanie: funkcja listing_orphan_photos() podaje pliki, których nie używa
--     już żadne ogłoszenie (np. po automatycznym usunięciu starych ogłoszeń);
--     strona usuwa je sama, gdy admin otworzy kolejkę.
--
-- Uruchom w SQL Editorze PRZED wypchnięciem strony. Można uruchomić ponownie.
-- =====================================================================

-- 1. Kolumna ze zdjęciami
alter table public.listings add column if not exists photos text[] not null default '{}';
alter table public.listings drop constraint if exists listings_photos_ok;
alter table public.listings add constraint listings_photos_ok check (
  cardinality(photos) <= 4
  and array_to_string(photos, ',') ~ '^([0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)(,|$))*$'
);

-- 2. Pojemnik
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 614400, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3. Reguły dostępu
drop policy if exists "listing-photos: read"       on storage.objects;
drop policy if exists "listing-photos: insert own" on storage.objects;
drop policy if exists "listing-photos: delete own" on storage.objects;

create policy "listing-photos: read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'listing-photos');

create policy "listing-photos: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "listing-photos: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-photos' and ((storage.foldername(name))[1] = (select auth.uid()::text) or (select public.is_admin())));

-- 4. Pliki bez ogłoszenia (starsze niż dzień, żeby nie ruszać zdjęć z formularza w trakcie wypełniania)
create or replace function public.listing_orphan_photos()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name from storage.objects o
  where o.bucket_id = 'listing-photos'
    and o.created_at < now() - interval '1 day'
    and public.is_admin()
    and not exists (select 1 from public.listings l where o.name = any(l.photos))
  limit 200;
$$;
revoke all on function public.listing_orphan_photos() from public;
grant execute on function public.listing_orphan_photos() to authenticated;

-- kontrola
select id, public, file_size_limit from storage.buckets where id = 'listing-photos';
