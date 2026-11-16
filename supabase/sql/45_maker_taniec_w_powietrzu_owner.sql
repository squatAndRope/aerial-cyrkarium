-- Taniec w Powietrzu (producent): przekazanie edycji Justynie Kozulskiej-Biesiadzie (prośba mailem)
-- Działa dopiero, gdy konto justynakozulska@gmail.com istnieje (zalogowała się choć raz). Wcześniej nic nie zmienia.
-- Profil dostaje oznaczenie „potwierdzony” (verified), bo prowadzi go sam producent.
-- Uruchom raz w SQL Editorze.

update public.makers
   set created_by = (select id from auth.users where lower(email) = 'justynakozulska@gmail.com'),
       verified = true
 where id = 'ec71dbc8-d38d-4a01-936d-cc52991792da'
   and exists (select 1 from auth.users where lower(email) = 'justynakozulska@gmail.com');

-- kontrola: przy wpisie powinien być jej adres (inny = jeszcze nie ma konta)
select m.name, m.verified, u.email as edytuje
  from public.makers m left join auth.users u on u.id = m.created_by
 where m.id = 'ec71dbc8-d38d-4a01-936d-cc52991792da';
