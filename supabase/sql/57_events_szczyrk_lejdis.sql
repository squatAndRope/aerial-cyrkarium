-- Dwa wydarzenia z grup na Facebooku. Dodane przez admina, od razu opublikowane.
-- Uruchom raz w SQL Editorze; powtórka nie zdubluje wpisów.

-- 1. Aerial & Chill · Winter Pole Camp, Szczyrk, 29–31.01.2027 (pole i exotic obok aerial hoop i szarf)
with link as (select 'https://www.facebook.com/events/1392739012660074/'::text as url)
insert into public.events (created_by, status, title, type, level, audience, disciplines, discipline, organizer,
  date_start, date_end, city, venue, lat, lng, is_free, price_pln, reg_deadline, reg_url, description)
select u.id, 'approved', 'Aerial & Chill · Winter Pole Camp Szczyrk 2027', 'camp', 'all', 'adults',
  array['hoop', 'silks', 'pole']::text[], 'mixed', 'Aerial & Chill', date '2027-01-29', date '2027-01-31', 'Szczyrk',
  null, 49.7165976, 19.0254613, false, null, null, link.url,
  'Zimowy obóz w górach: pole dance, exotic, aerial hoop, aerial silks, stretching i salsa, a do tego snowboard, narty, sauna i odpoczynek. Limitowana edycja 2027, zapisy otwarte. Szczegóły, cena i miejsce w wydarzeniu na Facebooku.'
from auth.users u, link
where u.email = 'admin.aerialevents@cyrkarium.com'
  and link.url like 'https://%'
  and not exists (select 1 from public.events e where e.city = 'Szczyrk' and e.date_start = '2027-01-29');

-- 2. Mikołajkowe zajęcia na kole w Lejdis Studio Open Space, Łódź, 4.12.2026 (w kalendarzu tylko koła; pole dance pomijamy)
with link as (select 'https://www.facebook.com/events/1465640075546605/'::text as url)
insert into public.events (created_by, status, title, type, level, audience, disciplines, discipline, organizer,
  date_start, date_end, city, venue, lat, lng, is_free, price_pln, reg_deadline, reg_url, description)
select u.id, 'approved', 'Mikołajkowe zajęcia na kole cyrkowym', 'workshop', 'all', 'all',
  array['hoop']::text[], 'hoop', 'Lejdis Studio Open Space', date '2026-12-04', date '2026-12-04', 'Łódź',
  'Lejdis Studio Open Space, ul. Jaracza 40', 51.7744437, 19.4647024, false, null, null, link.url,
  'Mikołajkowe zajęcia na kole cyrkowym w świątecznym klimacie:
• 17:30 – lampki
• 19:40 – duety

Tego dnia studio prowadzi też mikołajkowe zajęcia pole dance. Zapisy i ceny w wydarzeniu na Facebooku.'
from auth.users u, link
where u.email = 'admin.aerialevents@cyrkarium.com'
  and link.url like 'https://%'
  and not exists (select 1 from public.events e where e.city = 'Łódź' and e.date_start = '2026-12-04' and e.organizer ilike 'Lejdis%');

-- kontrola (pusto = brak linku)
select title, date_start, city, reg_url from public.events
 where (city = 'Szczyrk' and date_start = '2027-01-29') or (city = 'Łódź' and date_start = '2026-12-04');
