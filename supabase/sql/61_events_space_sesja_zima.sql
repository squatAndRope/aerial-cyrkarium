-- Dwa wydarzenia z Instagrama. Dodane przez admina, od razu opublikowane.
-- Uruchom raz w SQL Editorze; powtórka nie zdubluje wpisów.

-- 1. Świąteczno-noworoczna sesja zdjęciowa na kole, Space.Gym&Aerial, Grudziądz, 19.12.2026 (w kalendarzu tylko koło; pole dance pomijamy)
insert into public.events (created_by, status, title, type, level, audience, disciplines, discipline, organizer,
  date_start, date_end, city, venue, lat, lng, studio_id, is_free, price_pln, reg_deadline, reg_url, description)
select u.id, 'approved', 'Świąteczno-noworoczna sesja zdjęciowa na kole', 'photoshoot', 'all', 'all',
  array['hoop']::text[], 'hoop', 'Space.Gym&Aerial', date '2026-12-19', date '2026-12-19', 'Grudziądz',
  'Space.Gym&Aerial, ul. Portowa 5', 53.4884384, 18.7458507, '0e37dbc0-5710-4218-90fe-dd62b76bbeda',
  false, 90, null, 'https://www.instagram.com/space_gym_aerial/',
  'Złota sesja zdjęciowa w świąteczno-noworocznym klimacie na kole (aerial hoop). Start o 9:00.

Cena: 90 zł za 3 ujęcia. Tego dnia studio robi też sesję na rurze. Zapisy przez Instagram studia.'
from auth.users u
where u.email = 'admin.aerialevents@cyrkarium.com'
  and not exists (select 1 from public.events e where e.city = 'Grudziądz' and e.date_start = '2026-12-19');

-- 2. Zima w Powietrzu – półkolonie dla dzieci 7–13 lat, Gimnastyka Powietrzna, Warszawa (dwa turnusy = dwa wpisy)
insert into public.events (created_by, status, title, type, level, audience, disciplines, discipline, organizer,
  date_start, date_end, city, venue, lat, lng, is_free, price_pln, reg_deadline, reg_url, description)
select u.id, 'approved', t.title, 'camp', 'all', 'kids',
  array['silks', 'hoop']::text[], 'mixed', 'Gimnastyka Powietrzna', t.d1, t.d2, 'Warszawa',
  t.venue, 52.2439833, 20.9628238, false, 1050, null, 'https://gimnastykapowietrzna.pl/zima-w-powietrzu-2027/',
  'Zimowe półkolonie dla dzieci i młodzieży w wieku 7–13 lat, codziennie 9:00–17:00: nauka tańca na szarfach i kole, warsztaty cyrkowe, wyjścia na kręgle i do kina, a na koniec turnusu pokaz umiejętności.

' || t.places || '

Cena 1050 zł za turnus: wyżywienie w ciągu dnia, wszystkie zajęcia, atrakcje i ubezpieczenie. Rabaty dla rodzeństwa i osób, które już były na półkoloniach. Zapisy mailowo, szczegóły na stronie organizatora.'
from auth.users u,
  (values
    ('Zima w Powietrzu · półkolonie aerial dla dzieci, turnus I', date '2027-02-01', date '2027-02-05',
     'FLY SCHOOL, ul. Zawiszy 14 (też ul. Sokołowska 9 i Łomianki)',
     'Miejsca: FLY SCHOOL (ul. Zawiszy 14), ul. Sokołowska 9 lok. 7 oraz Łomianki (ul. Warszawska 10).'),
    ('Zima w Powietrzu · półkolonie aerial dla dzieci, turnus II', date '2027-02-08', date '2027-02-12',
     'FLY SCHOOL, ul. Zawiszy 14 (też ul. Sokołowska 9)',
     'Miejsca: FLY SCHOOL (ul. Zawiszy 14) oraz ul. Sokołowska 9 lok. 7.')
  ) as t(title, d1, d2, venue, places)
where u.email = 'admin.aerialevents@cyrkarium.com'
  and not exists (select 1 from public.events e where e.organizer = 'Gimnastyka Powietrzna' and e.date_start = t.d1);

-- kontrola
select title, date_start, date_end, city, price_pln from public.events
 where (city = 'Grudziądz' and date_start = '2026-12-19') or (organizer = 'Gimnastyka Powietrzna' and date_start in ('2027-02-01', '2027-02-08'));
