-- Butterfly Pole Dance & Aerial, Nysa (dane ze strony https://butterflynysa.pl/)
-- Studio na mapę (zatwierdzone, „Dodane przez społeczność” do czasu przejęcia przez studio)
-- i przypięcie warsztatów z Sarą Kreis (7.02.2027) do jego profilu.
-- Uruchom raz w SQL Editorze; powtórka nie zdubluje wpisu.

insert into public.studios (created_by, status, verified, name, city, address, lat, lng, disciplines, activities, kids,
  description, website_url, instagram_url, facebook_url)
select u.id, 'approved', false, 'Butterfly Pole Dance & Aerial', 'Nysa', 'ul. Towarowa 1 (Vendo Park)', 50.4667619, 17.3418084,
  array['silks', 'hoop', 'hammock', 'pole']::text[], array['stretching', 'dance']::text[], true,
  'Szkoła akrobatyki powietrznej w Nysie, działa od 2021 roku. Szarfy, koło, akrobatyka na hamakach, pole dance i exotic oraz stretching. Zajęcia w małych grupach dla osób od 4 do 60 lat, osobne grupy Aerial Kids. Darmowy parking przy Vendo Parku.',
  'https://butterflynysa.pl/', 'https://www.instagram.com/butterflypoledanceandaerial', 'https://www.facebook.com/ButterflyNysa/'
from auth.users u
where u.email = 'admin.aerialevents@cyrkarium.com'
  and not exists (select 1 from public.studios s where s.city = 'Nysa' and s.name ilike 'Butterfly%');

-- warsztaty z Sarą Kreis → profil studia
update public.events e
   set studio_id = s.id
  from public.studios s
 where s.city = 'Nysa' and s.name ilike 'Butterfly%'
   and e.date_start = '2027-02-07' and e.city = 'Nysa' and e.title ilike '%Sar% Kreis%';

-- kontrola
select s.name, s.address, (select count(*) from public.events e where e.studio_id = s.id) as wydarzenia
  from public.studios s where s.city = 'Nysa';
