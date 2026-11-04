-- =====================================================================
-- Aerial · automatyczne sprzątanie (zgodnie z polityką prywatności)
--
-- Codziennie o 3:15 (czas UTC):
--   • wiadomości do autorów ogłoszeń starsze niż 90 dni
--   • ogłoszenia zamknięte / odrzucone / wygasłe ponad 90 dni temu
--
-- Najpierw włącz Cron: Integrations → Cron → Enable (instaluje pg_cron).
-- Potem uruchom ten skrypt w SQL Editorze. Można go uruchomić ponownie:
-- zadanie o tej samej nazwie zostanie nadpisane, a nie zdublowane.
-- =====================================================================

create extension if not exists pg_cron;

select cron.schedule(
  'aerial-cleanup',
  '15 3 * * *',
  $job$
    delete from public.listing_messages
      where created_at < now() - interval '90 days';
    delete from public.listings
      where (status in ('closed', 'rejected') and updated_at < now() - interval '90 days')
         or expires_at < now() - interval '90 days';
  $job$
);

-- kontrola: powinno pokazać zadanie aerial-cleanup
select jobname, schedule, active from cron.job where jobname = 'aerial-cleanup';
