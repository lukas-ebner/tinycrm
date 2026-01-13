-- Create saved_filters table for storing user-defined lead filters
CREATE TABLE IF NOT EXISTS saved_filters (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  search TEXT,
  stage_id INTEGER REFERENCES stages(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries by user
CREATE INDEX idx_saved_filters_user_id ON saved_filters(user_id);
