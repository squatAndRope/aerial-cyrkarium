-- =====================================================================
-- Aerial · rodzaj ogłoszenia (co robisz): sprzedam / kupię / oddam / szukam / oferuję
--
-- Kategoria mówi, czego dotyczy ogłoszenie, rodzaj: co autor robi.
--   partner → seek (szukam)
--   gear    → sell (sprzedam), buy (kupię / szukam), give (oddam za darmo)
--   space   → offer (wynajmę), seek (szukam sali)
--   job     → offer (szukam instruktora), seek (szukam pracy / zastępstwa)
-- Przy „oddam” nie ma ceny.
--
-- Uruchom w SQL Editorze. Skrypt można uruchomić ponownie.
-- =====================================================================

alter table public.listings add column if not exists kind text;

-- istniejące wpisy: sensowny rodzaj według kategorii
update public.listings set kind = case category when 'gear' then 'sell' when 'partner' then 'seek' else 'offer' end
where kind is null;

alter table public.listings alter column kind set not null;

alter table public.listings drop constraint if exists listings_kind_ok;
alter table public.listings add constraint listings_kind_ok check (
  (category = 'partner' and kind = 'seek')
  or (category = 'gear' and kind in ('sell', 'buy', 'give'))
  or (category in ('space', 'job') and kind in ('offer', 'seek'))
);

alter table public.listings drop constraint if exists listings_give_free;
alter table public.listings add constraint listings_give_free check (kind <> 'give' or price is null);

-- kontrola: rodzaje istniejących ogłoszeń
select category, kind, count(*) from public.listings group by 1, 2 order by 1, 2;
