-- Migration script to add completion_info to existing comments table
-- Run this if you already have a comments table in production

-- Add the completion_info JSONB column with default empty array
ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS completion_info JSONB DEFAULT '[]'::jsonb;

-- Add GIN index for efficient querying of JSONB data
CREATE INDEX IF NOT EXISTS idx_comments_completion_info ON comments USING GIN (completion_info);

-- Add computed column for quick status checks
ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS completion_status TEXT GENERATED ALWAYS AS (
  CASE 
    WHEN jsonb_array_length(completion_info) = 0 THEN 'active'
    ELSE completion_info->-1->>'action'
  END
) STORED;

-- Optional: Create an index on the computed status column for faster filtering
CREATE INDEX IF NOT EXISTS idx_comments_completion_status ON comments(completion_status);

-- Verify the migration
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'comments' 
  AND column_name IN ('completion_info', 'completion_status')
ORDER BY column_name; 