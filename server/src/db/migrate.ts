import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './config.js';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('🔄 Running database migrations...');

    // Read and execute schema
    const schemaSQL = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');

    // Execute the schema (we need to handle the admin password hash properly)
    const sqlStatements = schemaSQL.split(';').filter(stmt => stmt.trim());

    for (const statement of sqlStatements) {
      if (statement.trim()) {
        // If this is the admin insert, generate a proper bcrypt hash
        if (statement.includes('admin@leadtimelabs.com')) {
          const adminPassword = 'admin123'; // Default password
          const passwordHash = await bcrypt.hash(adminPassword, 10);

          await client.query(`
            INSERT INTO users (name, email, password_hash, role) VALUES
            ('Admin', 'admin@leadtimelabs.com', $1, 'admin')
            ON CONFLICT (email) DO NOTHING
          `, [passwordHash]);

          console.log('✓ Created default admin user (email: admin@leadtimelabs.com, password: admin123)');
        } else {
          await client.query(statement);
        }
      }
    }

    console.log('✅ Database migrations completed successfully!');
    console.log('');
    console.log('Default credentials:');
    console.log('  Email: admin@leadtimelabs.com');
    console.log('  Password: admin123');
    console.log('');
    console.log('⚠️  IMPORTANT: Change the admin password in production!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
