-- ============================================
-- SCREENER 2.0 - INSERT USER PROFILES
-- ============================================
-- Execute this in Supabase SQL Editor AFTER creating auth users
-- This links the auth.users to the public.users table
-- ============================================

INSERT INTO users (id, email, name, role, team_id) VALUES
  ('3e67da9a-7460-414e-bceb-6d511322381b', 'admin@screener.test', 'Admin Teste', 'admin', NULL),
  ('58a002bc-8399-45c7-96ed-a57db92313c9', 'avaliador@screener.test', 'Avaliador Teste', 'evaluator', '33333333-3333-3333-3333-333333333333'),
  ('fc4c7d5f-9b6d-45cc-b126-eb8fb0a8bc1a', 'analista@screener.test', 'Analista Teste', 'analyst', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

-- Verify the insert worked
SELECT id, email, name, role, is_active FROM users ORDER BY role;
