-- Aerial · studio organizuje urodziny (dla dzieci albo dorosłych)
-- Nowa opcja w „Co jeszcze oferuje studio”, obok open trainingu i wynajmu sali,
-- z filtrem na liście studiów. Domyślnie wyłączona; studia zaznaczają ją same w edycji.
-- Uruchom raz w SQL Editorze PRZED wypchnięciem strony. Można uruchomić ponownie.

alter table public.studios add column if not exists birthdays boolean not null default false;

select count(*) as studia from public.studios;
