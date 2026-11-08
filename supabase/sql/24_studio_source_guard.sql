-- =====================================================================
-- Aerial · pole „Źródło danych” może ustawić tylko admin
--
-- Bez tego zalogowana osoba mogłaby przez API dodać studio z dowolnym
-- „źródłem” i linkiem, a formularz i kolejka tych pól nie pokazują.
-- Zwykły użytkownik: przy dodawaniu pola są czyszczone, przy edycji
-- zostają takie jak były. Admin (i SQL Editor) może je zmieniać.
--
-- Uruchom raz w SQL Editorze. Można uruchomić ponownie.
-- =====================================================================

create or replace function public.studios_source_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.source_name := null;
    new.source_url  := null;
  else
    new.source_name := old.source_name;
    new.source_url  := old.source_url;
  end if;
  return new;
end;
$$;

drop trigger if exists studios_source_guard on public.studios;
create trigger studios_source_guard
  before insert or update on public.studios
  for each row execute function public.studios_source_guard();

-- kontrola: powinien pokazać oba triggery (studios_guard i studios_source_guard)
select tgname from pg_trigger where tgrelid = 'public.studios'::regclass and not tgisinternal;
