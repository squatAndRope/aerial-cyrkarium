-- =====================================================================
-- Aerial · uprawnienia do tabeli studio_emails
--
-- Projekt nie nadaje nowym tabelom uprawnień automatycznie, więc zalogowani
-- (autor studia, admin) nie mogliby zapisać e-maila z formularza.
-- Kto dokładnie może co zrobić, i tak ogranicza reguła RLS z pliku 26
-- (tylko autor studia albo admin). Niezalogowani nie dostają nic:
-- widzą e-mail wyłącznie przez przycisk „Pokaż e-mail”.
--
-- Uruchom raz w SQL Editorze. Można uruchomić ponownie.
-- =====================================================================

grant select, insert, update, delete on public.studio_emails to authenticated;
revoke all on public.studio_emails from anon;

-- kontrola: authenticated powinien mieć SELECT, INSERT, UPDATE, DELETE
select grantee, privilege_type from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'studio_emails' order by grantee, privilege_type;
