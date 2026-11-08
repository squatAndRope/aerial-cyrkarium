-- =====================================================================
-- Aerial · studia, w których Fundacja Cyrkarium robi warsztaty (Pretix)
--
-- Miejsca z https://pretix.eu/cyrkarium/ (bez Aerial Camp), których nie było
-- na liście. Aerial Dance Studio (Warszawa) już jest.
-- Dane z publicznych stron studiów, bez e-maili i telefonów.
-- Pinezki według adresu (OpenStreetMap / Nominatim). Bez pola źródła:
-- to nasze własne miejsca warsztatów.
--
-- Uruchom raz w SQL Editorze. Ponowne uruchomienie nie zdubluje wpisów.
-- =====================================================================

with admin as (
  select id from auth.users where email = 'admin.aerialevents@cyrkarium.com'
),
rows (name, city, address, lat, lng, disciplines, kids, description, website_url, instagram_url, facebook_url) as (
  values
  ('GoFly Studio', 'Łódź', 'ul. Starorudzka 10b', 51.7150853, 19.4384287,
   array['silks', 'hoop', 'pole']::text[], true,
   'Szarfy, koła cyrkowe, pole dance i stretching. Zajęcia aerial także dla dzieci.',
   'https://goflystudio.pl', null, 'https://www.facebook.com/profile.php?id=61563504404760'),
  ('Akademia Akrobatyki Powietrznej', 'Wrocław', 'ul. Przedwiośnie 5A', 51.1612846, 17.1167448,
   array['silks', 'hoop', 'trapeze']::text[], true,
   'Szkoła akrobatyki powietrznej: szarfy, koła i trapez. Zajęcia dla dzieci, młodzieży i dorosłych na każdym poziomie, dwie sale.',
   null, 'https://www.instagram.com/akademia.powietrzna/', 'https://www.facebook.com/akademia.powietrzna/'),
  ('AkroSPOT Akrobatyka Poznań Górczyn', 'Poznań', 'ul. Węglowa 1', 52.3813349, 16.8754339,
   array['silks']::text[], true,
   'Spot akrobatyczny: akrobatyka sportowa i powietrzna, taniec na szarfach. Grupy dla dzieci (od 4 lat) i dorosłych.',
   'https://akrospot.pl/', null, null),
  ('AKROline Studio (KolekTYw)', 'Gdańsk', 'ul. Malarzy 86B', 54.3644556, 18.6443724,
   array['other']::text[], false,
   'Studio akrobatyki w obiekcie KolekTYw na terenie dawnej stoczni.',
   'https://kolektyw.ninja/', null, null)
)
insert into public.studios
  (created_by, status, verified, name, city, address, lat, lng, disciplines, kids, description,
   website_url, instagram_url, facebook_url)
select a.id, 'approved', false, r.name, r.city, r.address, r.lat, r.lng, r.disciplines, r.kids, r.description,
       r.website_url, r.instagram_url, r.facebook_url
from rows r cross join admin a
where not exists (
  select 1 from public.studios s
  where lower(s.name) = lower(r.name) and lower(s.city) = lower(r.city)
);

-- kontrola
select name, city, address from public.studios
 where name in ('GoFly Studio', 'Akademia Akrobatyki Powietrznej', 'AkroSPOT Akrobatyka Poznań Górczyn', 'AKROline Studio (KolekTYw)');
select count(*) as studia_na_mapie from public.studios where status = 'approved';
