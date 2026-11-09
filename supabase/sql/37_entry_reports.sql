-- =====================================================================
-- Aerial · „Zgłoś nieaktualne dane” przy studiach i producentach
--
-- Każdy (także bez logowania) może zgłosić, że dane studia lub producenta są
-- nieaktualne: zaznacza, co się zmieniło, i opcjonalnie dopisuje szczegóły
-- oraz e-mail do odpowiedzi. Zgłoszenia widzi tylko admin (zakładka
-- „Zgłoszenia” w Moich wpisach), oznacza je jako załatwione albo usuwa.
--
-- Ochrona: limit zgłoszeń na godzinę, wpis musi być zatwierdzony, sprzątanie
-- po 90 dniach od załatwienia (albo po 180 dniach w ogóle).
--
-- Uruchom raz w SQL Editorze PRZED wypchnięciem strony. Można uruchomić ponownie.
-- =====================================================================

create table if not exists public.entry_reports (
  id          uuid primary key default gen_random_uuid(),
  studio_id   uuid references public.studios (id) on delete cascade,
  maker_id    uuid references public.makers (id) on delete cascade,
  reasons     text[] not null default '{}',
  message     text check (char_length(message) <= 1000),
  email       text check (email is null or (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  lang        text check (lang in ('pl', 'en')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  constraint entry_reports_one_target check ((studio_id is null) <> (maker_id is null)),
  constraint entry_reports_reasons_ok check (
    reasons <@ array['closed', 'address', 'links', 'classes', 'other']::text[]
    and (cardinality(reasons) > 0 or char_length(coalesce(message, '')) >= 5)
  )
);
create index if not exists entry_reports_open_idx on public.entry_reports (resolved_at, created_at);

alter table public.entry_reports enable row level security;

drop policy if exists "entry_reports: insert" on public.entry_reports;
create policy "entry_reports: insert" on public.entry_reports
  for insert to anon, authenticated with check (true);

drop policy if exists "entry_reports: admin" on public.entry_reports;
create policy "entry_reports: admin" on public.entry_reports
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant insert on public.entry_reports to anon, authenticated;
grant select, update, delete on public.entry_reports to authenticated;

-- strażnik: zatwierdzony wpis, limity, czyste pola
create or replace function public.entry_reports_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if not public.is_admin() then raise exception using message = 'forbidden', errcode = 'P0001'; end if;
    return new;
  end if;
  new.created_at := now();
  new.resolved_at := null;
  new.email := nullif(lower(trim(new.email)), '');
  if new.studio_id is not null and not exists (select 1 from public.studios s where s.id = new.studio_id and s.status = 'approved')
     or new.maker_id is not null and not exists (select 1 from public.makers m where m.id = new.maker_id and m.status = 'approved') then
    raise exception using message = 'missing', errcode = 'P0001';
  end if;
  if (select count(*) from public.entry_reports r where r.created_at > now() - interval '1 hour') >= 30
     or (new.email is not null and (select count(*) from public.entry_reports r
         where r.email = new.email and r.created_at > now() - interval '1 hour') >= 5) then
    raise exception using message = 'too_many', errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists entry_reports_guard on public.entry_reports;
create trigger entry_reports_guard
  before insert or update on public.entry_reports
  for each row execute function public.entry_reports_guard();

-- sprzątanie: dopisane do codziennego zadania aerial-cleanup (15_cleanup_cron.sql)
select cron.schedule(
  'aerial-cleanup',
  '15 3 * * *',
  $job$
    delete from public.listing_messages
      where created_at < now() - interval '90 days';
    delete from public.listings
      where (status in ('closed', 'rejected') and updated_at < now() - interval '90 days')
         or expires_at < now() - interval '90 days';
    delete from public.entry_reports
      where (resolved_at is not null and resolved_at < now() - interval '90 days')
         or created_at < now() - interval '180 days';
  $job$
);

-- kontrola
select jobname, schedule, active from cron.job where jobname = 'aerial-cleanup';
