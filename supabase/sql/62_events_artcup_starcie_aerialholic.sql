-- Trzy zawody z Facebooka (wiosna 2027). Dodane przez admina, od razu opublikowane.
-- Uruchom raz w SQL Editorze; powtórka nie zdubluje wpisów.

insert into public.events (created_by, status, title, type, level, audience, disciplines, discipline, organizer,
  date_start, date_end, city, venue, lat, lng, studio_id, is_free, price_pln, reg_deadline, reg_url, description)
select u.id, 'approved', t.title, 'competition', 'all', 'all',
  array['silks', 'hoop']::text[], 'mixed', t.organizer, t.d1, t.d2, t.city, t.venue, t.lat, t.lng, t.studio_id,
  false, null, null, t.url, t.description
from auth.users u,
  (values
    ('STARCIE ANIOŁÓW · II Międzynarodowy Turniej Akrobatyki Powietrznej', 'Flying Angels',
     date '2027-02-19', date '2027-02-21', 'Gorzów Wielkopolski', 'Szkoła Podstawowa nr 13, ul. Szwoleżerów 2',
     52.7534570, 15.2433233, null::uuid, 'https://www.facebook.com/events/983071884841139/',
     'Druga edycja międzynarodowego turnieju akrobatyki powietrznej organizowanego przez klub Flying Angels. Trzy dni zawodów. Zapisy trwają od 23 października 2026. Kategorie i regulamin w wydarzeniu na Facebooku.'),
    ('Art Cup 2027 · Ogólnopolskie Zawody w Akrobatyce Powietrznej', 'Klub Sportowy Art',
     date '2027-03-20', date '2027-03-21', 'Strzelce Krajeńskie', null,
     52.8785785, 15.5326861, 'ba43b280-a86c-4937-b7d1-5deb0ca591cf'::uuid, 'https://www.facebook.com/events/1819321429078222/',
     'Ogólnopolskie zawody w akrobatyce powietrznej w Strzelcach Krajeńskich, organizowane przez Klub Sportowy Art. Zgłoszenia od 30 listopada 2026. Kategorie, miejsce i regulamin w wydarzeniu na Facebooku.'),
    ('AERIALHOLIC Rokietnica 2027', 'Poledanceholic Rokietnica',
     date '2027-03-20', date '2027-03-21', 'Rokietnica', 'Rokietnicki Ośrodek Sportu, ul. Szamotulska 29',
     52.5129953, 16.7412196, null::uuid, 'https://www.facebook.com/events/1125356149836237/',
     'Ogólnopolskie zawody aerial w Rokietnicy pod Poznaniem, od organizatorów Poledanceholic. Dwa dni zawodów. Kategorie i zapisy w wydarzeniu na Facebooku.')
  ) as t(title, organizer, d1, d2, city, venue, lat, lng, studio_id, url, description)
where u.email = 'admin.aerialevents@cyrkarium.com'
  and not exists (select 1 from public.events e where e.reg_url = t.url or (e.city = t.city and e.date_start = t.d1));

-- kontrola
select title, date_start, date_end, city from public.events
 where reg_url in ('https://www.facebook.com/events/983071884841139/', 'https://www.facebook.com/events/1819321429078222/', 'https://www.facebook.com/events/1125356149836237/');
