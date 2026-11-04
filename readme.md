# Aerial · Fundacja Cyrkarium

Serwis o aerialu w Polsce pod adresem https://aerial.cyrkarium.com:
mapa studiów, kalendarz wydarzeń i (wkrótce) ogłoszenia.

## Stan

W budowie. Strona ma `noindex`, a `robots.txt` blokuje wyszukiwarki. Oba trzeba zmienić przy starcie.

## Pliki

- `index.html` – szkielet: nagłówek, zakładki Kalendarz / Studia / Ogłoszenia
- `styles.css` – wygląd (kolory i kroje jak w Aerial Events i na cyrkarium.com)
- `i18n.js` – teksty PL / EN, lista dyscyplin i poziomów
- `app.js` – logika: mapa, lista, profil studia, formularz, moje studia, moderacja
- `config.js` – publiczne ustawienia Supabase (ta sama baza co Aerial Events)
- `supabase/sql/12_studios.sql` – tabela studiów
- `supabase/sql/13_studios_seed.sql` – pierwsze studia (z publicznej mapy taniecwpowietrzu.pl, bez kontaktów)
- `supabase/sql/14_listings.sql` – ogłoszenia i wiadomości do autorów
- `supabase/functions/aerial-notify/` – maile: wiadomości do autorów ogłoszeń, kolejka moderacji

Podgląd bez bazy: dopisz `?demo=1` do adresu (przykładowe studia, nic się nie zapisuje).

## Baza

Ta sama baza Supabase co Aerial Events: te same konta, ta sama lista adminów.
Kalendarz czyta zatwierdzone wydarzenia z tabeli `events`. Studia są w tabeli `studios`.
W tabeli studiów nie ma e-maili ani telefonów, kontakt to linki do strony i profili studia.

Logowanie linkiem z e-maila wymaga, żeby `https://aerial.cyrkarium.com` był na liście
Supabase → Authentication → URL Configuration → Redirect URLs.

## Maile (funkcja aerial-notify)

Osobna funkcja od `notify` z Aerial Events, korzysta z tych samych sekretów
(`RESEND_API_KEY`, `WEBHOOK_SECRET`). Wywołują ją trzy Database Webhooki
(HTTP POST, nagłówek `x-webhook-secret`):

| Tabela | Zdarzenia | Co wysyła |
|---|---|---|
| `listing_messages` | Insert | wiadomość do autora ogłoszenia, reply-to nadawcy |
| `listings` | Insert, Update | nowe/poprawione do adminów, zatwierdzone/odrzucone do autora |
| `studios` | Insert, Update | nowe/poprawione studio do adminów |

## Wdrożenie

Hostinger wdraża automatycznie gałąź `main` (webhook z GitHuba), więc każdy push na `main`
od razu trafia na aerial.cyrkarium.com. Po zmianie w `styles.css`, `i18n.js` albo `app.js`
podbij `?v=` w `index.html`.
