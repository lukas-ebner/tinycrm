import pool from '../db/config.js';

/**
 * This script adds missing tables and columns to production without dropping existing data.
 * Run with: npx tsx src/migrations/run-missing-tables.ts
 */
async function addMissingTables() {
  const client = await pool.connect();

  try {
    console.log('🔄 Adding missing tables and columns to database...');

    // Create contacts table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
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
    `);
    console.log('✓ contacts table ready');

    // Create index if not exists
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contacts_lead_id ON contacts(lead_id);
    `);

    // Create saved_filters table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_filters (
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
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ saved_filters table ready');

    // Add min_score column if it doesn't exist (for existing tables)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'saved_filters' AND column_name = 'min_score'
        ) THEN
          ALTER TABLE saved_filters ADD COLUMN min_score INTEGER;
        END IF;
      END $$;
    `);
    console.log('✓ min_score column ready');

    // Add enrichment_data column to leads if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'leads' AND column_name = 'enrichment_data'
        ) THEN
          ALTER TABLE leads ADD COLUMN enrichment_data JSONB;
        END IF;
      END $$;
    `);
    console.log('✓ enrichment_data column ready');

    // Create indexes if not exists
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_saved_filters_user_id ON saved_filters(user_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_saved_filters_tags ON saved_filters USING GIN (tags);
    `);

    console.log('✅ All missing tables and columns have been added successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addMissingTables();
