-- AKROline Studio (Gdańsk): dane od samego studia (wiadomość do Klaudii, 9.11.2026)
--  • druga sala: Movement Arena (Polsat Plus Arena, ul. Pokoleń Lechii Gdańsk 1)
--  • zapisy: https://app.fitssey.com/akrolinestudio, Instagram: @akro_line_studio
--  • e-mail kontaktowy za zgodą studia („możesz podać email”), pokazywany po kliknięciu „Pokaż e-mail”
--  • zgłoszenie od właściciela → profil potwierdzony
-- Uruchom raz w SQL Editorze. Można uruchomić ponownie.

-- 1. dotychczasowy wpis (KolekTYw)
update public.studios
   set name = 'AKROline Studio · KolekTYw',
       website_url = 'https://app.fitssey.com/akrolinestudio',
       instagram_url = 'https://www.instagram.com/akro_line_studio/',
       activities = array['acro']::text[],
       submitted_by_owner = true, verified = true
 where id = '08a00a86-cc9e-42a3-9a07-442b0f4c45be';

-- 2. druga sala: Movement Arena
insert into public.studios
  (created_by, status, verified, submitted_by_owner, name, city, address, lat, lng, disciplines, activities, kids,
   description, website_url, instagram_url)
select s.created_by, 'approved', true, true, 'AKROline Studio · Movement Arena', 'Gdańsk',
       'ul. Pokoleń Lechii Gdańsk 1 (Movement Arena, Polsat Plus Arena)', 54.3899568, 18.6414218,
       s.disciplines, array['acro']::text[], s.kids,
       'Zajęcia AKROline Studio w Movement Arena na stadionie Polsat Plus Arena. Druga sala: KolekTYw, ul. Malarzy 86B.',
       'https://app.fitssey.com/akrolinestudio', 'https://www.instagram.com/akro_line_studio/'
  from public.studios s
 where s.id = '08a00a86-cc9e-42a3-9a07-442b0f4c45be'
   and not exists (select 1 from public.studios x where x.name = 'AKROline Studio · Movement Arena');

update public.studios
   set description = 'Studio akrobatyki w obiekcie KolekTYw na terenie dawnej stoczni. Druga sala: Movement Arena na stadionie Polsat Plus Arena.'
 where id = '08a00a86-cc9e-42a3-9a07-442b0f4c45be';

-- 3. e-mail kontaktowy (za zgodą studia) przy obu salach
insert into public.studio_emails (studio_id, email, consent_at)
select id, 'akrolinestudio@gmail.com', now() from public.studios
 where name in ('AKROline Studio · KolekTYw', 'AKROline Studio · Movement Arena')
on conflict (studio_id) do update set email = excluded.email, consent_at = excluded.consent_at, updated_at = now();

-- kontrola
select s.name, s.address, s.website_url, s.verified, e.email
  from public.studios s left join public.studio_emails e on e.studio_id = s.id
 where s.name like 'AKROline%';
