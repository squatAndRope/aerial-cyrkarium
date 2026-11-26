-- Mikołajkowy Aerial Meeting w AkroSPOT, Poznań, 6.12.2026 (z Instagrama akro.spot). Dodane przez admina, od razu opublikowane.
-- Przy okazji: Instagram studia w profilu AkroSPOT (było puste).
-- Uruchom raz w SQL Editorze; powtórka nie zdubluje wpisu.

insert into public.events (created_by, status, title, type, level, audience, disciplines, discipline, organizer,
  date_start, date_end, city, venue, lat, lng, studio_id, is_free, price_pln, reg_deadline, reg_url, description)
select u.id, 'approved', 'Mikołajowy Aerial Meeting w AkroSPOT', 'meetup', 'all', 'adults',
  array['silks', 'hoop']::text[], 'mixed', 'AkroSPOT', date '2026-12-06', date '2026-12-06', 'Poznań',
  'AkroSPOT, ul. Węglowa 1/3 (Górczyn)', 52.3813349, 16.8754339, 'abbae687-08f4-4de2-b695-833eeda24e3f',
  false, null, null, 'https://www.instagram.com/akro.spot/',
  'Mikołajkowe spotkanie dla trenerów, instruktorów i pasjonatów akrobatyki powietrznej z Poznania i okolic. Bez stresu i bez rywalizacji, po prostu czas dla aerialowej społeczności. Niedziela, 15:00–20:00.

W planie:
• krótkie powitanie i przedstawienie programu,
• AkroSPOT w wersji sportowej: możliwości sali jako przestrzeni treningowej,
• AkroSPOT w wersji eventowej: jak obiekt działa przy wydarzeniach i pokazach,
• Aerial Open Stage: scena dla każdego, kto chce pokazać własną twórczość.

Szczegóły i zapisy na Instagramie studia.'
from auth.users u
where u.email = 'admin.aerialevents@cyrkarium.com'
  and not exists (select 1 from public.events e where e.studio_id = 'abbae687-08f4-4de2-b695-833eeda24e3f' and e.date_start = '2026-12-06');

update public.studios set instagram_url = 'https://www.instagram.com/akro.spot/'
 where id = 'abbae687-08f4-4de2-b695-833eeda24e3f' and instagram_url is null;

-- kontrola
select title, date_start, city, venue from public.events
 where studio_id = 'abbae687-08f4-4de2-b695-833eeda24e3f' and date_start = '2026-12-06';
