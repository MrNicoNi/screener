-- ============================================
-- SCREENER 2.0 - MIGRATION 10
-- Fix: restrict analyst UPDATE to workflow fields only
-- Analysts can only change status to acknowledged/disputed
-- and must not alter final_score or ticket_id
-- ============================================

DROP POLICY IF EXISTS "Users can update evaluations based on role" ON evaluations;

CREATE POLICY "Users can update evaluations based on role" ON evaluations
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE)
    OR evaluator_id = auth.uid()
    OR analyst_id = auth.uid()
  )
  WITH CHECK (
    -- Admin: sem restrições
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE)
    -- Avaliador: sem restrições nas próprias avaliações
    OR evaluator_id = auth.uid()
    -- Analista: só pode mudar campos de workflow (ciência/contestação)
    -- final_score e ticket_id devem permanecer inalterados
    OR (
      analyst_id = auth.uid()
      AND status IN ('acknowledged', 'disputed')
      AND final_score = (SELECT e.final_score FROM evaluations e WHERE e.id = evaluations.id)
      AND ticket_id  = (SELECT e.ticket_id  FROM evaluations e WHERE e.id = evaluations.id)
    )
  );
