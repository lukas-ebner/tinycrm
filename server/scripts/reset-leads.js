import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function resetLeads() {
  const client = await pool.connect();

  try {
    console.log('🗑️  Resetting leads data...');

    await client.query('BEGIN');

    // Delete in correct order due to foreign keys
    await client.query('DELETE FROM lead_tags');
    console.log('✓ Deleted lead_tags');

    await client.query('DELETE FROM notes');
    console.log('✓ Deleted notes');

    await client.query('DELETE FROM reminders');
    console.log('✓ Deleted reminders');

    await client.query('DELETE FROM leads');
    console.log('✓ Deleted leads');

    // Reset sequences
    await client.query('ALTER SEQUENCE leads_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE notes_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE reminders_id_seq RESTART WITH 1');
    console.log('✓ Reset sequences');

    await client.query('COMMIT');

    console.log('\n✅ Leads data reset successfully!');
    console.log('You can now import your CSV file again.');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error resetting leads:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

resetLeads().catch(console.error);
