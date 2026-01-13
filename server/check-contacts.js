import pool from './src/db/config.js';

async function checkContacts() {
  try {
    // Check table structure
    const structureResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'contacts'
      ORDER BY ordinal_position
    `);

    console.log('Contacts table structure:');
    structureResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Check if there are any contacts
    const countResult = await pool.query('SELECT COUNT(*) as count FROM contacts');
    console.log(`\nTotal contacts in database: ${countResult.rows[0].count}`);

    // Try to fetch contacts for a specific lead
    const testResult = await pool.query(
      'SELECT * FROM contacts WHERE lead_id = $1',
      [1315]
    );
    console.log(`\nContacts for lead 1315: ${testResult.rows.length}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkContacts();
