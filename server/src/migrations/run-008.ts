import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from '../db/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('Running migration 008_phone_verified.sql...');

    const sql = readFileSync(join(__dirname, '008_phone_verified.sql'), 'utf-8');
    await client.query(sql);

    console.log('✅ Migration 008 completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
