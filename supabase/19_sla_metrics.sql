-- 19_sla_metrics.sql — indicadores operacionais (Sim/Não), manuais, fora do score.
-- Shape: { "first_contact": bool|null, "resolution": bool|null,
--          "reopen_15d": bool|null, "escalation": bool|null }
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS sla_metrics JSONB;
