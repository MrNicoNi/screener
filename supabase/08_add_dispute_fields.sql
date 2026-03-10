-- ============================================
-- SCREENER 2.0 - MIGRATION 08
-- Add dispute fields and update RLS for edit/dispute features
-- ============================================

-- ============================================
-- 1. Garante que analyst_comment existe
-- ============================================
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS analyst_comment TEXT;

-- ============================================
-- 2. Campo de motivo de contestação (novo)
-- ============================================
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS dispute_reason TEXT;

-- ============================================
-- 3. Campo de assunto do ticket
-- ============================================
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS ticket_subject TEXT;

-- ============================================
-- 4. Atualizar RLS UPDATE policy de evaluations
-- A nova permite contestação (disputed) em qualquer estado.
-- ============================================
DROP POLICY IF EXISTS "Users can update evaluations based on role" ON evaluations;

CREATE POLICY "Users can update evaluations based on role" ON evaluations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE)
    OR evaluator_id = auth.uid()
    OR analyst_id = auth.uid()
  );

-- ============================================
-- 5. Permite avaliador/admin atualizar evaluation_items
-- ============================================
DROP POLICY IF EXISTS "Evaluators can update items" ON evaluation_items;

CREATE POLICY "Evaluators can update items" ON evaluation_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_items.evaluation_id
      AND (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE)
        OR e.evaluator_id = auth.uid()
      )
    )
  );

-- ============================================
-- 6. Permite avaliador/admin excluir evaluation_items
--    (necessário para re-inserir ao editar)
-- ============================================
DROP POLICY IF EXISTS "Evaluators can delete items" ON evaluation_items;

CREATE POLICY "Evaluators can delete items" ON evaluation_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_items.evaluation_id
      AND (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE)
        OR e.evaluator_id = auth.uid()
      )
    )
  );

