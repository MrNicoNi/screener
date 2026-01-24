-- ============================================
-- SCREENER 2.0 - RLS POLICIES (CORRECT VERSION)
-- ============================================
-- This file contains CORRECT RLS policies using SECURITY DEFINER functions
-- to prevent the recursion deadlocks that plagued v1.0
-- ============================================

-- ============================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- ============================================
-- These functions bypass RLS to check user roles
-- This prevents infinite recursion when policies query the users table

-- Check if current user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if current user is evaluator or admin
CREATE OR REPLACE FUNCTION auth.can_evaluate()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('evaluator', 'admin') 
    AND is_active = TRUE
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Get current user's role
CREATE OR REPLACE FUNCTION auth.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS POLICIES
-- ============================================

-- SELECT: Admins see all, others see only themselves
DROP POLICY IF EXISTS "Users can view based on role" ON users;
CREATE POLICY "Users can view based on role" ON users
  FOR SELECT USING (
    auth.is_admin() OR id = auth.uid()
  );

-- UPDATE: Only admins can update
DROP POLICY IF EXISTS "Admins can update users" ON users;
CREATE POLICY "Admins can update users" ON users
  FOR UPDATE 
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- INSERT: Only admins (via Edge Function)
DROP POLICY IF EXISTS "Admins can insert users" ON users;
CREATE POLICY "Admins can insert users" ON users
  FOR INSERT 
  WITH CHECK (auth.is_admin());

-- DELETE: Only admins (soft delete via is_active)
DROP POLICY IF EXISTS "Admins can delete users" ON users;
CREATE POLICY "Admins can delete users" ON users
  FOR DELETE 
  USING (auth.is_admin());

-- ============================================
-- TEAMS POLICIES
-- ============================================

-- SELECT: Everyone can view teams
DROP POLICY IF EXISTS "All authenticated users can view teams" ON teams;
CREATE POLICY "All authenticated users can view teams" ON teams
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- UPDATE/INSERT/DELETE: Only admins
DROP POLICY IF EXISTS "Admins can manage teams" ON teams;
CREATE POLICY "Admins can manage teams" ON teams
  FOR ALL USING (auth.is_admin());

-- ============================================
-- EVALUATIONS POLICIES
-- ============================================

-- SELECT: Admins see all, evaluators see their own, analysts see their own
DROP POLICY IF EXISTS "Users can view evaluations based on role" ON evaluations;
CREATE POLICY "Users can view evaluations based on role" ON evaluations
  FOR SELECT USING (
    auth.is_admin() 
    OR evaluator_id = auth.uid() 
    OR analyst_id = auth.uid()
  );

-- INSERT: Only evaluators and admins
DROP POLICY IF EXISTS "Evaluators can create evaluations" ON evaluations;
CREATE POLICY "Evaluators can create evaluations" ON evaluations
  FOR INSERT WITH CHECK (auth.can_evaluate());

-- UPDATE: Evaluators can update their own, analysts can acknowledge
DROP POLICY IF EXISTS "Users can update evaluations based on role" ON evaluations;
CREATE POLICY "Users can update evaluations based on role" ON evaluations
  FOR UPDATE USING (
    auth.is_admin() 
    OR evaluator_id = auth.uid()
    OR (analyst_id = auth.uid() AND analyst_acknowledged = FALSE)
  );

-- ============================================
-- EVALUATION_ITEMS POLICIES
-- ============================================

-- SELECT: Same as evaluations (via JOIN)
DROP POLICY IF EXISTS "Users can view items based on evaluation access" ON evaluation_items;
CREATE POLICY "Users can view items based on evaluation access" ON evaluation_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_items.evaluation_id
      AND (
        auth.is_admin() 
        OR e.evaluator_id = auth.uid() 
        OR e.analyst_id = auth.uid()
      )
    )
  );

-- INSERT: Only evaluators and admins
DROP POLICY IF EXISTS "Evaluators can create items" ON evaluation_items;
CREATE POLICY "Evaluators can create items" ON evaluation_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_items.evaluation_id
      AND (auth.is_admin() OR e.evaluator_id = auth.uid())
    )
  );
