-- Space.Gym&Aerial, Grudziądz (Instagram, Facebook, wpis na vanitystyle.pl)
-- Studio na mapę („Dodane przez społeczność” do czasu przejęcia przez studio)
-- i przypięcie Mistrzostw o Puchar SPACE (20–21.03.2027) do jego profilu.
-- Adres ul. Portowa 5 z profilu studia na Facebooku (tam też odbywają się zawody).
-- Uruchom raz w SQL Editorze; powtórka nie zdubluje wpisu.

insert into public.studios (created_by, status, verified, name, city, address, lat, lng, disciplines, activities, kids,
  description, instagram_url, facebook_url)
select u.id, 'approved', false, 'Space.Gym&Aerial', 'Grudziądz', 'ul. Portowa 5', 53.4884384, 18.7458507,
  array['hoop', 'pole']::text[], array['fitness']::text[], true,
  'Siłownia i studio pole dance i aerial hoop w Grudziądzu: sala z rurkami i kołami aerial, fitness, zajęcia fitness dla dzieci. Organizator Otwartych Mistrzostw pole dance / aerial hoop o Puchar SPACE.',
  'https://www.instagram.com/space_gym_aerial/', 'https://www.facebook.com/p/SpaceGymAerial-61558413564334/'
from auth.users u
where u.email = 'admin.aerialevents@cyrkarium.com'
  and not exists (select 1 from public.studios s where s.city = 'Grudziądz' and s.name ilike 'Space%Gym%');

-- zawody → profil studia
update public.events e
   set studio_id = s.id
  from public.studios s
 where s.city = 'Grudziądz' and s.name ilike 'Space%Gym%'
   and e.city = 'Grudziądz' and e.date_start = '2027-03-20';

-- kontrola
select s.name, s.address, (select count(*) from public.events e where e.studio_id = s.id) as wydarzenia
  from public.studios s where s.city = 'Grudziądz';
