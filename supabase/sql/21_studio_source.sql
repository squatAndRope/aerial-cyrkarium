-- =====================================================================
-- Aerial · źródło danych przy studiu
--
-- Gdy studio dodaliśmy na podstawie cudzej listy (za zgodą jej autora),
-- profil pokazuje „Źródło: …” z linkiem. Wpisy dodane przez same studia
-- albo przez użytkowników zostawiają te pola puste.
--
-- Uruchom w SQL Editorze PRZED 22_studios_import.sql i przed wypchnięciem
-- nowej wersji strony. Skrypt można uruchomić ponownie.
-- =====================================================================

alter table public.studios add column if not exists source_name text check (char_length(source_name) <= 100);
alter table public.studios add column if not exists source_url  text check (source_url ~* '^https://' and char_length(source_url) <= 300);

-- pierwsze studia (13_studios_seed.sql) też pochodziły z mapy Taniec w Powietrzu
update public.studios s
set source_name = 'mapa Taniec w Powietrzu',
    source_url  = 'https://taniecwpowietrzu.pl/mapa-aerial-polska,p18.html'
where s.source_name is null
  and (lower(s.name), lower(s.city)) in (
    ('aerial school of wrocław', 'wrocław'), ('aerial moon studio', 'wrocław'), ('real passion', 'kraków'),
    ('krakowska sekcja akrobatyki powietrznej', 'kraków'), ('strefa wysokich lotów białystok', 'białystok'),
    ('szkoła akrobatyki', 'poznań'), ('dream team łódź', 'łódź'), ('magifly szkoła akrobatyki powietrznej', 'kielce'),
    ('mira-art szkoła tańca akrobatycznego', 'gdynia'), ('gojump bielsko-biała', 'bielsko-biała'), ('aerial dance studio', 'warszawa'));

-- kontrola
select name, city, source_name from public.studios where source_name is not null order by city;
