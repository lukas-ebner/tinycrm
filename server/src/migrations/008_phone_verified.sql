-- Add phone verification tracking to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP;

-- Add index for verified phone numbers
CREATE INDEX IF NOT EXISTS idx_leads_phone_verified ON leads(phone_verified);

-- Add comment to explain the column
COMMENT ON COLUMN leads.phone_verified IS 'Indicates if the phone number has been verified/enriched by the phone enrichment script';
COMMENT ON COLUMN leads.phone_verified_at IS 'Timestamp when the phone number was last verified/enriched';
