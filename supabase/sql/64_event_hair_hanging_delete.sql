-- Tzina Trikka · Hair Hanging, Gdańsk, 5–6.12.2026: warsztaty się nie odbędą. Usuwamy wydarzenie z kalendarza.
-- Uruchom raz w SQL Editorze.

delete from public.events where id = 'c8054d93-3dc0-4305-9da8-d5f08eb96bc1';

-- kontrola (pusto = usunięte)
select title, date_start from public.events where id = 'c8054d93-3dc0-4305-9da8-d5f08eb96bc1';
