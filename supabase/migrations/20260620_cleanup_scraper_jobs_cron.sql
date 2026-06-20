-- Habilitar pg_cron se ainda não estiver ativo
create extension if not exists pg_cron schema pg_catalog;

-- Remover agendamento anterior se existir
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-scraper-jobs') then
    perform cron.unschedule('cleanup-scraper-jobs');
  end if;
end;
$$;

-- Agendar limpeza diária às 02:00 UTC — SQL direto (sem pg_net)
select cron.schedule(
  'cleanup-scraper-jobs',
  '0 2 * * *',
  $$
    delete from public.telegram_scraper_jobs
    where status in ('completed', 'failed', 'rejected')
    and created_at < now() - interval '30 days';
  $$
);
