-- Flamingo Pole Dance Studio (Oława): Instagram i Facebook (plik 53 był już uruchomiony bez linków)
update public.studios
   set instagram_url = 'https://www.instagram.com/flamingo_pole_dance_studio/',
       facebook_url  = 'https://www.facebook.com/FlamingoPoleDanceStudio/'
 where city = 'Oława' and name = 'Flamingo Pole Dance Studio';

select name, instagram_url, facebook_url, (select count(*) from public.events e where e.studio_id = s.id) as wydarzenia
  from public.studios s where city = 'Oława' and name = 'Flamingo Pole Dance Studio';
