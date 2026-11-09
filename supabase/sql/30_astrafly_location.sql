-- AstraFly Academy: właściwe miejsce to Bronowice koło Brzezin (łódzkie),
-- teren Krainy Dzikiej Kaczki, a nie Kraków. Informacja od samej fundacji.
-- Pinezka według adresu Bronowice 10, gmina Brzeziny (OpenStreetMap).

update public.studios
   set city = 'Bronowice',
       address = 'Bronowice 10 (Kraina Dzikiej Kaczki), gm. Brzeziny',
       lat = 51.79182, lng = 19.81747
 where id = '4540f2f3-0827-44c4-913e-71520bcab466';

select name, city, address, lat, lng from public.studios where id = '4540f2f3-0827-44c4-913e-71520bcab466';
