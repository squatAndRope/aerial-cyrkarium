-- =====================================================================
-- Aerial · aerial joga jako osobna dyscyplina + „Inne zajęcia w studiu”
--
--  • nowa dyscyplina aerial_yoga (do tej pory aerial joga była schowana w „Hamak”),
--  • „other” zostaje, ale na stronie nazywa się teraz „Inne przyrządy”,
--  • nowa kolumna activities: stretching, joga, pilates, taniec, akrobatyka, fitness,
--  • uzupełnienie istniejących studiów na podstawie ich opisów i nazw
--    (przejrzane ręcznie; studia mogą to poprawić w edycji),
--  • poprawki: pinezka Magnifica w Bielanach, błędne linki SkyEnergy, literówka THE SPACE.
--
-- Uruchom raz w SQL Editorze PRZED wypchnięciem strony. Można uruchomić ponownie.
-- =====================================================================

alter table public.studios drop constraint if exists studios_disciplines_ok;
alter table public.studios add constraint studios_disciplines_ok check (
  disciplines <@ array['rope', 'silks', 'hoop', 'trapeze', 'straps', 'pole', 'hammock', 'aerial_yoga', 'hair', 'other']::text[]
  and cardinality(disciplines) <= 11
);

alter table public.studios add column if not exists activities text[] not null default '{}';
alter table public.studios drop constraint if exists studios_activities_ok;
alter table public.studios add constraint studios_activities_ok check (
  activities <@ array['stretching', 'yoga', 'pilates', 'dance', 'acro', 'fitness']::text[]
);

