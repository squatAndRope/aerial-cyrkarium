-- Prowadzący w obecnych wydarzeniach (wypisani z tytułów i opisów). Najpierw uruchom plik 50.
-- Sprawdź listę przed uruchomieniem; linie z „?” w komentarzu to moje domysły.
-- Bez prowadzących zostają: zawody, kursy bez nazwiska w opisie, zajęcia tylko z imieniem (Wiktoria),
-- NEW YEAR AERIAL MEETING (Kate i Jessica: dopisz nazwiska ręcznie w formularzu, jeśli chcesz).

update public.events set instructors = array['Agnieszka Kawałek']::text[] where id = '77ebb4f2-bad4-4bfb-b327-72802e4bd260';  -- Warsztaty z dynamiki z Agnieszką Kawałek vol. 2
update public.events set instructors = array['Dana Auguštin']::text[] where id = '957a2f30-0c5a-44ba-b4a0-c26b9eb12995';  -- Dana Auguštin - AERIAL SILKS
update public.events set instructors = array['Zuza Libera']::text[] where id = 'd750e2fe-4707-4d6f-8c81-016940e66774';  -- Sesja zdjęciowa jesienna - koło, szarfa, flying pole
update public.events set instructors = array['Zuza Libera']::text[] where id = 'ff59d66f-a232-4229-97a2-e39dbf7b8de8';  -- Halloweenowy Aerial Hoop z Zuzą - podstawa  -- ? w tytule tylko „z Zuzą”; Zuza Libera prowadzi w tym studiu sesję
update public.events set instructors = array['Zuza Libera']::text[] where id = '23313ea3-7461-4fa2-b292-5379d3d4d3d2';  -- Halloweenowy Aerial Hoop z Zuzą - średniozaawansowany  -- ? w tytule tylko „z Zuzą”; Zuza Libera prowadzi w tym studiu sesję
update public.events set instructors = array['Anastazja Cichanowska']::text[] where id = 'e5ffb113-1524-4487-83c3-f2352bb51e59';  -- Acro Tricki z Anastazja Cichanowska
update public.events set instructors = array['Nicolas Stocco']::text[] where id = '5b9c831c-8e27-4dd3-b885-d41e20c72370';  -- Nicolas Stocco - Aerial Hoop&Trapeze - Harmonic Motion
update public.events set instructors = array['Tzina Trikka']::text[] where id = 'c8054d93-3dc0-4305-9da8-d5f08eb96bc1';  -- Tzina Trikka - Hair Hanging
update public.events set instructors = array['Olena Hawran']::text[] where id = 'c3391d24-b8b3-42b8-b8ae-7f0d69559f41';  -- Warsztaty szarfowe z Oleną Hawran
update public.events set instructors = array['Emilia Lewicka']::text[] where id = '9142cbb8-9726-4ce3-91d2-75fd54380ffb';  -- Warsztaty Anatomia szpagatu w aerialu z Emilią Lewicką
update public.events set instructors = array['Asia Rudny']::text[] where id = '2f518ba9-97d0-45f0-b9fb-078b2e15cab7';  -- (nie)winny stretching z Asią
update public.events set instructors = array['Sara Kreis']::text[] where id = 'c46c5b4f-2b24-4255-9994-c8ee0cca47d5';  -- Warsztaty Aerial Hoop z Sarą Kreis
update public.events set instructors = array['Sara Kreis']::text[] where id = '214424dd-392e-4976-aa20-d99917f80f8f';  -- Warsztaty Aerial Hoop z Sarą Kreis
update public.events set instructors = array['Alberto Díaz']::text[] where id = '48232c83-3e4c-4151-a625-55f898246ddf';  -- Alberto Diaz - Aerial Trapeze / Aerial Straps / Acrodance
update public.events set instructors = array['Clara Larcher', 'Pritta Rajoy']::text[] where id = '2abafc61-683b-4320-94fc-5889eee5f895';  -- Dynamic Technique & Entangled Sequences - Rope & Silks
update public.events set instructors = array['Alina Sultanova']::text[] where id = '232574b0-82a9-489f-985a-f7c445dc19cb';  -- Aerial Camp - Create Your Own Act

-- kontrola
select title, instructors from public.events where cardinality(instructors) > 0 order by date_start;
