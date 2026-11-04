-- =====================================================================
-- Aerial · pierwsze studia na mapę (jednorazowo)
--
-- Źródło: publiczna mapa taniecwpowietrzu.pl (Google My Maps, eksport KML,
-- 4.11.2026). Przeniesione są tylko: nazwa, miasto, adres sali i linki.
-- E-maile i telefony z tamtej mapy celowo pominięte. Opisy są nasze, krótkie.
--
-- Wszystkie trafiają jako 'pending' i 'Dodane przez społeczność':
-- przed zatwierdzeniem w „Moich studiach → Do sprawdzenia” warto kliknąć
-- link i sprawdzić, czy studio wciąż działa pod tym adresem.
-- Autorem wpisów jest konto admina.
--
-- Uruchom w SQL Editorze jeden raz. Ponowne uruchomienie nie zdubluje
-- wpisów (sprawdza nazwę i miasto).
-- =====================================================================

with admin as (
  select id from auth.users where email = 'admin.aerialevents@cyrkarium.com'
),
rows (name, city, address, lat, lng, disciplines, levels, kids, description, website_url, instagram_url, facebook_url) as (
  values
  ('Aerial School of Wrocław', 'Wrocław', 'ul. Sudecka 96', 51.08649, 17.01788,
    array['silks','hoop','hammock'], array[]::text[], false,
    'Szkoła akrobatyki powietrznej: szarfy, koło i hamaki.',
    'http://aerialschoolofwroclaw.pl/', null, 'https://www.facebook.com/szkola.akrobatyki.powietrznej.wroclaw/'),
  ('Aerial Moon Studio', 'Wrocław', 'ul. Podwale 63', 51.10337, 17.03906,
    array['hoop','silks'], array['beginner','intermediate','advanced'], false,
    'Koło i szarfy, od zera do poziomu zaawansowanego.',
    null, 'https://www.instagram.com/aerialmoonstudio/', 'https://www.facebook.com/profile.php?id=61574017766508'),
  ('Real Passion', 'Kraków', 'ul. Długa 82/6', 50.07283, 19.93499,
    array['silks','hoop'], array['beginner','intermediate'], true,
    'Szarfy dla dorosłych i dzieci, warsztaty z koła, zajęcia indywidualne.',
    'http://www.realpassion.pl/', null, 'https://www.facebook.com/aerialsilkkrakow/'),
  ('Krakowska Sekcja Akrobatyki Powietrznej', 'Kraków', 'os. Kalinowe 18', 50.0904, 20.01123,
    array['silks','straps'], array[]::text[], false,
    'Szarfy i pasy akrobatyczne, grupy pokazowe. Zajęcia także w kilku miejscowościach pod Krakowem.',
    'https://zapisy.activenow.pl/krakowska-sekcja-akrobatyki-powietrznej/', null, 'https://www.facebook.com/krkSAP'),
  ('Strefa Wysokich Lotów Białystok', 'Białystok', 'ul. Andersa 42', 53.1568, 23.15839,
    array['silks','hoop'], array[]::text[], false,
    'Zajęcia na szarfach, w parku dostępne też koło.',
    'https://strefawysokichlotow.pl/bialystok/', null, 'https://www.facebook.com/StrefaWysokichLotowPL/'),
  ('Szkoła Akrobatyki', 'Poznań', 'ul. Maltańska 1', 52.40145, 16.96195,
    array['silks','hoop','trapeze'], array[]::text[], false,
    'Grupowe zajęcia na szarfach, indywidualnie koło i trapez.',
    'https://szkolaakrobatyki.pl', null, null),
  ('Dream Team Łódź', 'Łódź', 'ul. Łąkowa 7a', 51.76173, 19.43887,
    array['silks','hoop'], array[]::text[], false,
    'Szarfy i koło.',
    'http://dreamteam-lodz.pl/', null, 'https://www.facebook.com/lodzdreamteam/'),
  ('Magifly Szkoła Akrobatyki Powietrznej', 'Kielce', 'ul. Targowa 3', 50.8785, 20.63356,
    array['silks','hoop'], array[]::text[], false,
    'Szarfy i koło. Druga sala przy ul. Jurajskiej 1.',
    'https://szarfykielce.pl/', null, 'https://www.facebook.com/szarfy.kielce/'),
  ('MIRA-ART Szkoła Tańca Akrobatycznego', 'Gdynia', 'ul. Hutnicza 12', 54.54454, 18.48065,
    array['silks','hoop'], array[]::text[], false,
    'Aerial dance: szarfy, koło i inne przyrządy.',
    'https://szkolaaerial.pl', null, 'https://www.facebook.com/miraart.szkola'),
  ('GOJUMP Bielsko-Biała', 'Bielsko-Biała', 'ul. Legionów 26/28', 49.82662, 19.05485,
    array['silks','hoop'], array[]::text[], false,
    'Szarfy i koło.',
    'https://bielsko.gojump.pl/', null, null),
  ('Aerial Dance Studio', 'Warszawa', 'Saska Kępa i Wola', 52.23299, 21.05718,
    array['silks','hoop','trapeze'], array[]::text[], false,
    'Szarfy, koło i trapez, zajęcia regularne i warsztaty. Dwie lokalizacje.',
    'http://www.aerialdancestudio.pl/', null, 'https://www.facebook.com/AerialDanceStudio/')
)
insert into public.studios
  (created_by, status, verified, name, city, address, lat, lng, disciplines, levels, kids, description, website_url, instagram_url, facebook_url)
select a.id, 'pending', false, r.name, r.city, r.address, r.lat, r.lng, r.disciplines, r.levels, r.kids, r.description, r.website_url, r.instagram_url, r.facebook_url
from rows r cross join admin a
where not exists (
  select 1 from public.studios s where lower(s.name) = lower(r.name) and lower(s.city) = lower(r.city)
);

-- kontrola: lista dodanych, czekających na sprawdzenie
select name, city, status from public.studios order by city, name;
