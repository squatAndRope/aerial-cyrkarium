-- Vertykalna – Centrum Akrobatyczne, Wrocław (centrumakrobatyczne.pl + profil studia na Facebooku)
-- Trzy sale jako osobne pinezki (jak AKROline): Międzyleska 4 (hala główna), Nyska 61A (Vertykalna Kids, 3–7 lat),
-- Buforowa 4E (nowa sala, zapisy ogłoszone na FB 28.10). Bez telefonu i e-maila.
-- „Dodane przez społeczność” do czasu przejęcia przez studio. Uruchom raz; powtórka nie zdubluje wpisów.

insert into public.studios (created_by, status, verified, name, city, address, lat, lng, disciplines, activities, kids,
  description, website_url)
select u.id, 'approved', false, v.name, 'Wrocław', v.address, v.lat, v.lng, v.disciplines, v.activities, true,
  v.description, 'https://centrumakrobatyczne.pl/'
from auth.users u
cross join (values
  ('Vertykalna · Międzyleska', 'ul. Międzyleska 4, hala E', 51.0812762, 17.0675281,
   array['silks', 'hoop', 'hammock', 'trapeze']::text[], array['acro']::text[],
   'Centrum akrobatyczne Vertykalna: akrobatyka powietrzna (szarfy, koła, hamaki, trapez) i akrobatyka sportowa. Główna sala, zajęcia dla dzieci od 7–8 lat, młodzieży i dorosłych. Występy i pokazy. Inne sale: Nyska 61A (Vertykalna Kids) i Buforowa 4E.'),
  ('Vertykalna Kids · Nyska', 'ul. Nyska 61A', 51.0861409, 17.0518985,
   array['silks', 'hoop', 'hammock', 'trapeze']::text[], array['acro']::text[],
   'Vertykalna Kids: zajęcia dla najmłodszych (3–7 lat) – Aerial Kids (szarfy, hamaki, koła, trapezy), Acro Kids i Fun Kids. W soboty opieka nad dziećmi. Główna sala: Międzyleska 4.'),
  ('Vertykalna · Buforowa', 'ul. Buforowa 4E', 51.0687563, 17.0627644,
   array['silks']::text[], array['acro', 'pilates', 'dance']::text[],
   'Nowa sala Vertykalnej na Jagodnie: szarfy dla dzieci i dorosłych, akrobatyka (dzieci i dorośli), pilates i taniec współczesny. Pozostałe sale: Międzyleska 4 i Nyska 61A.')
) as v(name, address, lat, lng, disciplines, activities, description)
where u.email = 'admin.aerialevents@cyrkarium.com'
  and not exists (select 1 from public.studios s where s.city = 'Wrocław' and s.name = v.name);

select name, address, disciplines, activities from public.studios where city = 'Wrocław' and name ilike 'Vertykalna%';
