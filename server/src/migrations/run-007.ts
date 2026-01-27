import pool from '../db/config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔄 Running migration 007: advisory_board...');

    const sql = fs.readFileSync(path.join(__dirname, '007_advisory_board.sql'), 'utf-8');
    await client.query(sql);

    console.log('✓ Migration 007 applied successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
