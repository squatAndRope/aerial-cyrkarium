-- =====================================================================
-- Cyrkomnienia: wspomnienia uczestników z warsztatów Fundacji Cyrkarium (cyrkarium.com)
--
-- • każdy (bez logowania) może wysłać wspomnienie: anonimowo albo z imieniem i/lub nickiem z IG,
--   treść, opcjonalnie nazwa warsztatów i jedno zdjęcie
-- • nowe wpisy czekają na akceptację (status pending); na stronie widać tylko zatwierdzone
-- • zatwierdza, odrzuca i usuwa admin w panelu aerial.cyrkarium.com/admin (zakładka Cyrkomnienia)
-- • wycofanie zgody = admin usuwa wpis razem ze zdjęciem
-- • zdjęcia: publiczny pojemnik „memories”, losowe nazwy, maks. 800 KB, tylko obrazki;
--   strona zmniejsza zdjęcie w przeglądarce i usuwa dane z aparatu (np. GPS)
--
-- Uruchom w SQL Editorze PRZED wypchnięciem strony. Można uruchomić ponownie.
-- =====================================================================

-- 1. Tabela
create table if not exists public.memories (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  anonymous       boolean not null default false,
  author_name     text check (char_length(author_name) between 1 and 60),
  instagram       text check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  workshop        text check (char_length(workshop) <= 120),
  content         text not null check (char_length(content) between 10 and 1000),
  photo_path      text check (photo_path ~ '^u/[0-9a-f-]{36}\.(webp|jpg)$'),
  consent_publish boolean not null check (consent_publish),
  consent_photo   boolean not null default false,
  lang            text check (lang in ('pl', 'en', 'de', 'uk')),
  published_at    timestamptz,
  reviewed_by     uuid,
  constraint memories_author_ok check (anonymous or author_name is not null or instagram is not null),
  constraint memories_photo_ok check (photo_path is null or consent_photo)
);
create index if not exists memories_status_idx on public.memories (status, published_at desc);

-- 2. Strażnik: odwiedzający może tylko dodać wpis do sprawdzenia; anonimowy wpis nie zapisuje imienia ani nicku
create or replace function public.memories_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    if new.anonymous then new.author_name := null; new.instagram := null; end if;
    if coalesce(auth.role(), '') in ('anon', 'authenticated') and not public.is_admin() then
      new.status := 'pending'; new.published_at := null; new.reviewed_by := null;
      if (select count(*) from public.memories m where m.status = 'pending') >= 200 then
        raise exception using message = 'Za dużo wpisów czeka na sprawdzenie. Spróbuj później.', errcode = 'P0001';
      end if;
    end if;
  else
    new.id := old.id; new.created_at := old.created_at;
    if new.status is distinct from old.status then
      new.reviewed_by := auth.uid();
      new.published_at := case when new.status = 'approved' then coalesce(old.published_at, now()) else null end;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists memories_guard on public.memories;
create trigger memories_guard before insert or update on public.memories
  for each row execute function public.memories_guard();

-- 3. Kto co może
alter table public.memories enable row level security;
drop policy if exists "memories: read approved" on public.memories;
drop policy if exists "memories: admin read"    on public.memories;
drop policy if exists "memories: insert"        on public.memories;
drop policy if exists "memories: admin update"  on public.memories;
drop policy if exists "memories: admin delete"  on public.memories;
create policy "memories: read approved" on public.memories for select to anon, authenticated using (status = 'approved');
create policy "memories: admin read"    on public.memories for select to authenticated using ((select public.is_admin()));
create policy "memories: insert"        on public.memories for insert to anon, authenticated with check (status = 'pending' or (select public.is_admin()));
create policy "memories: admin update"  on public.memories for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "memories: admin delete"  on public.memories for delete to authenticated using ((select public.is_admin()));
grant select, insert on public.memories to anon, authenticated;
grant update, delete on public.memories to authenticated;

-- 4. Zdjęcia
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memories', 'memories', true, 819200, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "memories: photo read"   on storage.objects;
drop policy if exists "memories: photo insert" on storage.objects;
drop policy if exists "memories: photo delete" on storage.objects;
create policy "memories: photo read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'memories');
create policy "memories: photo insert" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'memories' and name ~ '^u/[0-9a-f-]{36}\.(webp|jpg)$');
create policy "memories: photo delete" on storage.objects for delete to authenticated
  using (bucket_id = 'memories' and (select public.is_admin()));

-- 5. Zdjęcia bez wpisu (np. ktoś wgrał i nie wysłał formularza) – panel admina usuwa je sam
create or replace function public.memory_orphan_photos()
returns setof text
language sql stable security definer set search_path = ''
as $$
  select o.name from storage.objects o
  where o.bucket_id = 'memories' and o.created_at < now() - interval '1 day' and public.is_admin()
    and not exists (select 1 from public.memories m where m.photo_path = o.name)
  limit 200;
$$;
revoke all on function public.memory_orphan_photos() from public;
grant execute on function public.memory_orphan_photos() to authenticated;

-- kontrola
select count(*) as wspomnienia from public.memories;
