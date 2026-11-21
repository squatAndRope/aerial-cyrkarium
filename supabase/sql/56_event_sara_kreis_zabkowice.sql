-- Warsztaty Aerial Hoop z Sarą Kreis, Ząbkowice Śląskie, 16.01.2027: wpis już jest, poprawki
-- • opis bez numeru telefonu (nie pokazujemy kontaktów), z godzinami z wydarzenia na Facebooku
-- • link zapisów: zamiast wyszukiwania na Facebooku Instagram studia (podmień na link wydarzenia, jeśli go masz)
-- • przypięcie do profilu studia Słowianka, adres sali
-- Uruchom raz w SQL Editorze.

update public.events e
   set studio_id = s.id,
       title = 'Warsztaty Aerial Hoop z Mistrzynią Świata Sarą Kreis',
       organizer = 'SŁOWIANKA Studio Pole Dance i Beti Hadej',
       venue = 'SŁOWIANKA Studio Pole Dance, pl. Marii Skłodowskiej-Curie 1',
       lat = s.lat, lng = s.lng,
       reg_url = 'https://www.instagram.com/slowianka.studio.poledance/',
       description = 'Warsztaty na kole aerial z mistrzynią świata Sarą Kreis w studiu Słowianka w Ząbkowicach Śląskich. Sobota, 10:00–18:00. Studio zaprasza wszystkich pasjonatów aerial hoop. Szczegóły i zapisy u organizatorów (wydarzenie na Facebooku studia).'
  from public.studios s
 where e.id = 'c46c5b4f-2b24-4255-9994-c8ee0cca47d5'
   and s.id = '74b63b71-2616-4fe2-b74d-7a1b2405dd5b';

select title, date_start, venue, organizer, reg_url, studio_id, instructors from public.events where id = 'c46c5b4f-2b24-4255-9994-c8ee0cca47d5';
