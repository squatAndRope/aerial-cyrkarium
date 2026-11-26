-- Mikołajkowa sesja zdjęciowa w Lejdis Studio Open Space, Łódź, 19–20.12.2026 (z Facebooka).
-- W kalendarzu tylko koło; pole dance pomijamy. Dodane przez admina, od razu opublikowane.
-- Uruchom raz w SQL Editorze; powtórka nie zdubluje wpisu.

insert into public.events (created_by, status, title, type, level, audience, disciplines, discipline, organizer,
  date_start, date_end, city, venue, lat, lng, is_free, price_pln, reg_deadline, reg_url, description)
select u.id, 'approved', 'Mikołajkowa sesja zdjęciowa na kole', 'photoshoot', 'all', 'all',
  array['hoop']::text[], 'hoop', 'Lejdis Studio Open Space', date '2026-12-19', date '2026-12-20', 'Łódź',
  'Lejdis Studio Open Space, ul. Jaracza 40', 51.7744437, 19.4647024, false, null, null,
  'https://www.facebook.com/events/2013756245963237/',
  'Mikołajkowa sesja zdjęciowa na kole (aerial hoop) w świątecznym klimacie i wyjątkowej oprawie. Tego dnia studio robi też sesję pole dance.

Szczegóły organizacyjne, cena i zapisy pojawią się wkrótce w wydarzeniu na Facebooku.'
from auth.users u
where u.email = 'admin.aerialevents@cyrkarium.com'
  and not exists (select 1 from public.events e where e.reg_url = 'https://www.facebook.com/events/2013756245963237/');

-- kontrola
select title, date_start, date_end, city from public.events where reg_url = 'https://www.facebook.com/events/2013756245963237/';
