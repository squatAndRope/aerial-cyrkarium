-- SŁOWIANKA Studio Pole Dance, Ząbkowice Śląskie (dane z profilu studia na Facebooku)
-- Bez telefonu i e-maila: e-mail pokazujemy tylko, gdy studio samo go poda w formularzu (ze zgodą).
-- Uruchom raz w SQL Editorze; powtórka nie zdubluje wpisu.

insert into public.studios (created_by, status, verified, name, city, address, lat, lng, disciplines, activities, kids,
  description, instagram_url)
select u.id, 'approved', false, 'SŁOWIANKA Studio Pole Dance', 'Ząbkowice Śląskie', 'pl. Marii Skłodowskiej-Curie 1',
  50.5904544, 16.8099741,
  array['silks', 'pole', 'other']::text[], array['dance', 'stretching', 'fitness']::text[], false,
  'Pierwsze profesjonalne studio pole dance w Ząbkowicach Śląskich. Pole dance, aerial (szarfy), Bungee Fit, exotic, high heels i stretching. Zapisy przez Instagram studia.',
  'https://www.instagram.com/slowianka.studio.poledance/'
from auth.users u
where u.email = 'admin.aerialevents@cyrkarium.com'
  and not exists (select 1 from public.studios s where s.city = 'Ząbkowice Śląskie' and s.name ilike '%Słowianka%');

select name, city, address, disciplines from public.studios where city = 'Ząbkowice Śląskie';
