-- Poprawki po imporcie z mapy Taniec w Powietrzu (2026-11-08)

-- Złe pinezki (geokoder wybrał inną wieś o tej samej nazwie)
update public.studios set lat = 54.1735247, lng = 18.6959942, name = 'Skypole Aerial Studio'
 where id = 'ea51c156-f765-45d1-a2a7-bd39ea05b0d8'; -- Pszczółki (pomorskie) + literówka „Aeril”

-- Rachel Active Planet i NashiArt miały identyczną pinezkę (środek Warszawy) — rozsuwamy, żeby obie były klikalne
update public.studios set lat = 52.2297, lng = 21.0122
 where id = '29687b18-7957-40ab-8330-f59f3a16ed15'; -- NashiArt

-- Krakowska Sekcja Akrobatyki Powietrznej: jeden wpis zamiast pięciu
delete from public.studios where id in (
  '88787663-4527-47f0-a7c2-cd1c38f5426a', -- Podłęże
  '110c721f-81ee-4317-a124-1d98298ed64b', -- Łapczyca
  'd1e0aca4-5f2a-48f2-913f-370cf29408d0', -- Dobczyce
  'f833bafd-2db6-42ec-8167-c08be9ec5ff2'  -- Rząska
);
update public.studios
   set description = 'Szarfy i pasy akrobatyczne, grupy pokazowe. Zajęcia także pod Krakowem: Podłęże, Łapczyca, Dobczyce i Rząska.'
 where id = '90b98ff6-7ac3-4acc-9eca-5f1a42700f93';

-- Bezużyteczny link (wyszukiwarka Facebooka zamiast profilu)
update public.studios set facebook_url = null
 where id = 'b65be0b1-08cb-4be4-88e6-4786dbd6fcde'; -- Cyrkus

-- Literówki w adresach
update public.studios set address = 'ul. Cisowa 11'       where id = 'd88659d0-7739-4121-a397-f7d4969cc4d8';
update public.studios set address = 'ul. Trzebińska 60'   where id = '370b6524-98db-4290-a50d-13a57b4c0f4d';
update public.studios set address = 'ul. Piłsudskiego 56' where id = 'a68f6742-3fac-4596-b05f-eba99372647b';

select name, city, lat, lng, address from public.studios
 where id in ('90b98ff6-7ac3-4acc-9eca-5f1a42700f93','ea51c156-f765-45d1-a2a7-bd39ea05b0d8','29687b18-7957-40ab-8330-f59f3a16ed15');

select count(*) as studia_na_mapie from public.studios where status = 'approved';
