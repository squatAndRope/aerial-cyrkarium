-- =====================================================================
-- Aerial · pierwsi producenci (jednorazowo)
--
-- Dane ze stron producentów (4.11.2026): nazwa, miasto, rodzaje produktów,
-- linki. Opisy są nasze. Bez e-maili i telefonów.
-- Wpisy od razu zatwierdzone (dodaje je admin), ale bez oznaczenia
-- „potwierdzony”, dopóki producent sam tego nie potwierdzi.
-- „Wysyła za granicę” zostawione na nie: strony tego nie mówią wprost.
--
-- Uruchom w SQL Editorze jeden raz. Ponowne uruchomienie nie zdubluje wpisów.
-- =====================================================================

with admin as (
  select id from auth.users where email = 'admin.aerialevents@cyrkarium.com'
),
rows (name, city, products, custom_orders, ships_abroad, description, website_url, shop_url, instagram_url, facebook_url) as (
  values
  ('Taniec w Powietrzu', 'Łódź',
    array['silks','hoops','frames','rigging','costumes','mats','accessories','other'], false, false,
    'Sprzęt i materiały do aerialu z własnych linii tkanin szytych w Polsce i UE: szarfy i hamaki do aerial jogi (także na metry), koła, sprzęt do podwieszania, stelaże, materace, odzież i akcesoria.',
    null, 'https://taniecwpowietrzu.pl/', 'https://www.instagram.com/taniecwpowietrzu', 'https://www.facebook.com/sklep.taniec.w.powietrzu'),
  ('Flying Rose', 'Łódź',
    array['hoops','silks','frames','rigging','mats','accessories','other'], true, false,
    'Polska marka sprzętu akrobatycznego (FR Sport): koła, także na zamówienie, szarfy w różnych długościach, hamaki do aerial jogi, stelaże, trapezy, sprzęt do podwieszania i akcesoria.',
    null, 'https://www.flyingrose.pl/', 'https://www.instagram.com/flyingrosesport/', 'https://www.facebook.com/flyingrosesport/')
)
insert into public.makers
  (created_by, status, verified, name, city, products, custom_orders, ships_abroad, description, website_url, shop_url, instagram_url, facebook_url)
select a.id, 'approved', false, r.name, r.city, r.products, r.custom_orders, r.ships_abroad, r.description, r.website_url, r.shop_url, r.instagram_url, r.facebook_url
from rows r cross join admin a
where not exists (
  select 1 from public.makers m where lower(m.name) = lower(r.name) and lower(m.city) = lower(r.city)
);

-- kontrola
select name, city, status, products from public.makers order by name;
