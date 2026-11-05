-- =====================================================================
-- Aerial · studia: open training i wynajem sali
--
-- Dwa pola tak/nie, które studio zaznacza w formularzu. Na mapie można
-- po nich filtrować, a w profilu pojawiają się jako etykiety.
--
-- Uruchom w SQL Editorze PRZED wypchnięciem nowej wersji strony.
-- Skrypt można uruchomić ponownie.
-- =====================================================================

alter table public.studios add column if not exists open_training boolean not null default false;
alter table public.studios add column if not exists rental        boolean not null default false;

-- kontrola
select name, city, open_training, rental from public.studios order by city, name;