-- uzupełnienie z opisów (aerial joga; przy studiach tylko z aerial jogą zdejmujemy „Hamak”)
update public.studios set activities = array['dance']::text[] where id = 'd12dfe5d-81f6-4dfc-861d-59079e612db2'; -- AZ Dance Company
update public.studios set activities = array['dance']::text[] where id = 'ab7a021f-a2bb-480d-a674-94b8f2d91aa5'; -- AZ Dance Company - filia Starołęka
update public.studios set disciplines = (select array_agg(distinct x) from unnest(array_remove(disciplines, 'hammock') || array['aerial_yoga']) x) where id = 'fc4a9a1d-76bd-496e-9f96-abb658c0385b'; -- Aerial Life Art studio
update public.studios set disciplines = (select array_agg(distinct x) from unnest(array_remove(disciplines, 'hammock') || array['aerial_yoga']) x) where id = '7cab0f77-be45-4f3d-9493-0fbf54009626'; -- Akademia Meli-Melo
update public.studios set activities = array['acro']::text[] where id = 'abbae687-08f4-4de2-b695-833eeda24e3f'; -- AkroSPOT Akrobatyka Poznań Górczyn
update public.studios set disciplines = (select array_agg(distinct x) from unnest(array_remove(disciplines, 'hammock') || array['aerial_yoga']) x) where id = '42eb6c05-0416-4dfd-ad88-1ecf0d43bd4f'; -- Bądź Pełnią - Beata Pniewska w Przestrzeni Dobra
update public.studios set activities = array['yoga']::text[] where id = '4ae03cff-88bb-4e5b-b35f-753e504ca559'; -- Czuła Joga Pabianice
update public.studios set activities = array['dance']::text[] where id = 'd4813e33-c479-47ab-9cb9-a3bde6679d11'; -- DanceArt Szkoła Tańca
update public.studios set disciplines = (select array_agg(distinct x) from unnest(array_remove(disciplines, 'hammock') || array['aerial_yoga']) x), activities = array['dance']::text[] where id = '5550ad82-ca05-4fb4-8449-b80a015ac3b0'; -- Explozja Tańca
update public.studios set activities = array['acro', 'dance', 'fitness', 'pilates']::text[] where id = '2186a6a5-3373-4f79-ad9b-c0dceba1216f'; -- Fit House Danuta Herczyńska
update public.studios set activities = array['acro', 'fitness']::text[] where id = '0c7a6661-abd8-4a93-83d6-6290626f2018'; -- Fit House Danuta Herczyńska
update public.studios set disciplines = (select array_agg(distinct x) from unnest(disciplines || array['aerial_yoga']) x), activities = array['fitness']::text[] where id = 'ae1681bf-5920-4273-badb-97ef0daa35cf'; -- Fitness For Ladies
update public.studios set disciplines = (select array_agg(distinct x) from unnest(disciplines || array['aerial_yoga']) x) where id = '976ad818-2eab-40bd-9274-4a63b9355d57'; -- Fundacja Sztukmistrze
update public.studios set activities = array['stretching']::text[] where id = '99554ddb-05be-4fc6-a4bf-880e569eab9c'; -- GoFly Studio
update public.studios set disciplines = (select array_agg(distinct x) from unnest(disciplines || array['aerial_yoga']) x) where id = '48bc3f4d-0b72-4e4f-9d14-8651e7d6c8a6'; -- Gravity Aerial Yoga
update public.studios set activities = array['dance']::text[] where id = 'ab98eda9-d6cb-492a-8274-5e81cc13ecb3'; -- Klub Sportowy Akademia Tańca i Baletu FRU
update public.studios set disciplines = (select array_agg(distinct x) from unnest(array_remove(disciplines, 'hammock') || array['aerial_yoga']) x) where id = '1c5e6ed5-2784-4e65-9657-a380d1398dba'; -- Laboratorium Umysłu i Ciała
update public.studios set activities = array['dance']::text[] where id = '5a5ebfc4-37e5-4f8a-ab40-544f376c2a07'; -- MIRA-ART Szkoła Tańca Akrobatycznego
update public.studios set disciplines = (select array_agg(distinct x) from unnest(array_remove(disciplines, 'hammock') || array['aerial_yoga']) x) where id = '48e87f44-4dab-4802-9af3-0b556368914b'; -- Mandala
update public.studios set disciplines = (select array_agg(distinct x) from unnest(disciplines || array['aerial_yoga']) x) where id = '0606da41-3cf8-4ef9-9ab6-04c8ec4a21bf'; -- Naluno Fitness - Natalia Nowak
update public.studios set disciplines = (select array_agg(distinct x) from unnest(array_remove(disciplines, 'hammock') || array['aerial_yoga']) x) where id = 'cd6e72c2-60c8-4e49-a933-2a8bcd5f9f79'; -- Normobaria Eden
update public.studios set disciplines = (select array_agg(distinct x) from unnest(disciplines || array['aerial_yoga']) x) where id = 'e1862034-4800-43f8-abdb-874172ac58c1'; -- North Pole Dance Studio
update public.studios set disciplines = (select array_agg(distinct x) from unnest(array_remove(disciplines, 'hammock') || array['aerial_yoga']) x), activities = array['yoga']::text[] where id = '5b520911-7ab0-4162-9e23-6124c68e7cac'; -- Not Another Yoga Studio
update public.studios set disciplines = (select array_agg(distinct x) from unnest(array_remove(disciplines, 'hammock') || array['aerial_yoga']) x), activities = array['yoga']::text[] where id = '8195e43c-d86d-4958-989b-e6275641f5e9'; -- PURA Yoga Studio
update public.studios set disciplines = (select array_agg(distinct x) from unnest(array_remove(disciplines, 'hammock') || array['aerial_yoga']) x), activities = array['pilates', 'yoga']::text[] where id = 'ec5d6cf6-d4c5-45e4-9a1e-1671ceb59e31'; -- Pilates/Joga Padula-Wielgus Katarzyna
update public.studios set activities = array['pilates', 'stretching', 'yoga']::text[] where id = '8eddce12-7ac0-40c9-b931-7d7881a386de'; -- Pole Flow Dance Studio
update public.studios set disciplines = (select array_agg(distinct x) from unnest(array_remove(disciplines, 'hammock') || array['aerial_yoga']) x) where id = '385b08d6-43e2-428f-9a14-7d8bfb18b564'; -- Przystań
update public.studios set disciplines = (select array_agg(distinct x) from unnest(disciplines || array['aerial_yoga']) x) where id = '07791257-14e0-4351-84d9-139ef3ed0392'; -- Rachel Active Planet
update public.studios set disciplines = (select array_agg(distinct x) from unnest(disciplines || array['aerial_yoga']) x) where id = '804a2cec-9867-4950-b991-131f9f369fdf'; -- SkyEnergy
update public.studios set disciplines = (select array_agg(distinct x) from unnest(disciplines || array['aerial_yoga']) x), activities = array['dance']::text[] where id = 'ab2f8333-2125-4cbf-acd8-c319c3849886'; -- Strefa Tańca Aerial Natural Dance
update public.studios set disciplines = (select array_agg(distinct x) from unnest(array_remove(disciplines, 'hammock') || array['aerial_yoga']) x), activities = array['yoga']::text[] where id = '5e208627-7ddb-4836-840e-247436b00f75'; -- Studio Jogi Rilass
update public.studios set disciplines = (select array_agg(distinct x) from unnest(array_remove(disciplines, 'hammock') || array['aerial_yoga']) x), activities = array['yoga']::text[] where id = 'fa198725-56f3-43e4-b5cd-0f7e0c23549f'; -- Studio Yogi & Mindfulness Harmonia
update public.studios set disciplines = (select array_agg(distinct x) from unnest(array_remove(disciplines, 'hammock') || array['aerial_yoga']) x), activities = array['yoga']::text[] where id = 'b5486f61-9763-425e-8158-4c60297329fd'; -- Studio yogi & mindfulness Harmonia
update public.studios set disciplines = (select array_agg(distinct x) from unnest(array_remove(disciplines, 'hammock') || array['aerial_yoga']) x) where id = '87af716b-65b1-4033-a9f9-acfcec5c59d5'; -- Szkoła Pole Dance Rumia
update public.studios set disciplines = (select array_agg(distinct x) from unnest(disciplines || array['aerial_yoga']) x), activities = array['acro', 'stretching']::text[] where id = '3e802851-4fc4-4b46-b4f3-5773f785d6db'; -- Taniec w Powietrzu - Scena
update public.studios set disciplines = (select array_agg(distinct x) from unnest(disciplines || array['aerial_yoga']) x), activities = array['dance']::text[] where id = '8b8d7b62-c037-436d-989e-c8d91c4d3ddd'; -- White Swan Studio Tańca i Akrobatyki Powietrznej
update public.studios set activities = array['dance']::text[] where id = '5186a5a5-0837-428f-9a16-56da94231db6'; -- White Swan Studio Tańca i Akrobatyki Powietrznej
update public.studios set activities = array['acro']::text[] where id = '0dd5ccf4-0a1f-4191-b5ee-84af013a8ebc'; -- Zodiak Aerial Dance Studio

-- poprawki
update public.studios set lat = 51.0418903, lng = 16.9706201
 where name = 'Centrum Aerial Circus Magnifica' and city = 'Bielany Wrocławskie';           -- pinezka leżała na CDT „Kuźnia”
update public.studios set instagram_url = null, facebook_url = null
 where name = 'SkyEnergy' and city = 'Świnoujście';                                          -- skyenergy_studio.com nie istnieje, skyenergy.com to inna firma
update public.studios set description = replace(description, 'pole & serial', 'pole & aerial')
 where name = 'THE SPACE pole & aerial studio';

-- kontrola
select count(*) filter (where 'aerial_yoga' = any(disciplines)) as aerial_joga,
       count(*) filter (where cardinality(activities) > 0)      as z_innymi_zajeciami
  from public.studios where status = 'approved';
