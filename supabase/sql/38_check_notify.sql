-- Aerial · sprawdzenie, czy webhooki dochodzą do funkcji aerial-notify
-- Tylko odczyt, niczego nie zmienia. Uruchom w SQL Editorze i wklej wynik (oba wyniki).

-- 1. czy testowe zgłoszenie jest w bazie
select id, studio_id, maker_id, reasons, message, created_at
  from public.entry_reports order by created_at desc limit 3;

-- 2. ostatnie odpowiedzi funkcji na webhooki (status 200 = OK, 401 = zły sekret, 5xx = błąd w funkcji)
select id, status_code, left(content::text, 200) as odpowiedz, created
  from net._http_response order by created desc limit 8;

-- 3. jakie webhooki są ustawione i na jakie tabele
select tgname as webhook, tgrelid::regclass as tabela
  from pg_trigger
 where not tgisinternal and tgname not like '%guard%' and tgrelid::regclass::text like 'public.%'
 order by 2;
