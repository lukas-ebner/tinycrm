import pg from 'pg';

const { Client } = pg;

const DB_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_M6gIDPs2oUiE@ep-round-feather-agg67a9e-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require';

async function addEnrichmentColumn() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    console.log('Adding enrichment_data column...');
    await client.query(`
      ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS enrichment_data JSONB
    `);

    console.log('✅ Column added successfully');

    // Check if it exists
    const result = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'leads' AND column_name = 'enrichment_data'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Verified: enrichment_data column exists');
    } else {
      console.log('❌ Column was not added');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

addEnrichmentColumn();
