-- Extend saved_filters table with additional filter fields
ALTER TABLE saved_filters
  ADD COLUMN nace_code TEXT,
  ADD COLUMN assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN city TEXT,
  ADD COLUMN zip TEXT;

-- Add index for better JSONB query performance
CREATE INDEX idx_saved_filters_tags ON saved_filters USING GIN (tags);

-- Add documentation comments
COMMENT ON COLUMN saved_filters.tags IS 'Array of tag names for filter matching';
COMMENT ON COLUMN saved_filters.nace_code IS 'Industry classification code filter';
COMMENT ON COLUMN saved_filters.city IS 'City name filter';
COMMENT ON COLUMN saved_filters.zip IS 'Postal code filter';
