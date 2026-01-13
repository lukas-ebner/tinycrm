import pool from '../db/config.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, '../migrations/004_add_saved_filters.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration 004_add_saved_filters.sql...');
    await pool.query(sql);
    console.log('✓ Migration completed successfully');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
