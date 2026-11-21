-- PTAK'27: wydarzenie już jest w kalendarzu (z listy PFA), tylko z jednym zdaniem opisu.
-- Uzupełnienie z wydarzenia na Facebooku: pełna nazwa, organizatorzy, opis, rejestracja od 1.01.2027.
-- Uruchom raz w SQL Editorze.

update public.events
   set title = 'PTAK''27 · Przegląd Tańca Akrobatycznego w Powietrzu',
       reg_url = 'https://www.facebook.com/events/3113450335527785/',
       organizer = 'PTAK Poznań · Polska Federacja Aerialu · KS Akro Fly',
       description = 'Szósta edycja Przeglądu Tańca Akrobatycznego w Powietrzu w Poznaniu: ostatnie kwalifikacje przed Mistrzostwami Polski PFA w sezonie 2026/27, z nowym systemem sędziowskim PFA.

Oprócz kwalifikacji jest Otwarta Scena dla pasjonatów akrobatyki powietrznej.

Rejestracja od 1 stycznia 2027. Regulamin i system oceniania: aerialpolska.pl.'
 where id = '935f71c8-cfb9-4dfe-8b0d-cf445095f8c3';

select title, date_start, date_end, organizer, reg_url from public.events where id = '935f71c8-cfb9-4dfe-8b0d-cf445095f8c3';
