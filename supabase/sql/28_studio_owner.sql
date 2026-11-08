-- =====================================================================
-- Aerial · studio dodane przez właściciela = potwierdzone
--
-- W formularzu jest pole „Jestem właścicielką / właścicielem albo
-- reprezentuję to studio”. Zapisuje się w submitted_by_owner. Gdy admin
-- zatwierdza takie zgłoszenie, profil od razu dostaje „Profil potwierdzony
-- przez studio” (verified). Samo zaznaczenie pola niczego nie potwierdza:
-- verified ustawia tylko admin (strażnik studios_guard).
--
-- Dodatkowo:
--  • zgłoszenia, które już przyszły od studiów (konto inne niż admin,
--    zatwierdzone), oznaczamy jako od właściciela i potwierdzone,
--  • AstraFly: Kraków-Bronowice zamiast wsi Bronowice w lubuskim.
--
-- Uruchom raz w SQL Editorze. Można uruchomić ponownie.
-- =====================================================================

alter table public.studios add column if not exists submitted_by_owner boolean not null default false;

-- dotychczasowe zgłoszenia od studiów
update public.studios s
   set submitted_by_owner = true, verified = true
 where s.status = 'approved'
   and s.created_by is distinct from (select id from auth.users where email = 'admin.aerialevents@cyrkarium.com');

-- AstraFly: Kraków, dzielnica Bronowice (dokładnej ulicy nie znamy, studio może ją dopisać)
update public.studios
   set city = 'Kraków', address = 'Bronowice', lat = 50.0784239, lng = 19.8892234
 where id = '4540f2f3-0827-44c4-913e-71520bcab466';

-- kontrola
select name, city, address, verified, submitted_by_owner from public.studios
 where submitted_by_owner order by name;
