-- 20_ack_reminder_tracking.sql — controle anti-spam do job de cobrança de ciência.
-- Marca quando o último lembrete foi enviado; a edge function ack-reminders só
-- reenvia após >= 2 dias úteis (Wave #6).
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS last_ack_reminder_at TIMESTAMPTZ;
