-- Pinezki studiów w Gdańsku, które stały w Zatoce Gdańskiej (brak adresu → „środek” granic miasta w morzu).
-- Adresy Skypole ze strony skypolegdansk.pl/kontakt. Uruchom raz w SQL Editorze.

-- Skypole Dance Studio (sala aerial): Morena, budynek z KFC, wejście od ul. Marusarzówny, I piętro, lok. 29
update public.studios
   set address = 'ul. Heleny Marusarzówny (Morena, budynek z KFC, I piętro, lok. 29)', lat = 54.3578137, lng = 18.5764825
 where id = '88788f2a-16a8-467c-8c47-afe42441a4c4';

-- Skypole Aerial Studio, Pszczółki: ul. Sportowa 57
update public.studios
   set address = 'ul. Sportowa 57', lat = 54.1723418, lng = 18.6754957
 where id = 'ea51c156-f765-45d1-a2a7-bd39ea05b0d8';

-- Polektyw: adres nieznany → środek Gdańska (Śródmieście), do czasu aż studio poda adres
update public.studios
   set lat = 54.3482907, lng = 18.6540233
 where id = '15f3c1dc-f866-40fa-b0d5-6cd891abe50e' and address is null;

select name, city, address, lat, lng from public.studios
 where id in ('88788f2a-16a8-467c-8c47-afe42441a4c4', 'ea51c156-f765-45d1-a2a7-bd39ea05b0d8', '15f3c1dc-f866-40fa-b0d5-6cd891abe50e');
