-- 23_calibration_rls.sql — RLS do modo calibração (Wave #7).
-- Regra do "cego": o avaliador vê só a própria participação/itens enquanto a
-- sessão está aberta; quando fecha (todos enviaram), os membros veem tudo.
-- Helpers SECURITY DEFINER contornam o RLS nas checagens de pertencimento,
-- evitando recursão de policy (mesmo padrão do is_admin() do projeto).

CREATE OR REPLACE FUNCTION calib_is_creator(sess UUID) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM calibration_sessions s WHERE s.id = sess AND s.created_by = auth.uid());
$$;

CREATE OR REPLACE FUNCTION calib_is_member(sess UUID) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM calibration_sessions s WHERE s.id = sess AND s.created_by = auth.uid())
      OR EXISTS(SELECT 1 FROM calibration_participants p WHERE p.session_id = sess AND p.evaluator_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION calib_is_closed(sess UUID) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM calibration_sessions s WHERE s.id = sess AND s.status = 'closed');
$$;

CREATE OR REPLACE FUNCTION calib_owns_participant(part UUID) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM calibration_participants p WHERE p.id = part AND p.evaluator_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION calib_item_visible(part UUID) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT is_admin()
      OR EXISTS(SELECT 1 FROM calibration_participants p WHERE p.id = part AND p.evaluator_id = auth.uid())
      OR EXISTS(
        SELECT 1 FROM calibration_participants p
        JOIN calibration_sessions s ON s.id = p.session_id
        WHERE p.id = part AND s.status = 'closed' AND calib_is_member(s.id)
      );
$$;

ALTER TABLE calibration_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_items        ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON calibration_sessions, calibration_participants, calibration_items TO authenticated;

-- ── calibration_sessions ──
DROP POLICY IF EXISTS calib_sess_select ON calibration_sessions;
CREATE POLICY calib_sess_select ON calibration_sessions
  FOR SELECT TO authenticated USING (is_admin() OR calib_is_member(id));
DROP POLICY IF EXISTS calib_sess_insert ON calibration_sessions;
CREATE POLICY calib_sess_insert ON calibration_sessions
  FOR INSERT TO authenticated WITH CHECK ((is_admin() OR can_evaluate()) AND created_by = auth.uid());
DROP POLICY IF EXISTS calib_sess_update ON calibration_sessions;
CREATE POLICY calib_sess_update ON calibration_sessions
  FOR UPDATE TO authenticated USING (is_admin() OR created_by = auth.uid())
  WITH CHECK (is_admin() OR created_by = auth.uid());
DROP POLICY IF EXISTS calib_sess_delete ON calibration_sessions;
CREATE POLICY calib_sess_delete ON calibration_sessions
  FOR DELETE TO authenticated USING (is_admin() OR created_by = auth.uid());

-- ── calibration_participants ──
DROP POLICY IF EXISTS calib_part_select ON calibration_participants;
CREATE POLICY calib_part_select ON calibration_participants
  FOR SELECT TO authenticated USING (
    is_admin()
    OR evaluator_id = auth.uid()
    OR (calib_is_closed(session_id) AND calib_is_member(session_id))
  );
DROP POLICY IF EXISTS calib_part_insert ON calibration_participants;
CREATE POLICY calib_part_insert ON calibration_participants
  FOR INSERT TO authenticated WITH CHECK (is_admin() OR calib_is_creator(session_id));
DROP POLICY IF EXISTS calib_part_update ON calibration_participants;
CREATE POLICY calib_part_update ON calibration_participants
  FOR UPDATE TO authenticated USING (is_admin() OR evaluator_id = auth.uid())
  WITH CHECK (is_admin() OR evaluator_id = auth.uid());
DROP POLICY IF EXISTS calib_part_delete ON calibration_participants;
CREATE POLICY calib_part_delete ON calibration_participants
  FOR DELETE TO authenticated USING (is_admin() OR calib_is_creator(session_id));

-- ── calibration_items ──
DROP POLICY IF EXISTS calib_item_select ON calibration_items;
CREATE POLICY calib_item_select ON calibration_items
  FOR SELECT TO authenticated USING (calib_item_visible(participant_id));
DROP POLICY IF EXISTS calib_item_insert ON calibration_items;
CREATE POLICY calib_item_insert ON calibration_items
  FOR INSERT TO authenticated WITH CHECK (is_admin() OR calib_owns_participant(participant_id));
DROP POLICY IF EXISTS calib_item_update ON calibration_items;
CREATE POLICY calib_item_update ON calibration_items
  FOR UPDATE TO authenticated USING (is_admin() OR calib_owns_participant(participant_id))
  WITH CHECK (is_admin() OR calib_owns_participant(participant_id));
DROP POLICY IF EXISTS calib_item_delete ON calibration_items;
CREATE POLICY calib_item_delete ON calibration_items
  FOR DELETE TO authenticated USING (is_admin() OR calib_owns_participant(participant_id));
