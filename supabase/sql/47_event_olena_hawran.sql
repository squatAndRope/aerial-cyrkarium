-- Warsztaty szarfowe z Oleną Hawran, Centrum Aerial Circus (Grupa Magnifica), Bielany Wrocławskie, 5.12.2026
-- Dodane przez admina, od razu opublikowane i przypięte do profilu studia.
-- Zapisy są mailowe u konkretnej osoby: jej adresu i telefonu nie przepisujemy, link prowadzi na Facebooka studia.
-- Uruchom raz w SQL Editorze; powtórka nie zdubluje wpisu.

insert into public.events (created_by, status, title, type, level, audience, disciplines, discipline, organizer,
  date_start, date_end, city, venue, lat, lng, is_free, price_pln, reg_deadline, reg_url, description, studio_id)
select u.id, 'approved', 'Warsztaty szarfowe z Oleną Hawran', 'workshop', 'all', 'all', array['silks']::text[], 'silks',
  'Grupa Magnifica · Centrum Aerial Circus', date '2026-12-05', date '2026-12-05', 'Bielany Wrocławskie',
  'Centrum Aerial Circus, ul. Wrocławska 7', 51.0418903, 16.9706201, false, 240, null,
  'https://www.facebook.com/grupamagnifica',
  'Mikołajkowe warsztaty na szarfie z Oleną Hawran: wychowanką Ocelot Foundation w Legnicy, artystką występującą w Szwajcarii, Niemczech i na Węgrzech, prowadzącą własną szkołę akrobatyki powietrznej w Przemyślu.

Nowe elementy, dynamiczne triki, technika wybicia, kontrola ciała w ruchu, płynne przejścia i widowiskowe sekwencje.

Bloki do wyboru:
• 10:00–12:00 Blok I: poziom średniozaawansowany i zaawansowany.
• 12:15–14:15 Blok II: dla trenerów, dodatkowo asekuracja w dynamice.
• 14:45–16:45 Blok III: młodzież 10–16 lat, która wchodzi na szarfę nakrywką, ale nie jest jeszcze zaawansowana.

Cena: 240 zł za blok. Liczba miejsc ograniczona. Zapisy mailowo u organizatora (kontakt w ogłoszeniu na profilu Grupy Magnifica).',
  '51fccc88-421f-4365-9ca3-6df6632118a4'
from auth.users u
where u.email = 'admin.aerialevents@cyrkarium.com'
  and not exists (select 1 from public.events e where e.date_start = '2026-12-05' and e.title ilike '%Hawran%');

-- kontrola
select title, date_start, city, venue, price_pln, status, studio_id from public.events where title ilike '%Hawran%';
