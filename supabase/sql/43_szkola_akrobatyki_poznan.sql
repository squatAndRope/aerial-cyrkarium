-- Szkoła Akrobatyki, Poznań (@akroszkola): aktualny adres i opis ze strony szkolaakrobatyki.pl
-- Wpis był już na mapie (z importu), ale ze starym adresem (ul. Maltańska 1) i jednym zdaniem opisu.
-- Uruchom raz w SQL Editorze.

update public.studios
   set address = 'ul. Bolesława Krzywoustego 72 (Cinema City Kinepolis)',
       lat = 52.3735161, lng = 16.9806651,
       disciplines = array['silks', 'hoop']::text[],
       activities = array['acro']::text[],
       kids = true,
       instagram_url = 'https://www.instagram.com/akroszkola/',
       description = 'Szkoła akrobatyki sportowej i powietrznej dla dzieci i młodzieży, założona przez Tomasza Rodaka, twórcę Teatru „Z Głową w Chmurach”. Trzy sale w Kinepolis z profesjonalnym sprzętem: szarfa wertykalna, koło cyrkowe oraz akrobatyka sportowa (ścieżka, trampolina). Są też treningi indywidualne i półkolonie. Druga lokalizacja: AkroSPOT, ul. Węglowa 1 (Górczyn).'
 where id = '625af346-020c-4507-8188-166e55124374';

select name, address, disciplines, activities, instagram_url from public.studios where id = '625af346-020c-4507-8188-166e55124374';
