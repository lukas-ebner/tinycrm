import pool from './src/db/config.js';

async function checkTables() {
  try {
    const result = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log('Tables in database:', result.rows.map(r => r.table_name).join(', '));

    // Check if contacts table exists
    const hasContacts = result.rows.some(r => r.table_name === 'contacts');
    console.log('\nContacts table exists:', hasContacts);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTables();
