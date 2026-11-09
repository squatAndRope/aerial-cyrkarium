-- AKROline · KolekTYw: przywrócenie danych z pliku 32 i przekazanie edycji właścicielce.
-- Wpis został zapisany z formularza otwartego jeszcze przed plikiem 32 (stara nazwa, stary link,
-- bez Instagrama), więc plik 33 go nie znalazł. Logo z tej edycji zostaje.
-- Uruchom raz w SQL Editorze.

update public.studios
   set name = 'AKROline Studio · KolekTYw',
       website_url = 'https://app.fitssey.com/akrolinestudio',
       instagram_url = 'https://www.instagram.com/akro_line_studio/',
       description = 'Studio akrobatyki w obiekcie KolekTYw na terenie dawnej stoczni. Druga sala: Movement Arena na stadionie Polsat Plus Arena.',
       activities = array['acro']::text[],
       submitted_by_owner = true, verified = true,
       created_by = coalesce((select id from auth.users where lower(email) = 'akrolinestudio@gmail.com'), created_by)
 where id = '08a00a86-cc9e-42a3-9a07-442b0f4c45be';

-- kontrola: obie sale z adresem właścicielki, logo i e-mailem
select s.name, u.email as edytuje, s.logo_path is not null as logo, e.email as email_kontaktowy
  from public.studios s
  left join auth.users u on u.id = s.created_by
  left join public.studio_emails e on e.studio_id = s.id
 where s.name like 'AKROline%';
