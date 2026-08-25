-- ============================================
-- SCREENER 2.0 - MIGRATION 25
-- Fix: let evaluators see the roster (analysts + peers)
--
-- Regression: migration 11 enabled RLS on public.users, and the only
-- SELECT policies since then are:
--   - "Users can view based on role"  -> is_admin() OR id = auth.uid()
--   - "Analysts can view their evaluators" (migration 12)
-- Neither exposes analyst rows to an EVALUATOR. So an evaluator could only
-- read their own row, and every join analyst:users!analyst_id came back
-- NULL. Symptoms seen by an evaluator: analyst column shows "N/A"/"—", the
-- "Todos os Analistas" filter is empty, the ranking/radar are empty, and the
-- dashboard average reads 0%.
--
-- The QA cockpit is an internal tool: evaluators legitimately need the whole
-- roster to pick who to audit, rank analysts, run calibration, and populate
-- filters. So we grant can_evaluate() (evaluator OR admin) a broad SELECT.
--
-- No recursion risk: can_evaluate() is SECURITY DEFINER and bypasses RLS on
-- users. Policies are OR'd, so this only broadens visibility.
-- ============================================

DROP POLICY IF EXISTS "Evaluators can view all users" ON public.users;
CREATE POLICY "Evaluators can view all users" ON public.users
  FOR SELECT USING (public.can_evaluate());
