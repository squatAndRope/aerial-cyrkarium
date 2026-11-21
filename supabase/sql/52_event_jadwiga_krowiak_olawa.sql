-- Warsztaty Aerial Hoop z Jadwigą Krowiak, Flamingo Pole Dance Studio, Oława, sobota 21.11.2026
-- (post w grupie Aerial Hoop Polska + zapisy w ActiveNow; w zapisach jest już tylko blok „Role i przejścia”, 13:45–15:00)
-- Dodane przez admina, od razu opublikowane. Uruchom raz w SQL Editorze; powtórka nie zdubluje wpisu.

insert into public.events (created_by, status, title, type, level, audience, disciplines, discipline, organizer,
  date_start, date_end, city, venue, lat, lng, is_free, price_pln, reg_deadline, reg_url, description, instructors)
select u.id, 'approved', 'Warsztaty Aerial Hoop z Jadwigą Krowiak', 'workshop', 'all', 'all', array['hoop']::text[], 'hoop',
  'Flamingo Pole Dance Studio', date '2026-11-21', date '2026-11-21', 'Oława', 'Flamingo Pole Dance Studio, ul. 3 Maja 2',
  50.9464292, 17.2963110, false, 120, null,
  'https://zapisy.activenow.pl/flamingo-pole-dance-studio-wydarzenia/',
  'Warsztaty na kole aerial z Jadwigą Krowiak we Flamingo Pole Dance Studio w Oławie (ok. 26 km od Wrocławia).

Wolne miejsca zostały na blok „Role i przejścia” (13:45–15:00). Cena: 120 zł za blok. Zapisy przez ActiveNow.',
  array['Jadwiga Krowiak']::text[]
from auth.users u
where u.email = 'admin.aerialevents@cyrkarium.com'
  and not exists (select 1 from public.events e where e.date_start = '2026-11-21' and e.title ilike '%Krowiak%');

-- kontrola
select title, date_start, city, venue, price_pln, instructors, status from public.events where title ilike '%Krowiak%';
