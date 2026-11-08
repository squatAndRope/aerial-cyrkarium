-- =====================================================================
-- Aerial · studia z mapy Taniec w Powietrzu (62 wpisów, 8.11.2026)
--
-- Źródło: https://taniecwpowietrzu.pl/mapa-aerial-polska,p18.html
-- (Google My Maps, eksport KML), za zgodą autorki mapy.
-- Przeniesione: nazwa, miasto, adres sali, rodzaj zajęć (jako opis) i linki.
-- Pominięte: e-maile i telefony z mapy, wydarzenia, lekcje prywatnych osób,
-- duplikaty oraz studia, które już są w bazie.
-- Pinezki: 44 według adresu, reszta w centrum miasta (OpenStreetMap / Nominatim).
--
-- Wpisy są od razu zatwierdzone, z oznaczeniem „Dodane przez społeczność”
-- i źródłem w profilu. Studio może przejąć i poprawić swój profil.
--
-- Uruchom w SQL Editorze PO 21_studio_source.sql. Ponowne uruchomienie
-- nie zdubluje wpisów (sprawdza nazwę, miasto i adres).
-- =====================================================================

with admin as (
  select id from auth.users where email = 'admin.aerialevents@cyrkarium.com'
),
rows (name, city, address, lat, lng, disciplines, kids, description, website_url, instagram_url, facebook_url) as (
  values
  ('North Pole Dance Studio', 'Białystok', 'ul. Dąbrowskiego 22', 53.136412, 23.143464, array['hoop', 'hammock', 'pole']::text[], true, 'Aerial hoop, pole dance, hamaki/Aerial yoga dla dzieci i dorosłych zarówno w formie grupowej (maks 9-6 osób), jak i indywidualnej', 'https://northpolebialystok.pl/', null, 'https://www.facebook.com/profile.php?id=100071832259451'),
  ('Centrum Działań Twórczych "Kuźnia"', 'Bielany Wrocławskie', null, 51.039289, 16.968678, array['silks', 'hammock']::text[], false, 'Hamaki, Szarfy', 'https://www.cdtkuznia.pl', null, 'https://www.facebook.com/cdtkuznia'),
  ('Pilates/Joga Padula-Wielgus Katarzyna', 'Bogatynia', null, 50.907715, 14.953919, array['hammock']::text[], true, 'Aerial joga dla dzieci i dorosłych', 'https://ekokawiarniabogatynia.com', null, null),
  ('Fundacja Open Art', 'Brzeg Dolny', null, 51.269121, 16.70814, array['hoop', 'hammock']::text[], false, 'Hammock oraz hoop', 'https://gimnastykaopenart.pl', null, 'https://www.facebook.com/gimnastykaopenart'),
  ('PowerStudio', 'Chrzanów', 'ul. Trzebińska60', 50.141193, 19.40285, array['silks', 'hoop']::text[], false, 'Aerial Silk, Aerial Hoop', 'https://powerstudio.pl/', null, 'https://www.facebook.com/powerstudio.chrzanow/'),
  ('Krakowska Sekcja Akrobatyki Powietrznej', 'Dobczyce', 'ul. Szkolna 43', 49.87977, 20.10091, array['other']::text[], false, null, 'https://zapisy.activenow.pl/krakowska-sekcja-akrobatyki-powietrznej/', null, 'https://www.facebook.com/krkSAP'),
  ('Gdańskie Studio Akrobatyki Powietrznej Blue Sky', 'Gdańsk', 'Leona Droszyńskiego 15g', 54.408731, 18.574087, array['silks', 'hoop']::text[], false, 'Aerial Silk Aerial Hoop', null, null, 'https://www.facebook.com/GdanskieStudioAkrobatykiPowietrznejBLUESKY'),
  ('Skypole Dance Studio', 'Gdańsk', null, 54.428803, 18.798327, array['silks', 'hoop', 'pole']::text[], false, 'Aerial Hoop , Aeria Silk', 'https://skypolegdansk.pl/', null, 'https://www.facebook.com/SkypoleGdansk'),
  ('Klub Sportowy Akademia Tańca i Baletu FRU', 'Gorzów Wielkopolski', 'Sikorskiego 111', 52.730232, 15.233861, array['silks', 'hoop']::text[], false, 'Aerial Silks, Aerial Hoop', null, null, 'https://www.facebook.com/akademiabaletufru/'),
  ('Explozja Tańca', 'Jastrzębie-Zdrój', 'ul. Opolska 1a', 49.953872, 18.594336, array['silks', 'hammock']::text[], false, 'Aerial Yoga, Akrobatyka na szarfie', 'https://explozjatanca.com/', null, 'https://www.facebook.com/explozja.tanca'),
  ('PURA Yoga Studio', 'Katowice', null, 50.213732, 19.005885, array['hammock']::text[], false, 'Aerial Yoga , Yin Aerial Yoga', 'https://www.purayogastudio.pl', null, 'https://www.facebook.com/purayogastudio'),
  ('Stowarzyszenie "Royal Academy"', 'Kobyłka', 'Jana Pawła II 22', 52.337595, 21.208844, array['silks', 'hoop', 'hammock']::text[], false, 'silks, hammocks, hoops', null, null, 'https://www.facebook.com/royalacademycentumgimnastyki'),
  ('My Gymnastics', 'Koszalin', 'Bohaterów Warszawy 22', 54.188462, 16.156084, array['silks', 'hoop', 'hammock']::text[], false, 'Koła, szarfy, hamaki, sześcian, sfera, siatki', 'https://www.mygymnasticskoszalin.com/', null, null),
  ('Przystań', 'Kołobrzeg', 'Szyprów 1', 54.176709, 15.558004, array['hammock']::text[], false, 'Aerial Joga', null, null, 'https://www.facebook.com/przystandlakazdego'),
  ('AcroPark', 'Kraków', 'Balicka 100', 50.079364, 19.868439, array['silks']::text[], false, 'Aerial Silks', 'https://balicka.acropark.pl/', null, 'https://www.facebook.com/share/1DLBY4BseD/'),
  ('Akademia Meli-Melo', 'Kraków', 'Siemiradzkiego 17/1', 50.068809, 19.928168, array['hammock']::text[], false, 'Aerial joga, Aerial Revital, Aerial Zdrowy Kręgosłup, Aerial Chill, Aerial Flow', 'https://meli-melo.pl/', null, 'https://www.facebook.com/MeliMeloKrakow/'),
  ('Laboratorium Umysłu i Ciała', 'Kraków', 'ul. Kamienna 2-4', 50.077457, 19.944907, array['hoop', 'hammock']::text[], false, 'Aerial joga, aerial hoop', null, null, 'https://www.facebook.com/LaboratoriumUmysluCiala/'),
  ('DanceArt Szkoła Tańca', 'Krzeszowice', 'ul. Floriana 1', 50.132638, 19.636907, array['silks', 'hoop', 'hammock']::text[], false, 'aerial silk, hamaki, aerial hoop', null, null, 'https://www.facebook.com/danceartszkolatanca/'),
  ('Strefa Tańca Aerial Natural Dance', 'Lidzbark Warmiński', 'ul. Poniatowskiego 18', 54.127309, 20.568818, array['silks', 'hoop', 'hammock']::text[], false, 'Aerial joga, Aerial Hoop, Aerial Dance Hamaki', 'https://naturaldance.pl/', null, 'https://www.facebook.com/strefatanca.naturaldance'),
  ('Bądź Pełnią - Beata Pniewska w Przestrzeni Dobra', 'Lublin', 'ul. Juranda 7', 51.238531, 22.520532, array['hammock']::text[], false, 'aerial joga', null, null, 'https://www.facebook.com/przestrzendobra.in/'),
  ('Fundacja Sztukmistrze', 'Lublin', null, 51.250559, 22.570102, array['silks', 'hoop', 'hammock', 'trapeze']::text[], true, 'Szarfy dla dzieci 7-9 i młodzieży 10-15, szarfy dla dorosłych, trapez dla dorosłych, koło dla dorosłych, szarfy z elemenatami aerial jogi dla dorosłych', 'https://sztukmistrze.pl', null, 'https://www.facebook.com/fundacjasztukmistrze/'),
  ('Strefa Wysokich Lotów Lublin', 'Lublin', 'u. Cisowa 11', 51.251151, 22.511936, array['silks', 'hoop']::text[], false, 'Prowadzimy zajęcia Aerial Silks oraz Aerial Hoop, w naszej ofercie mamy również zajęcia z Acroyogi.', 'https://strefawysokichlotow.pl/lublin/', null, 'https://www.facebook.com/StrefaWysokichLotowPL/'),
  ('Studio Yogi & Mindfulness Harmonia', 'Lublin', 'ul. Kasztelańska 29', 51.269028, 22.519188, array['silks', 'hammock']::text[], false, 'Aerial joga i aerial silk', 'https://wharmoniizjoga.pl/', null, 'https://www.facebook.com/share/14pFYYvBQp/'),
  ('Aerialove Akrobatyka Powietrzna (Nela Sienica)', 'Milicz', null, 51.531996, 17.275249, array['silks']::text[], true, 'Zajęcia z szarf akrobatycznych dla dzieci i dorosłych.', null, 'https://www.instagram.com/szarfy.milicz', 'https://www.facebook.com/share/XYzTjSXbrDjiwTBr/'),
  ('AGA - Akademia Genialnych Artystów', 'Namysłów', 'ul. Krakowska 7-9', 51.07673, 17.719248, array['silks', 'hoop']::text[], false, 'aerial hoop, aerial silks', null, null, 'https://www.facebook.com/AGAnamyslow'),
  ('Gravity Aerial Yoga', 'Ostróda', null, 53.702853, 19.962303, array['hammock']::text[], false, 'Aerial joga, akrobatyka', null, null, 'https://www.facebook.com/aerial.gravity/'),
  ('Czuła Joga Pabianice', 'Pabianice', 'ul. Łaska 3/5', 51.664882, 19.335954, array['silks', 'hoop', 'hammock']::text[], false, 'Aerial Hoop I Aerial Silk', null, null, 'https://www.facebook.com/czulajogapabianice'),
  ('Dream Team Pabianice', 'Pabianice', 'ul Traugutta 9', 51.667774, 19.352328, array['silks', 'hoop']::text[], false, 'Aerial Silks, Aerial Hoop', 'https://dreamteam-pabianice.pl/', null, 'https://www.facebook.com/pabianicedreamteam/'),
  ('Fitness For Ladies', 'Piaseczno', 'ul. Wschodnia 2', 52.069173, 21.028159, array['silks', 'hammock']::text[], true, 'AerialJoga, AerialSilk, SexyAerial, AerialKids', 'https://fitnessforladies.pl/', null, 'https://www.facebook.com/FitnessForLadiesPiaseczno/'),
  ('Krakowska Sekcja Akrobatyki Powietrznej', 'Podłęże', 'ul. Podłęże 220', 50.018977, 19.558221, array['other']::text[], false, null, 'https://zapisy.activenow.pl/krakowska-sekcja-akrobatyki-powietrznej/', null, 'https://www.facebook.com/krkSAP'),
  ('Studio21', 'Poraj', 'Piłsudskiego 21', 50.679788, 19.209556, array['silks', 'hoop']::text[], false, 'Aerial hoop I aerial silks', null, null, 'https://www.facebook.com/share/1ChbJew3DJ/'),
  ('AZ Dance Company', 'Poznań', 'ul. Bobrownicka 40', 52.366102, 17.038641, array['silks']::text[], true, 'Aerial Silks dla dzieci od 6 lat - 16 lat', 'https://www.azcompany.pl', null, 'https://www.facebook.com/AZCompany'),
  ('AZ Dance Company - filia Starołęka', 'Poznań', 'ul. Romana Maya 1', 52.3757, 16.942395, array['silks']::text[], false, 'Aerial Silks, Akrobatyka, Taniec i inne', 'https://www.azcompany.pl', null, 'https://www.facebook.com/AZCompany'),
  ('Klub Sportowy AKRO FLY', 'Poznań', 'Druskienicka 32', 52.450219, 16.889083, array['silks', 'hoop']::text[], false, 'szarfa, koło', 'https://fly-up.pl', null, 'https://www.facebook.com/ksakrofly'),
  ('Skypole Dance Studio Pruszcz Gdański', 'Pruszcz Gdański', 'Raciborskiego 1a', 54.264514, 18.632895, array['silks', 'hoop', 'pole']::text[], false, 'Aerial Hoop i Aerial Silk dla dzeci', 'https://skypolegdansk.pl/', null, 'https://www.facebook.com/profile.php?id=100090535883235'),
  ('Skypole Aeril Studio', 'Pszczółki', null, 51.42247, 19.10207, array['silks', 'hoop']::text[], false, 'aerial silk , aerial hoop', 'https://www.skypolegdansk.pl', null, 'https://www.facebook.com/profile.php?id=61578225908780'),
  ('Klub Sportowy SUPERNOVA', 'Puławy', 'Pisłudskiego 56', 51.42626, 21.985301, array['silks', 'hoop']::text[], false, 'Aerial Silks, Aerial Hoop', null, null, 'https://www.facebook.com/supernovapulawy'),
  ('Normobaria Eden', 'Radziejowice', 'Budy Mszczonowskie, Grzybowa 6', 51.997653, 20.514902, array['hammock']::text[], false, 'aerial joga', 'https://www.normobariaeden.pl/', null, 'https://www.facebook.com/normobariaeden/'),
  ('Szkoła Pole Dance Rumia', 'Rumia', 'ul.Chełmińska 8', 54.577698, 18.405432, array['silks', 'hoop', 'hammock', 'pole']::text[], false, 'Aerial Silks - Aerial Yoga - Aerial Hoop', 'https://www.poledancerumia.pl', null, 'https://facebook.com/poledancerumia'),
  ('Krakowska Sekcja Akrobatyki Powietrznej', 'Rząska', 'ul. Krakowska 122', 50.099477, 19.837007, array['other']::text[], false, null, 'https://zapisy.activenow.pl/krakowska-sekcja-akrobatyki-powietrznej/', null, 'https://www.facebook.com/krkSAP'),
  ('White Swan Studio Tańca i Akrobatyki Powietrznej', 'Siechnice', 'ul. Ciepłownicza 24E/1', 51.02628, 17.155137, array['other']::text[], false, null, 'https://www.studiotancastc.pl/', null, 'https://www.facebook.com/studiotancawhiteswan'),
  ('Przestrzeń Lotu', 'Starachowice', null, 51.038457, 21.082084, array['silks', 'hoop']::text[], false, 'Zajęcia na szarfach i kołach', null, null, null),
  ('Klub sportowy Art- Akrobatyka Powietrzna Strzelce Kraj', 'Strzelce-Kraj', null, 52.802497, 15.459075, array['hoop']::text[], false, 'Arial hoop, aerial skills, akrobatyka', null, null, 'https://www.facebook.com/klubsportowyart/'),
  ('Akademia Tańca Wertykalnego', 'Swarzędz', null, 52.410373, 17.077104, array['silks', 'hammock']::text[], false, 'Taniec na szarfie, taniec w hamaku, taniec na kole, antygrawitacyjne rozciąganie', 'https://www.atw.edu.pl', null, 'https://www.facebook.com/akademiatancawertykalnego/'),
  ('Mandala', 'Toruń', 'ul.Warszawska 18/2', 53.011582, 18.616383, array['hammock']::text[], false, 'Aerial joga łagodna i zaawansowana', 'https://mandalatorun.pl', null, 'https://www.facebook.com/mandalatorun/'),
  ('NashiArt', 'Warszawa', null, 52.233374, 21.071149, array['other']::text[], false, 'Zajęcia prywatne.', 'https://nashiart.com/', null, 'https://www.facebook.com/nashiart/'),
  ('Not Another Yoga Studio', 'Warszawa', 'Postępu 17b', 52.181149, 20.994992, array['hammock']::text[], false, 'aerial yoga, aerial yoga regeneracyjna', 'https://nays-yoga.pl', null, 'https://www.facebook.com/NAYS.Warszawa'),
  ('Rachel Active Planet', 'Warszawa', null, 52.233374, 21.071149, array['hammock']::text[], true, 'AIR JOGA, AIR&CHILL STRETCHING, AIR JOGA STRETCH&MOBILITY, AERIAL STRETCHING, AERIAL KIDS, LOW FLYING, AERIAL FLOW', 'https://rapactive.pl/', null, 'https://www.facebook.com/profile.php?id=61550341440606'),
  ('Studio Jogi Rilass', 'Warszawa', 'ul. Lirowa 26 lok. U9 02-387', 52.201094, 20.963102, array['hammock']::text[], false, 'Aerial joga', 'https://jogarilass.pl/', null, 'https://www.facebook.com/jogarilasstudio/'),
  ('ZuZu SPOT', 'Warszawa', 'Ostródzka 175', 52.327182, 21.04678, array['silks', 'hoop']::text[], false, 'Aerial silks, aerial hoop', 'https://app.fitssey.com/ZuZuSPOT/backoffice.v4/schedule', null, 'https://www.facebook.com/profile.php?id=61576938216381'),
  ('Naluno Fitness - Natalia Nowak', 'Wolsztyn', 'Niałek Wielki 136A, 64-200', 52.114556, 16.084921, array['silks', 'hammock']::text[], true, 'Zajęcia w hamakach: Aerial Fitness, Aerial Low/Aerial Stretching (na jednopunkcie), Aerial Joga/Aerial Pilates, Aerial Dance oraz Aerial Joga Restorative (na dwupunkcie). Dodatkowo: Aerial Kids/Teens (podwieszenia mieszane)', null, null, 'https://www.facebook.com/nalunonn'),
  ('Aerial Life Art studio', 'Wrocław', 'Bałtycka 15/1 , 51-109', 51.137701, 17.029987, array['hammock']::text[], true, 'Aerial joga dla dzieci i dorosłych', null, null, 'https://www.facebook.com/profile.php?id=100089645718849'),
  ('Aerial Paradise', 'Wrocław', 'Kazimierza Funka 11', 51.156008, 17.038591, array['silks', 'hoop']::text[], false, 'Koła i szarfy', null, null, 'https://www.facebook.com/share/18Jn2KhLer/'),
  ('Akrosmyk', 'Wrocław', 'ul. Krzywoustego 82', 51.139272, 17.07927, array['silks', 'hoop']::text[], false, 'Szarfa, Koło', 'https://www.akrobatyka-wroc.pl/akro/', null, 'https://www.facebook.com/akrogym'),
  ('Sekcja Akrobatyki Powietrznej', 'Wrocław', null, 51.126311, 16.978196, array['silks', 'hoop']::text[], true, 'Akrobatyka powietrzna na szarfach i kołach cyrkowych dla dzieci, młodzieży i dorosłych', null, null, 'https://www.facebook.com/Sekcja-Akrobatyki-Powietrznej-2337956736524623/'),
  ('White Swan Studio Tańca i Akrobatyki Powietrznej', 'Wrocław', 'ul. Kiełczowska 191/9', 51.145532, 17.138872, array['silks', 'hoop', 'hammock']::text[], false, 'Aerial Joga, akrobatyka na szarfach, akrobatyka na kołach, akrobatyka w hamakach, akrobatyka mini', 'https://www.studiotancastc.pl/', null, 'https://www.facebook.com/studiotancawhiteswan'),
  ('Klub Sportowy "Erka"', 'Zamość', 'ul. Lipska 63', 50.704406, 23.256612, array['silks']::text[], false, 'Akrobatyka powietrzna na szarfie', null, null, 'https://www.facebook.com/Klub-Sportowy-Erka-1060440850705042/'),
  ('Cyrkus', 'Zgorzelec', null, 51.151787, 15.014433, array['silks']::text[], false, 'akrobatyka powietrzna na chustach', 'https://cyrkus.eu/pl/stowarzyszenie/', null, 'https://www.facebook.com/search/top'),
  ('Fundacja Rozwoju Człowieka TROOD', 'Złotoryja', 'ul. Legnicka 54B', 51.133564, 15.942917, array['other']::text[], false, 'Akrobatyka powietrzna', 'https://trood.pl', null, 'https://www.facebook.com/FundacjaTrood'),
  ('Krakowska Sekcja Akrobatyki Powietrznej', 'Łapczyca', 'ul. Łapczyca 334', 49.963086, 20.375325, array['other']::text[], false, null, 'https://zapisy.activenow.pl/krakowska-sekcja-akrobatyki-powietrznej/', null, 'https://www.facebook.com/krkSAP'),
  ('Taniec w Powietrzu - Scena', 'Łódź', 'Pabianicka 119/131', 51.719492, 19.437523, array['silks', 'hoop', 'hammock', 'straps']::text[], false, 'aerial silks, aerial hoop, aerial straps, aerial joga, aerial harness, acro, stretching i inne', 'https://taniecwpowietrzu.pl/sala-do-aerial-i-tanca-ze-scena-wynajem-na-warsztaty-i-sesje-lodz,p49.html', null, 'https://www.facebook.com/sklep.taniec.w.powietrzu'),
  ('Studio yogi & mindfulness Harmonia', 'Świdnik', 'ul. Piłsudskiego 43', 51.219583, 22.690113, array['hammock']::text[], true, 'Aerial joga dla dorosłych i dla dzieci', 'https://www.wharmoniizjoga.pl', null, 'https://www.facebook.com/profile.php?id=61558310108264')
)
insert into public.studios
  (created_by, status, verified, name, city, address, lat, lng, disciplines, kids, description,
   website_url, instagram_url, facebook_url, source_name, source_url)
select a.id, 'approved', false, r.name, r.city, r.address, r.lat, r.lng, r.disciplines, r.kids, r.description,
       r.website_url, r.instagram_url, r.facebook_url,
       'mapa Taniec w Powietrzu', 'https://taniecwpowietrzu.pl/mapa-aerial-polska,p18.html'
from rows r cross join admin a
where not exists (
  select 1 from public.studios s
  where lower(s.name) = lower(r.name) and lower(s.city) = lower(r.city)
    and coalesce(lower(s.address), '') = coalesce(lower(r.address), '')
);

-- kontrola: ile studiów jest teraz na mapie
select count(*) filter (where status = 'approved') as na_mapie, count(*) as wszystkie from public.studios;
