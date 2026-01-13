import { readFileSync } from 'fs';
import { join } from 'path';
import pool from './src/db/config.js';

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔄 Running migration 005_extend_saved_filters...');

    const migrationSQL = readFileSync(
      join(process.cwd(), 'src/migrations/005_extend_saved_filters.sql'),
      'utf-8'
    );

    // Execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement) {
        await client.query(statement);
      }
    }

    console.log('✅ Migration 005 completed successfully!');
    console.log('');
    console.log('Added columns to saved_filters table:');
    console.log('  - nace_code (TEXT)');
    console.log('  - assigned_to (INTEGER)');
    console.log('  - tags (JSONB)');
    console.log('  - city (TEXT)');
    console.log('  - zip (TEXT)');
    console.log('');
    console.log('Created index: idx_saved_filters_tags');

  } catch (error: any) {
    // Check if error is about column already existing
    if (error.code === '42701') {
      console.log('⚠️  Migration already applied - columns already exist');
    } else {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
