-- ============================================
-- SCREENER 2.0 - MIGRATION 12
-- Fix: let analysts see the evaluator who evaluated them
-- After migration 11 enabled RLS on users, the SELECT policy only
-- exposed the analyst's own row. The analyst UI joins
-- evaluator:users!evaluator_id to show "who evaluated me", which was
-- coming back NULL and falling back to the generic label "Avaliador".
--
-- This adds a targeted SELECT policy: an analyst may read a user row
-- only if that user is the evaluator on an evaluation the analyst owns.
-- Policies are OR'd, so this only broadens visibility for those rows.
--
-- No recursion risk: the subquery reads evaluations, whose SELECT policy
-- relies on public.is_admin() (SECURITY DEFINER, bypasses RLS on users).
-- ============================================

DROP POLICY IF EXISTS "Analysts can view their evaluators" ON public.users;
CREATE POLICY "Analysts can view their evaluators" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE e.evaluator_id = users.id
        AND e.analyst_id  = auth.uid()
    )
  );
