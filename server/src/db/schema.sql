-- Drop existing tables if they exist (for development/testing)
DROP TABLE IF EXISTS reminders CASCADE;
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS lead_tags CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS custom_field_definitions CASCADE;
DROP TABLE IF EXISTS stages CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'caller' CHECK (role IN ('admin', 'caller')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Pipeline Stages
CREATE TABLE stages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL, -- Hex color like #F97316
  position INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Custom Field Definitions
CREATE TABLE custom_field_definitions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'dropdown', 'checkbox')),
  options JSONB, -- For dropdowns: ["Option1", "Option2"]
  required BOOLEAN DEFAULT false,
  position INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Leads table
CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  register_id VARCHAR(100) UNIQUE, -- North Data ID for duplicate check
  name VARCHAR(255) NOT NULL,
  legal_form VARCHAR(100),
  zip VARCHAR(10),
  city VARCHAR(100),
  street VARCHAR(255),
  phone VARCHAR(100),
  email VARCHAR(255),
  website VARCHAR(500),
  nace_code VARCHAR(255),
  business_purpose TEXT,
  ceo_1 VARCHAR(255),
  ceo_2 VARCHAR(255),
  revenue_eur DECIMAL,
  employee_count INT,
  northdata_url VARCHAR(500),
  stage_id INT REFERENCES stages(id) ON DELETE SET NULL,
  assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
  custom_fields JSONB DEFAULT '{}',
  enrichment_data JSONB, -- AI-enriched data from website analysis
  import_source VARCHAR(255), -- Original CSV filename for filtering
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tags table
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL
);

-- Lead-Tag relationship
CREATE TABLE lead_tags (
  lead_id INT REFERENCES leads(id) ON DELETE CASCADE,
  tag_id INT REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);

-- Notes table
CREATE TABLE notes (
  id SERIAL PRIMARY KEY,
  lead_id INT REFERENCES leads(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reminders (Wiedervorlagen)
CREATE TABLE reminders (
  id SERIAL PRIMARY KEY,
  lead_id INT REFERENCES leads(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  due_at TIMESTAMP NOT NULL,
  reason VARCHAR(500),
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_leads_register_id ON leads(register_id);
CREATE INDEX idx_leads_stage_id ON leads(stage_id);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_notes_lead_id ON notes(lead_id);
CREATE INDEX idx_reminders_lead_id ON reminders(lead_id);
CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_due_at ON reminders(due_at) WHERE completed = false;
CREATE INDEX idx_lead_tags_lead_id ON lead_tags(lead_id);
CREATE INDEX idx_lead_tags_tag_id ON lead_tags(tag_id);

-- Contacts table for lead contact persons
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  role VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Saved Filters table for storing user-defined lead filters
CREATE TABLE saved_filters (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  search TEXT,
  stage_id INTEGER REFERENCES stages(id) ON DELETE SET NULL,
  nace_code TEXT,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  city TEXT,
  zip TEXT,
  min_score INTEGER,
  import_source VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for contacts
CREATE INDEX idx_contacts_lead_id ON contacts(lead_id);

-- Index for saved filters
CREATE INDEX idx_saved_filters_user_id ON saved_filters(user_id);
CREATE INDEX idx_saved_filters_tags ON saved_filters USING GIN (tags);

-- Insert default stages
INSERT INTO stages (name, color, position) VALUES
  ('Neu', '#94A3B8', 1),
  ('Zu kontaktieren', '#3B82F6', 2),
  ('Kontaktiert', '#F59E0B', 3),
  ('Qualifiziert', '#10B981', 4),
  ('Termin', '#8B5CF6', 5),
  ('Nicht relevant', '#EF4444', 6),
  ('Später', '#6B7280', 7);

-- Insert default admin user (password: admin123 - CHANGE IN PRODUCTION!)
-- Hash generated with bcrypt: $2a$10$XQCWeGV6vLNZ3GvGxqYh4OqjH9YKCJxKqZhWZXqXqZhWZXqXqZhWZ
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Admin', 'admin@leadtimelabs.com', '$2a$10$XQCWeGV6vLNZ3GvGxqYh4OqjH9YKCJxKqZhWZXqXqZhWZXqXqZhWZ', 'admin');
