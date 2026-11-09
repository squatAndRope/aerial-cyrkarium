-- =====================================================================
-- Aerial · kalendarz ze studiami + przejmowanie profilu przez właściciela
--
-- 1. events.studio_id: wydarzenie może wskazywać studio z mapy. Profil studia
--    pokazuje „Wydarzenia w tym studiu”, karta wydarzenia ma link do studia.
--    Uzupełniamy istniejące wydarzenia (po nazwie miejsca i z Pretix).
-- 2. claim_studio(id): osoba zalogowana DOKŁADNIE tym adresem, który studio podało
--    jako e-mail kontaktowy, przejmuje edycję profilu (bez SQL po stronie admina).
-- 3. Duplikat AcroPark: zostaje wpis od właściciela (z logo i opisem), import z mapy
--    Taniec w Powietrzu jest usuwany.
--
-- Uruchom raz w SQL Editorze PRZED wypchnięciem strony. Można uruchomić ponownie.
-- =====================================================================

-- 1. wydarzenie → studio
alter table public.events add column if not exists studio_id uuid references public.studios(id) on delete set null;
create index if not exists events_studio_idx on public.events (studio_id);

update public.events set studio_id = '62aef9d6-ea96-4cdc-bcdd-4fd34b3e3dd1'                 -- Aerial Moon Studio
 where id in ('ff59d66f-a232-4229-97a2-e39dbf7b8de8','23313ea3-7461-4fa2-b292-5379d3d4d3d2','d5a08498-554f-4d98-96db-18a9b9db5330','b1e89460-26b1-4faf-a77e-0e7d48ff23b4','d750e2fe-4707-4d6f-8c81-016940e66774');
update public.events set studio_id = '89782600-6d63-4760-a9b0-252b4fcc67e6'                 -- Euforia Pole Dance
 where id in ('67c0ad58-a0ee-48e6-be29-0e71cc779b20','41369449-cf10-40a3-892e-f243c0ced053');
update public.events set studio_id = '99554ddb-05be-4fc6-a4bf-880e569eab9c', venue = 'GoFly Studio, ul. Starorudzka 10b'
 where id = 'f3016e3a-d320-4bcc-ba35-ef4baa59ecba';                                           -- NYAM
update public.events set studio_id = '340e1960-5a44-4aab-8bab-e53935aef319'                 -- Akademia Akrobatyki Powietrznej
 where id = '2abafc61-683b-4320-94fc-5889eee5f895';
update public.events set studio_id = '340e1960-5a44-4aab-8bab-e53935aef319', venue = 'Akademia Akrobatyki Powietrznej, ul. Przedwiośnie 5A'
 where id = '48232c83-3e4c-4151-a625-55f898246ddf';                                           -- Alberto Diaz
update public.events set studio_id = 'abbae687-08f4-4de2-b695-833eeda24e3f', venue = 'AkroSPOT, ul. Węglowa 1'
 where id = '5b9c831c-8e27-4dd3-b885-d41e20c72370';                                           -- Nicolas Stocco
update public.events set studio_id = '08a00a86-cc9e-42a3-9a07-442b0f4c45be', venue = 'AKROline Studio (KolekTYw), ul. Malarzy 86B'
 where id = 'c8054d93-3dc0-4305-9da8-d5f08eb96bc1';                                           -- Tzina Trikka
update public.events set studio_id = 'fd84e4ad-3053-4e33-80ea-f052e4abe733', venue = 'Aerial Dance Studio, ul. Olbrachta 48/56'
 where id = '957a2f30-0c5a-44ba-b4a0-c26b9eb12995';                                           -- Dana Auguštin

-- 3. duplikat AcroPark (przed przypięciem wydarzenia)
delete from public.studios where id = 'f82d7fed-7f8b-47a3-a921-d70d97c8e33a';
update public.studios set activities = array['acro']::text[] where id = '2272b0c0-9d24-40dd-a689-da30c2059446' and cardinality(activities) = 0;
update public.events set studio_id = '2272b0c0-9d24-40dd-a689-da30c2059446'                 -- AcroPark Balicka
 where id = '77ebb4f2-bad4-4bfb-b327-72802e4bd260';

-- 2. przejmowanie profilu
-- strażnik studiów przepuszcza zmianę wykonaną przez claim_studio (flaga aerial.claim)
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

  -- przejęcie profilu przez właściciela (funkcja claim_studio sprawdziła już e-mail)
  if current_setting('aerial.claim', true) = 'on' then
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

create or replace function public.claim_studio(sid uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me text;
  contact text;
  owner uuid;
begin
  if auth.uid() is null then return 'login'; end if;
  select lower(email) into me from auth.users where id = auth.uid();
  select lower(e.email), s.created_by into contact, owner
    from public.studios s left join public.studio_emails e on e.studio_id = s.id
   where s.id = sid and s.status = 'approved';
  if not found then return 'missing'; end if;
  if owner = auth.uid() then return 'already'; end if;
  if contact is null then return 'no_email'; end if;
  if me is distinct from contact then return 'mismatch'; end if;
  perform set_config('aerial.claim', 'on', true);
  update public.studios
     set created_by = auth.uid(), submitted_by_owner = true, verified = true
   where id = sid;
  perform set_config('aerial.claim', 'off', true);
  return 'ok';
end;
$$;
revoke all on function public.claim_studio(uuid) from public;
grant execute on function public.claim_studio(uuid) to authenticated;

-- kontrola
select s.name, count(e.id) as wydarzenia
  from public.studios s join public.events e on e.studio_id = s.id
 group by s.name order by s.name;
