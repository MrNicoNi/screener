-- ============================================
-- SCREENER 2.0 - MIGRATION 09
-- Fix: add DELETE policy on evaluations
-- Fix: update status CHECK constraint to include quality statuses
-- ============================================

-- ============================================
-- 1. DELETE policy para evaluations
-- Avaliadores só deletam as próprias; admins deletam qualquer uma
-- ============================================
DROP POLICY IF EXISTS "Evaluators and admins can delete evaluations" ON evaluations;

CREATE POLICY "Evaluators and admins can delete evaluations" ON evaluations
  FOR DELETE USING (
    auth.is_admin() OR evaluator_id = auth.uid()
  );

-- ============================================
-- 2. Atualiza CHECK constraint do campo status
-- O código grava 'excellent'/'approved'/'failed' como status inicial.
-- Workflow: pending → acknowledged | disputed
-- Qualidade: excellent | approved | failed (estado inicial)
-- ============================================
ALTER TABLE evaluations
  DROP CONSTRAINT IF EXISTS evaluations_status_check;

ALTER TABLE evaluations
  ADD CONSTRAINT evaluations_status_check
  CHECK (status IN ('pending', 'acknowledged', 'disputed', 'excellent', 'approved', 'failed'));
