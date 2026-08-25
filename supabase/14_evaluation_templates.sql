-- 14_evaluation_templates.sql — formulário como dado (backlog #1)
CREATE TABLE IF NOT EXISTS evaluation_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,            -- ex: 'support-v1', 'support-v2'
  name       TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  is_active  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS template_criteria (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES evaluation_templates(id) ON DELETE CASCADE,
  criterion_key TEXT NOT NULL,                -- ex: 'E1', 'P2', 'AF_IDENTITY'
  block         TEXT,                         -- 'A'|'B'|'C' (null p/ auto-fail)
  block_label   TEXT,                         -- 'Effectiveness' etc.
  block_weight  NUMERIC(5,2),                 -- peso do bloco no score final (%)
  statement     TEXT NOT NULL,
  weight        NUMERIC(5,2) NOT NULL DEFAULT 0,  -- peso dentro do bloco (%)
  allows_na     BOOLEAN NOT NULL DEFAULT FALSE,
  is_auto_fail  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (template_id, criterion_key)
);

CREATE INDEX IF NOT EXISTS idx_template_criteria_template ON template_criteria(template_id);

-- só um template ativo por família (code sem sufixo de versão)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_template
  ON evaluation_templates ((split_part(code, '-v', 1)))
  WHERE is_active;

ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES evaluation_templates(id);
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS area TEXT
  CHECK (area IN ('MDM','TEM','Onboarding'));
CREATE INDEX IF NOT EXISTS idx_evaluations_template ON evaluations(template_id);
