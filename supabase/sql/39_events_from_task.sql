-- =====================================================================
-- Aerial · wydarzenia znalezione przez zadanie wyszukujące (9.11.2026)
--
-- Z 16 propozycji:
--   • 6 już jest w kalendarzu (Kurs Sędziowski PFA, VIII Turniej BASIC, Turniej SWL,
--     Love to Fly vol. 5, I Mistrzostwa PFA, Kurs Trenerski PFA) → pominięte,
--   • Pniewski Festiwal Artystyczny = istniejące „MFA Pniewy” → tylko uzupełnienie miejsca i linku,
--   • kursy wyłącznie pole dance pominięte (kalendarz jest o aerialu),
--   • 5 nowych → dodane jako „czekające na sprawdzenie” (zatwierdzasz w kalendarzu: Do zatwierdzenia).
-- Poprawki: bez e-maili w opisach (zasada strony), autor = konto admina.
-- Uruchom raz w SQL Editorze. Ponowne uruchomienie nie zdubluje wpisów.
-- =====================================================================

-- uzupełnienie MFA Pniewy (bez zmiany tytułu i zatwierdzenia)
update public.events
   set venue = 'Hala OSiR, ul. Wolności 20',
       reg_url = 'https://festiwal-pniewy.pl/?page_id=3083',
       description = 'Pniewski Festiwal Artystyczny: akrobatyka powietrzna, sztuka cyrkowa i sceniczna, kwalifikacje do II Mistrzostw PFA oraz scena otwarta. Regulamin i zapisy wkrótce. Źródło: festiwal-pniewy.pl'
 where title = 'MFA Pniewy' and date_start = '2027-04-09';

with admin as (select id from auth.users where email = 'admin.aerialevents@cyrkarium.com'),
rows (title, type, level, audience, disciplines, organizer, date_start, date_end, city, venue, is_free, price_pln, reg_deadline, reg_url, description) as (values
  ('Szkolenie instruktorskie Aerial Hoop Basic', 'course', 'all', 'all', array['hoop']::text[], 'FR Sport Group / Flying Rose', date '2026-11-28', date '2026-11-29', 'Łódź', 'Klub Aerial, ul. Brukowa 6', false, 1599, null, 'https://www.flyingrose.pl/szkolenie-instruktorskie-z-legitymacja-Aerial-Hoop-Basic',
   'Dwudniowe szkolenie instruktorskie z koła z legitymacją, w małych grupach. Od 16 lat, po co najmniej roku treningów pole lub aerial. Kolejne terminy: 16–17.01, 20–21.02, 6–7.03 i 15–16.05.2027. Zapisy przez stronę organizatora. Źródło: flyingrose.pl'),
  ('Szkolenie instruktorskie Aerial Silks Basic', 'course', 'all', 'all', array['silks']::text[], 'FR Sport Group / Flying Rose', date '2026-12-05', date '2026-12-06', 'Łódź', null, false, 1599, null, 'https://www.flyingrose.pl/szkolenie-instruktorskie-z-legitymacja-Aerial-Silks-Basic',
   'Dwudniowe szkolenie instruktorskie z szarf z legitymacją. Od 16 lat, po co najmniej roku treningów. Kolejne terminy: 6–7.02, 24–25.04 i 22–23.05.2027. Zapisy przez stronę organizatora. Źródło: flyingrose.pl'),
  ('Kurs instruktorski Aerial Jogi – poziom 1', 'course', 'beginner', 'adults', array['hammock']::text[], 'OMG yoga & aerial / Fitology', date '2027-03-06', date '2027-03-07', 'Warszawa', 'FITOLOGY, ul. Norwida 1', false, 1350, null, 'https://omgyoga.pl/kurs-instruktorski-aerial-jogi-poziom-1/',
   'Dwunastogodzinny, dwudniowy kurs instruktorski aerial jogi zakończony zadaniem zaliczeniowym. Przeznaczony dla instruktorów fitness, jogi i tańca. Zapisy przez stronę organizatora. Źródło: omgyoga.pl'),
  ('Akademia Instruktora Aerial Silks – kurs bazowy 2027', 'course', 'all', 'adults', array['silks']::text[], 'CaliBase', date '2027-05-22', date '2027-06-20', 'Świdnica', 'Studio Double Power, ul. Pafalu 6/2', false, 3199, null, 'https://calibase.pl/produkt/akademia-instruktora-aerial-silks-kurs-bazowy/',
   'Kurs instruktorski z szarf zakończony egzaminem i certyfikatem. Trzy zjazdy: 22–23.05, 5–6.06 i 19–20.06.2027. Wymagany co najmniej rok regularnych treningów. Cena rośnie po 28.02 i 30.04.2027. Źródło: calibase.pl'),
  ('Aerial Kids Camp – Lato 2027', 'camp', 'all', 'kids', array['silks','hoop']::text[], 'Gimnastyka Powietrzna', date '2027-06-27', date '2027-07-03', 'Dadaj', 'Hotel Star-Dadaj Resort & SPA', false, 3190, null, 'https://gimnastykapowietrzna.pl/aerial-kids-camp-lato-2026/',
   'Letnie zgrupowanie sportowo-akrobatyczne dla dzieci i młodzieży w wieku 7–18 lat: szarfy, koło i akrobatyka. Organizator z Warszawy, opcjonalny dojazd autokarem. Źródło: gimnastykapowietrzna.pl')
)
insert into public.events (created_by, status, title, type, level, audience, disciplines, organizer, date_start, date_end, city, venue, is_free, price_pln, reg_deadline, reg_url, description)
select a.id, 'pending', r.title, r.type, r.level, r.audience, r.disciplines, r.organizer, r.date_start, r.date_end, r.city, r.venue, r.is_free, r.price_pln, r.reg_deadline::date, r.reg_url, r.description
from rows r cross join admin a
where not exists (select 1 from public.events e where e.date_start = r.date_start and lower(e.title) = lower(r.title));

-- kontrola: nowe wydarzenia w kolejce
select date_start, city, title, status from public.events where status = 'pending' order by date_start;
