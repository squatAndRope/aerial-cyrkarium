-- Prowadzący wydarzenia (imię i nazwisko albo pseudonim artystyczny), nieobowiązkowe.
-- Kalendarz pokazuje ich na karcie i w okienku, link /calendar/?with=<osoba> pokazuje wszystkie wydarzenia z tą osobą,
-- a dane dla Google dostają pole „performer”. Uruchom raz w SQL Editorze.

alter table public.events add column if not exists instructors text[] not null default '{}';

alter table public.events drop constraint if exists events_instructors_ok;
alter table public.events add constraint events_instructors_ok check (
  cardinality(instructors) <= 10
  and char_length(array_to_string(instructors, '|')) <= 600
  and not ('' = any (instructors))
);

-- kontrola
select column_name, data_type, column_default from information_schema.columns
 where table_schema = 'public' and table_name = 'events' and column_name = 'instructors';
