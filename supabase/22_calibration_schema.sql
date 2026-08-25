-- 22_calibration_schema.sql — Wave #7: modo calibração.
-- Tabelas SEPARADAS de `evaluations` (isolamento por construção: nenhuma query
-- de analista enxerga calibração). Mesmo ticket, 2+ avaliadores, cego até todos
-- enviarem, score separado, não afeta o analista. Pode referenciar o analista
-- do ticket só como contexto.

CREATE TABLE IF NOT EXISTS calibration_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id      TEXT NOT NULL,
  ticket_subject TEXT,
  analyst_id     UUID REFERENCES users(id),          -- contexto, opcional
  template_id    UUID NOT NULL REFERENCES evaluation_templates(id),
  created_by     UUID NOT NULL REFERENCES users(id),
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  closed_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS calibration_participants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES calibration_sessions(id) ON DELETE CASCADE,
  evaluator_id      UUID NOT NULL REFERENCES users(id),
  submitted         BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at      TIMESTAMPTZ,
  final_score       NUMERIC(5,2),
  block_scores      JSONB,
  has_critical_flag BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (session_id, evaluator_id)
);

CREATE TABLE IF NOT EXISTS calibration_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES calibration_participants(id) ON DELETE CASCADE,
  criterion_key  TEXT NOT NULL,
  value          INTEGER,
  is_na          BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT calibration_items_value_check
    CHECK ((is_na AND value IS NULL) OR (NOT is_na AND value IS NOT NULL AND value BETWEEN 1 AND 5))
);

CREATE INDEX IF NOT EXISTS idx_calib_participants_session ON calibration_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_calib_items_participant ON calibration_items(participant_id);

-- Auto-fechamento: quando o último participante envia, a sessão fecha e revela.
CREATE OR REPLACE FUNCTION close_calibration_if_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.submitted THEN
    IF NOT EXISTS (
      SELECT 1 FROM calibration_participants
      WHERE session_id = NEW.session_id AND submitted = FALSE
    ) THEN
      UPDATE calibration_sessions
      SET status = 'closed', closed_at = NOW()
      WHERE id = NEW.session_id AND status <> 'closed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_calibration ON calibration_participants;
CREATE TRIGGER trg_close_calibration
  AFTER INSERT OR UPDATE OF submitted ON calibration_participants
  FOR EACH ROW EXECUTE FUNCTION close_calibration_if_complete();
