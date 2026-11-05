-- =====================================================================
-- Aerial · logo przy studiach i producentach
--
-- Jedno logo na wpis. Strona zmniejsza obrazek w przeglądarce (do 400 px,
-- WebP lub PNG) i wysyła go do publicznego pojemnika „logos” w Supabase
-- Storage. W tabelach zapisujemy tylko ścieżkę pliku.
--
-- Zasady:
--   • każdy może oglądać loga (pojemnik publiczny)
--   • zalogowana osoba wgrywa pliki tylko do własnego folderu (<id konta>/…)
--   • usuwać może autor pliku albo admin
--   • limit 500 KB na plik, tylko obrazki
--
-- Uruchom w SQL Editorze PRZED wypchnięciem nowej wersji strony.
-- Skrypt można uruchomić ponownie.
-- =====================================================================

-- 1. Kolumny ze ścieżką logo
alter table public.studios add column if not exists logo_path text;
alter table public.makers  add column if not exists logo_path text;

alter table public.studios drop constraint if exists studios_logo_ok;
alter table public.studios add constraint studios_logo_ok check (logo_path is null or logo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|png|jpg)$');
alter table public.makers drop constraint if exists makers_logo_ok;
alter table public.makers add constraint makers_logo_ok check (logo_path is null or logo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|png|jpg)$');

-- 2. Pojemnik na pliki
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 512000, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3. Reguły dostępu do plików
drop policy if exists "logos: read"        on storage.objects;
drop policy if exists "logos: insert own"  on storage.objects;
drop policy if exists "logos: update own"  on storage.objects;
drop policy if exists "logos: delete own"  on storage.objects;

create policy "logos: read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'logos');

create policy "logos: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "logos: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'logos' and ((storage.foldername(name))[1] = (select auth.uid()::text) or (select public.is_admin())));

create policy "logos: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'logos' and ((storage.foldername(name))[1] = (select auth.uid()::text) or (select public.is_admin())));

-- kontrola: powinno pokazać pojemnik logos (public = true)
select id, public, file_size_limit from storage.buckets where id = 'logos';
