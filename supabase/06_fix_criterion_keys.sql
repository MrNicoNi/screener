-- ============================================
-- MIGRATION: Fix Criterion Keys Case
-- ============================================
-- This migration updates all existing evaluation_items
-- to use uppercase criterion_key values (C1, E1, P1)
-- instead of lowercase (c1, e1, p1)
-- ============================================

-- Update Communication criteria (c1-c7 -> C1-C7)
UPDATE evaluation_items SET criterion_key = 'C1' WHERE criterion_key = 'c1';
UPDATE evaluation_items SET criterion_key = 'C2' WHERE criterion_key = 'c2';
UPDATE evaluation_items SET criterion_key = 'C3' WHERE criterion_key = 'c3';
UPDATE evaluation_items SET criterion_key = 'C4' WHERE criterion_key = 'c4';
UPDATE evaluation_items SET criterion_key = 'C5' WHERE criterion_key = 'c5';
UPDATE evaluation_items SET criterion_key = 'C6' WHERE criterion_key = 'c6';
UPDATE evaluation_items SET criterion_key = 'C7' WHERE criterion_key = 'c7';

-- Update Efficiency criteria (e1-e5 -> E1-E5)
UPDATE evaluation_items SET criterion_key = 'E1' WHERE criterion_key = 'e1';
UPDATE evaluation_items SET criterion_key = 'E2' WHERE criterion_key = 'e2';
UPDATE evaluation_items SET criterion_key = 'E3' WHERE criterion_key = 'e3';
UPDATE evaluation_items SET criterion_key = 'E4' WHERE criterion_key = 'e4';
UPDATE evaluation_items SET criterion_key = 'E5' WHERE criterion_key = 'e5';

-- Update Process criteria (p1-p7 -> P1-P7)
UPDATE evaluation_items SET criterion_key = 'P1' WHERE criterion_key = 'p1';
UPDATE evaluation_items SET criterion_key = 'P2' WHERE criterion_key = 'p2';
UPDATE evaluation_items SET criterion_key = 'P3' WHERE criterion_key = 'p3';
UPDATE evaluation_items SET criterion_key = 'P4' WHERE criterion_key = 'p4';
UPDATE evaluation_items SET criterion_key = 'P5' WHERE criterion_key = 'p5';
UPDATE evaluation_items SET criterion_key = 'P6' WHERE criterion_key = 'p6';
UPDATE evaluation_items SET criterion_key = 'P7' WHERE criterion_key = 'p7';

-- Verify the migration
SELECT 
    criterion_key, 
    COUNT(*) as count
FROM evaluation_items
GROUP BY criterion_key
ORDER BY criterion_key;
