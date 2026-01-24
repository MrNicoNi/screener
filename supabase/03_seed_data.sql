-- ============================================
-- SCREENER 2.0 - SEED DATA
-- ============================================
-- Test users and sample data for development
-- ============================================

-- ============================================
-- CREATE TEST TEAMS
-- ============================================
INSERT INTO teams (id, name, manager_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Suporte Nível 1', NULL),
  ('22222222-2222-2222-2222-222222222222', 'Suporte Nível 2', NULL),
  ('33333333-3333-3333-3333-333333333333', 'Qualidade', NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- NOTE: Test users must be created via Supabase Auth first
-- ============================================
-- Use Supabase Dashboard → Authentication → Add User
-- Or use the manage-users Edge Function
-- 
-- Recommended test users:
-- 1. admin@screener.test (role: admin)
-- 2. avaliador@screener.test (role: evaluator)
-- 3. analista@screener.test (role: analyst)
--
-- After creating in auth.users, insert profiles below:
-- ============================================

-- Example (uncomment and replace UUIDs after creating auth users):
-- INSERT INTO users (id, email, name, role, team_id) VALUES
--   ('uuid-from-auth-users', 'admin@screener.test', 'Admin Teste', 'admin', NULL),
--   ('uuid-from-auth-users', 'avaliador@screener.test', 'Avaliador Teste', 'evaluator', '33333333-3333-3333-3333-333333333333'),
--   ('uuid-from-auth-users', 'analista@screener.test', 'Analista Teste', 'analyst', '11111111-1111-1111-1111-111111111111')
-- ON CONFLICT (id) DO NOTHING;
