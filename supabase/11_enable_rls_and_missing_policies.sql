-- ============================================
-- SCREENER 2.0 - MIGRATION 11
-- Fix: enable RLS on all 4 tables
-- Fix: create SECURITY DEFINER helpers (prevent recursion on users table)
-- Fix: add missing SELECT and INSERT policies on all tables
-- Fix: add all policies for users and teams tables
-- ============================================

-- ============================================
-- 1. SECURITY DEFINER helper functions
-- These bypass RLS so policies can query the users table
-- without triggering infinite recursion.
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_evaluate()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('evaluator', 'admin')
    AND is_active = TRUE
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- 2. Enable RLS on all tables
-- ============================================
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_items  ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. USERS policies
-- ============================================
DROP POLICY IF EXISTS "Users can view based on role" ON public.users;
CREATE POLICY "Users can view based on role" ON public.users
  FOR SELECT USING (
    public.is_admin() OR id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
CREATE POLICY "Admins can insert users" ON public.users
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update users" ON public.users;
CREATE POLICY "Admins can update users" ON public.users
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
CREATE POLICY "Admins can delete users" ON public.users
  FOR DELETE USING (public.is_admin());

-- ============================================
-- 4. TEAMS policies
-- ============================================
DROP POLICY IF EXISTS "All authenticated users can view teams" ON public.teams;
CREATE POLICY "All authenticated users can view teams" ON public.teams
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage teams" ON public.teams;
CREATE POLICY "Admins can manage teams" ON public.teams
  FOR ALL USING (public.is_admin());

-- ============================================
-- 5. EVALUATIONS policies (SELECT + INSERT)
-- UPDATE and DELETE already exist from migrations 09 and 10
-- ============================================
DROP POLICY IF EXISTS "Users can view evaluations based on role" ON public.evaluations;
CREATE POLICY "Users can view evaluations based on role" ON public.evaluations
  FOR SELECT USING (
    public.is_admin()
    OR evaluator_id = auth.uid()
    OR analyst_id  = auth.uid()
  );

DROP POLICY IF EXISTS "Evaluators can create evaluations" ON public.evaluations;
CREATE POLICY "Evaluators can create evaluations" ON public.evaluations
  FOR INSERT WITH CHECK (public.can_evaluate());

-- ============================================
-- 6. EVALUATION_ITEMS policies (SELECT + INSERT)
-- UPDATE and DELETE already exist
-- ============================================
DROP POLICY IF EXISTS "Users can view items based on evaluation access" ON public.evaluation_items;
CREATE POLICY "Users can view items based on evaluation access" ON public.evaluation_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE e.id = evaluation_items.evaluation_id
        AND (
          public.is_admin()
          OR e.evaluator_id = auth.uid()
          OR e.analyst_id   = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Evaluators can create items" ON public.evaluation_items;
CREATE POLICY "Evaluators can create items" ON public.evaluation_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE e.id = evaluation_items.evaluation_id
        AND (public.is_admin() OR e.evaluator_id = auth.uid())
    )
  );
