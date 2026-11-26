-- Vertical Play – Rope & Silks (Emmen Jude Donnelly i Kate Dunne), Łódź, GoFly Studio, 3–4.04.2027.
-- Dane ze strony pretix (opis mówi: Łódź, GoFly Studio). Dodane przez admina, od razu opublikowane.
-- Cena celowo pusta: w opisie jest 400 zł za dzień, a w biletach 389 zł. Uzupełnij, gdy ceny w pretix będą poprawione.
-- Uruchom raz w SQL Editorze; powtórka nie zdubluje wpisu.

insert into public.events (created_by, status, title, type, level, audience, disciplines, discipline, organizer,
  date_start, date_end, city, venue, lat, lng, studio_id, is_free, price_pln, reg_deadline, reg_url, instructors, description)
select u.id, 'approved', 'Vertical Play – Rope & Silks', 'workshop', 'all', 'adults',
  array['rope', 'silks']::text[], 'mixed', 'Fundacja Cyrkarium', date '2027-04-03', date '2027-04-04', 'Łódź',
  'GoFly Studio, ul. Starorudzka 10b', 51.7728245, 19.478486, '99554ddb-05be-4fc6-a4bf-880e569eab9c',
  false, null, date '2027-03-05', 'https://pretix.eu/cyrkarium/vertical-play/',
  array['Emmen Jude Donnelly', 'Kate Dunne']::text[],
  'Vertical Play po raz pierwszy w Polsce! Irlandzkie artystki powietrzne Emmen Jude Donnelly i Kate Dunne łączą choreografię na linie i szarfach: nowe przejścia działające na obu przyrządach, równowaga, skręty, siła w odwróceniach, węzły, zrzuty i choreografia na rozdzielonych szarfach.

4 godziny treningu dziennie, zajęcia po angielsku. Dla osób trenujących od około pół roku do kilku lat; bardziej doświadczeni też znajdą wyzwania.

Zapisy od 4 stycznia do 5 marca 2027. Warsztaty ruszą przy minimum 15 osobach.'
from auth.users u
where u.email = 'admin.aerialevents@cyrkarium.com'
  and not exists (select 1 from public.events e where e.reg_url = 'https://pretix.eu/cyrkarium/vertical-play/');

-- kontrola
select title, date_start, city, venue, instructors from public.events where reg_url = 'https://pretix.eu/cyrkarium/vertical-play/';
