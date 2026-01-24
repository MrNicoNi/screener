-- ============================================
-- SCREENER 2.0 - RLS POLICY TESTS
-- ============================================
-- Run with: psql -h db.your-project.supabase.co -U postgres -d postgres -f 04_rls_tests.sql
-- All tests MUST pass before deploying to production
-- ============================================

BEGIN;
SELECT plan(12);  -- Number of tests

-- ============================================
-- SETUP: Create test users
-- ============================================
-- Note: In real testing, these would be created via Supabase Auth
-- For SQL testing, we insert directly

INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@test.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'evaluator@test.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'analyst@test.com')
ON CONFLICT DO NOTHING;

INSERT INTO users (id, email, name, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@test.com', 'Admin Test', 'admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'evaluator@test.com', 'Evaluator Test', 'evaluator'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'analyst@test.com', 'Analyst Test', 'analyst')
ON CONFLICT DO NOTHING;

-- ============================================
-- TEST 1: Admin can view all users
-- ============================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

SELECT ok(
  (SELECT COUNT(*) FROM users) >= 3,
  'Admin can view all users'
);

-- ============================================
-- TEST 2: Analyst can only view own profile
-- ============================================
SET LOCAL request.jwt.claims TO '{"sub": "cccccccc-cccc-cccc-cccc-cccccccccccc"}';

SELECT is(
  (SELECT COUNT(*)::int FROM users),
  1,
  'Analyst can only view own profile'
);

-- ============================================
-- TEST 3: Admin can update users
-- ============================================
SET LOCAL request.jwt.claims TO '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

UPDATE users SET name = 'Updated Name' WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

SELECT is(
  (SELECT name FROM users WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  'Updated Name',
  'Admin can update users'
);

-- ============================================
-- TEST 4: Analyst CANNOT update other users
-- ============================================
SET LOCAL request.jwt.claims TO '{"sub": "cccccccc-cccc-cccc-cccc-cccccccccccc"}';

UPDATE users SET name = 'Hacked' WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SELECT is(
  (SELECT name FROM users WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'Admin Test',
  'Analyst cannot update other users'
);

-- ============================================
-- TEST 5: Evaluator can create evaluations
-- ============================================
SET LOCAL request.jwt.claims TO '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';

INSERT INTO evaluations (analyst_id, evaluator_id, ticket_id, final_score)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TICKET-123', 85.5);

SELECT ok(
  EXISTS(SELECT 1 FROM evaluations WHERE ticket_id = 'TICKET-123'),
  'Evaluator can create evaluations'
);

-- ============================================
-- TEST 6: Analyst CANNOT create evaluations
-- ============================================
SET LOCAL request.jwt.claims TO '{"sub": "cccccccc-cccc-cccc-cccc-cccccccccccc"}';

-- This should fail silently (RLS blocks it)
INSERT INTO evaluations (analyst_id, evaluator_id, ticket_id, final_score)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TICKET-456', 90.0);

SELECT ok(
  NOT EXISTS(SELECT 1 FROM evaluations WHERE ticket_id = 'TICKET-456'),
  'Analyst cannot create evaluations'
);

-- ============================================
-- TEST 7: No recursion in policies (performance test)
-- ============================================
SET LOCAL request.jwt.claims TO '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

-- This should complete in <100ms (not hang)
SELECT ok(
  (SELECT COUNT(*) FROM users) >= 0,
  'User query completes without hanging (no recursion)'
);

-- ============================================
-- TEST 8: Helper function auth.is_admin() works
-- ============================================
SET LOCAL request.jwt.claims TO '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

SELECT ok(
  auth.is_admin() = TRUE,
  'auth.is_admin() returns TRUE for admin'
);

SET LOCAL request.jwt.claims TO '{"sub": "cccccccc-cccc-cccc-cccc-cccccccccccc"}';

SELECT ok(
  auth.is_admin() = FALSE,
  'auth.is_admin() returns FALSE for analyst'
);

-- ============================================
-- TEST 9: Helper function auth.can_evaluate() works
-- ============================================
SET LOCAL request.jwt.claims TO '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';

SELECT ok(
  auth.can_evaluate() = TRUE,
  'auth.can_evaluate() returns TRUE for evaluator'
);

SET LOCAL request.jwt.claims TO '{"sub": "cccccccc-cccc-cccc-cccc-cccccccccccc"}';

SELECT ok(
  auth.can_evaluate() = FALSE,
  'auth.can_evaluate() returns FALSE for analyst'
);

-- ============================================
-- TEST 10: Analyst can view own evaluations
-- ============================================
SET LOCAL request.jwt.claims TO '{"sub": "cccccccc-cccc-cccc-cccc-cccccccccccc"}';

SELECT ok(
  EXISTS(SELECT 1 FROM evaluations WHERE analyst_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  'Analyst can view own evaluations'
);

SELECT * FROM finish();
ROLLBACK;
