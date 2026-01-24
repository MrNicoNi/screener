-- ============================================
-- MIGRATION: Add Pillar Score Columns
-- ============================================
-- Adds individual pillar score columns to evaluations table
-- to support the 3-pillar scoring framework
-- ============================================

-- Add pillar score columns
ALTER TABLE evaluations 
ADD COLUMN IF NOT EXISTS score_communication DECIMAL(5,2) DEFAULT 0 CHECK (score_communication >= 0 AND score_communication <= 100),
ADD COLUMN IF NOT EXISTS score_efficiency DECIMAL(5,2) DEFAULT 0 CHECK (score_efficiency >= 0 AND score_efficiency <= 100),
ADD COLUMN IF NOT EXISTS score_process DECIMAL(5,2) DEFAULT 0 CHECK (score_process >= 0 AND score_process <= 100);

-- Add additional fields
ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS ticket_subject TEXT,
ADD COLUMN IF NOT EXISTS analyst_comment TEXT;

-- Update status check constraint to include new statuses
ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS evaluations_status_check;
ALTER TABLE evaluations ADD CONSTRAINT evaluations_status_check 
  CHECK (status IN ('pending', 'acknowledged', 'disputed', 'excellent', 'approved', 'failed'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations(status);
CREATE INDEX IF NOT EXISTS idx_evaluations_acknowledged ON evaluations(analyst_acknowledged) WHERE analyst_acknowledged = FALSE;

-- Migrate existing evaluation_items data from 1-5 scale to 0-1 (Y/N)
-- Any value > 0 becomes 1 (Yes), 0 stays 0 (No)
UPDATE evaluation_items 
SET value = CASE 
  WHEN value > 0 THEN 1 
  ELSE 0 
END
WHERE value > 1;

-- Update evaluation_items constraint to allow 0 (unchecked) and 1 (checked)
ALTER TABLE evaluation_items DROP CONSTRAINT IF EXISTS evaluation_items_value_check;
ALTER TABLE evaluation_items ADD CONSTRAINT evaluation_items_value_check 
  CHECK (value >= 0 AND value <= 1);
