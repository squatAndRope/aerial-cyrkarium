-- AKROline Studio: przekazanie edycji obu sal właścicielce
-- Działa dopiero, gdy właścicielka choć raz zaloguje się na aerial.cyrkarium.com
-- adresem akrolinestudio@gmail.com (Moje wpisy → link z maila). Wcześniej nic nie zmienia.
-- Uruchom w SQL Editorze po jej pierwszym logowaniu.

update public.studios
   set created_by = (select id from auth.users where lower(email) = 'akrolinestudio@gmail.com')
 where name in ('AKROline Studio · KolekTYw', 'AKROline Studio · Movement Arena')
   and exists (select 1 from auth.users where lower(email) = 'akrolinestudio@gmail.com');

-- kontrola: przy obu salach powinien być adres właścicielki (pusto = jeszcze się nie zalogowała)
select s.name, u.email as edytuje
  from public.studios s left join auth.users u on u.id = s.created_by
 where s.name like 'AKROline%';
