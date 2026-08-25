-- 15_na_and_flags.sql — N/A nos itens + auto-fail flag + block_scores
ALTER TABLE evaluation_items ADD COLUMN IF NOT EXISTS is_na BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE evaluation_items ALTER COLUMN value DROP NOT NULL;
ALTER TABLE evaluation_items DROP CONSTRAINT IF EXISTS evaluation_items_value_check;
-- NOTA: um CHECK em Postgres só rejeita quando o predicado é FALSE (NULL passa).
-- Por isso o ramo não-N/A precisa de `value IS NOT NULL` explícito — senão
-- (is_na=false, value=NULL) avaliaria para NULL e passaria indevidamente.
ALTER TABLE evaluation_items ADD CONSTRAINT evaluation_items_value_check
  CHECK (
    (is_na AND value IS NULL)
    OR (NOT is_na AND value IS NOT NULL AND value BETWEEN 1 AND 5)
  );

ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS has_critical_flag BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS block_scores JSONB;
