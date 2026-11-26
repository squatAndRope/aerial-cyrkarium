-- Usunięcie wpisów testowych Cyrkomnień (21.11.2026): „TEST Claude”, „bypass test — ignore” i testowy wpis Klaudii.
-- Zdjęcie z wpisu „TEST Claude” zostanie w pojemniku bez wpisu; panel admina usunie je sam przy następnym otwarciu
-- zakładki Cyrkomnienia (po upływie doby). Uruchom raz w SQL Editorze.

delete from public.memories
 where content in (
   'To jest wpis testowy, sprawdzam formularz Cyrkomnień. Usuń go w panelu admina.',
   'bypass test — ignore',
   'testsabdsabdchkbsadcbsahbdchjkasdc'
 );

select count(*) as zostalo from public.memories;
