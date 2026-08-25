-- 18_e1_statement.sql — E1 (v2) muda de FCR para resolução em 24h corridas.
-- Consequência: quebra a série histórica do E1 (era "primeiro contato").
-- criterion_key mantido = 'E1'; a definição muda no corte do v2.
UPDATE template_criteria
SET statement = 'Resolvido em até 24h corridas, sem transferência e sem segunda coleta de dados?'
WHERE criterion_key = 'E1'
  AND template_id = (SELECT id FROM evaluation_templates WHERE code = 'support-v2');
