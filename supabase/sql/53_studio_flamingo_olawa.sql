-- Flamingo Pole Dance Studio, Oława (adres z zapisów ActiveNow; studio organizuje warsztaty z koła aerial)
-- Studio na mapę („Dodane przez społeczność” do czasu przejęcia przez studio)
-- i przypięcie warsztatów z Jadwigą Krowiak (21.11.2026) do jego profilu. Najpierw uruchom plik 52.
-- Uruchom raz w SQL Editorze; powtórka nie zdubluje wpisu.

insert into public.studios (created_by, status, verified, name, city, address, lat, lng, disciplines, activities, kids, description,
  instagram_url, facebook_url)
select u.id, 'approved', false, 'Flamingo Pole Dance Studio', 'Oława', 'ul. 3 Maja 2', 50.9464292, 17.2963110,
  array['pole', 'hoop']::text[], array[]::text[], false,
  'Studio pole dance w Oławie, około 26 km od Wrocławia. Organizuje też warsztaty z koła aerial z zaproszonymi instruktorkami.',
  'https://www.instagram.com/flamingo_pole_dance_studio/', 'https://www.facebook.com/FlamingoPoleDanceStudio/'
from auth.users u
where u.email = 'admin.aerialevents@cyrkarium.com'
  and not exists (select 1 from public.studios s where s.city = 'Oława' and s.name ilike 'Flamingo%');

-- warsztaty z Jadwigą Krowiak → profil studia
update public.events e
   set studio_id = s.id
  from public.studios s
 where s.city = 'Oława' and s.name ilike 'Flamingo%'
   and e.date_start = '2026-11-21' and e.title ilike '%Krowiak%';

-- kontrola
select s.name, s.address, (select count(*) from public.events e where e.studio_id = s.id) as wydarzenia
  from public.studios s where s.city = 'Oława';
