-- Promo Code Lists (importierte Code-Listen)
CREATE TABLE IF NOT EXISTS promo_code_lists (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  imported_at TIMESTAMP DEFAULT NOW(),
  total_codes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Promo Codes (einzelne Codes)
CREATE TABLE IF NOT EXISTS promo_codes (
  id SERIAL PRIMARY KEY,
  list_id INTEGER NOT NULL REFERENCES promo_code_lists(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL UNIQUE,
  promotion_code_id VARCHAR(255),
  active BOOLEAN DEFAULT true,
  max_redemptions INTEGER DEFAULT 1,
  times_redeemed INTEGER DEFAULT 0,
  expires_at BIGINT,
  created BIGINT,
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'redeemed')),
  assigned_to_lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_promo_codes_list_id ON promo_codes(list_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_status ON promo_codes(status);
CREATE INDEX IF NOT EXISTS idx_promo_codes_assigned_to_lead_id ON promo_codes(assigned_to_lead_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
