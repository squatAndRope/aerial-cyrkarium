-- Warsztaty Aerial Hoop z Sarą Kreis, Nysa, 7.02.2027 (wydarzenie na Facebooku: https://fb.me/e/f4jCqgrdJ)
-- Dodane przez admina, od razu opublikowane. Uruchom raz w SQL Editorze; powtórka nie zdubluje wpisu.

insert into public.events (created_by, status, title, type, level, audience, disciplines, discipline, organizer,
  date_start, date_end, city, venue, lat, lng, is_free, price_pln, reg_deadline, reg_url, description)
select u.id, 'approved', 'Warsztaty Aerial Hoop z Sarą Kreis', 'workshop', 'all', 'all', array['hoop']::text[], 'hoop',
  'Butterfly Pole Dance And Aerial Nysa', date '2027-02-07', date '2027-02-07', 'Nysa', 'ul. Wyspiańskiego 3/4',
  50.4738029, 17.3324733, false, 180, null, 'https://fb.me/e/f4jCqgrdJ',
  'Warsztaty z koła z Sarą Kreis: 11 lat doświadczenia w akrobatyce powietrznej, wielokrotna medalistka mistrzostw Polski i świata w Aerial Hoop, finalistka Mam Talent (2022, 2025).

Trzy bloki, każdy po 6 miejsc (1 osoba na koło):
• 12:00–13:15 Dropy i dynamika (początkujący / średniozaawansowany): jak poprawić dynamikę i proste, efektowne dropy na przełamanie się przed spadaniem w przód i w tył.
• 13:30–14:45 Zeskoki z koła i salta (open, głównie dla zaczynających z zeskokami): bezpieczne przygotowanie i rozgrzewka, klasyczne zeskoki: salto spod kolan, z bioder w przód, z V, z pleców.
• 15:00–16:15 Elbow rolls (open): bezpieczna technika, najczęstsze błędy, przygotowanie ciała i głowy, część praktyczna.

Cena: 180 zł za blok. Certyfikaty imienne i mały poczęstunek na miejscu. Zapisy przez Messengera studia Butterfly na Facebooku (link w wydarzeniu).'
from auth.users u
where u.email = 'admin.aerialevents@cyrkarium.com'
  and not exists (select 1 from public.events e where e.date_start = '2027-02-07' and e.city = 'Nysa' and e.title ilike '%Sar% Kreis%');

-- kontrola
select title, date_start, city, venue, price_pln, status from public.events where date_start = '2027-02-07';
