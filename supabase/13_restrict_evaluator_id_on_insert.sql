-- ============================================
-- SCREENER 2.0 - MIGRATION 13
-- Fix: bind evaluator_id to the author on INSERT
-- The previous INSERT policy only checked can_evaluate(), so an evaluator
-- could create an evaluation attributed to ANOTHER evaluator via the API.
-- Now an evaluator may only insert rows where evaluator_id = auth.uid();
-- admins remain free to attribute an evaluation to any evaluator.
-- ============================================

DROP POLICY IF EXISTS "Evaluators can create evaluations" ON public.evaluations;
CREATE POLICY "Evaluators can create evaluations" ON public.evaluations
  FOR INSERT WITH CHECK (
    public.can_evaluate()
    AND (public.is_admin() OR evaluator_id = auth.uid())
  );
