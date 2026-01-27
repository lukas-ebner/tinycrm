-- Add advisory board field to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS is_advisory_board BOOLEAN DEFAULT FALSE;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_leads_advisory_board ON leads(is_advisory_board);
