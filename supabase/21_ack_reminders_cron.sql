-- 21_ack_reminders_cron.sql — agenda o job de cobrança de ciência (Wave #6).
-- Roda todo dia às 12:00 UTC (~09:00 BRT) e chama a edge function ack-reminders
-- via pg_net. A function é idempotente (janela de 2 dias úteis), então rodar
-- diariamente não gera spam. Nasce dormente: só age em avaliações de set/2026+.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- cron.schedule é upsert por nome (pg_cron >= 1.4): reaplicar apenas atualiza.
SELECT cron.schedule(
  'ack-reminders-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gyktdmahkifnsrbaxodl.supabase.co/functions/v1/ack-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5a3RkbWFoa2lmbnNyYmF4b2RsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1OTE2MDUsImV4cCI6MjA4NDE2NzYwNX0.vBr2rA-0MuE3nUg1NMhq2zsX9W-xhhJiOhnVY1aaSCA'
    ),
    body := '{}'::jsonb
  );
  $$
);
