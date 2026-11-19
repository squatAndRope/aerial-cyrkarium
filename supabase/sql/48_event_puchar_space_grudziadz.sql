-- III Otwarte Mistrzostwa pole dance / aerial hoop o Puchar SPACE, Grudziądz, 20–21.03.2027 (Space.Gym&Aerial)
-- Dodane przez admina, od razu opublikowane. Bez maila i telefonu organizatora.
-- Link do wydarzenia: https://www.facebook.com/events/1089732853836538/
-- Uruchom raz w SQL Editorze; powtórka nie zdubluje wpisu.

with link as (select 'https://www.facebook.com/events/1089732853836538/'::text as url)
insert into public.events (created_by, status, title, type, level, audience, disciplines, discipline, organizer,
  date_start, date_end, city, venue, lat, lng, is_free, price_pln, reg_deadline, reg_url, description)
select u.id, 'approved', 'III Otwarte Mistrzostwa pole dance / aerial hoop o Puchar SPACE', 'competition', 'all', 'all',
  array['hoop', 'pole']::text[], 'hoop', 'Space.Gym&Aerial', date '2027-03-20', date '2027-03-21', 'Grudziądz',
  'ul. Portowa 5', 53.4884384, 18.7458507, false, null, null, link.url,
  'Trzecia edycja otwartych mistrzostw pole dance i aerial hoop, po rocznej przerwie.

• Dwa dni zawodów, z osobnymi kategoriami pole dance i aerial hoop.
• Duża sala widowiskowa z pełnowymiarową kratą sceniczną, profesjonalnymi rurkami m-pole i kołami aerial, oświetleniem i nagłośnieniem.
• Każdego dnia trzyosobowe jury.
• Więcej kategorii, także dla osób, które dopiero zaczynają występy na scenie.
• Nagrody: puchary, statuetki, nagrody rzeczowe, bony i dyplomy dla każdego uczestnika.
• Szatnie i sala z rurkami i kołami do rozgrzewki, fotograf, wystawcy i catering na miejscu.

Widownia: bilety online lub na miejscu. Regulamin i formularz zgłoszeniowy w dyskusji wydarzenia na Facebooku.'
from auth.users u, link
where u.email = 'admin.aerialevents@cyrkarium.com'
  and link.url like 'https://%'
  and not exists (select 1 from public.events e where e.date_start = '2027-03-20' and e.city = 'Grudziądz');

-- kontrola (pusto = brak linku albo jeszcze nie uruchomione)
select title, date_start, date_end, city, venue, reg_url, status from public.events where city = 'Grudziądz' and date_start = '2027-03-20';
