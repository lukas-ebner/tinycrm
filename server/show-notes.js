import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_M6gIDPs2oUiE@ep-round-feather-agg67a9e-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

await client.connect();

const result = await client.query(`
  SELECT l.name, n.content, n.created_at
  FROM notes n
  JOIN leads l ON l.id = n.lead_id
  WHERE n.content LIKE '%## Enrichment%'
  ORDER BY n.created_at DESC
  LIMIT 3
`);

result.rows.forEach((row, i) => {
  console.log('\n' + '='.repeat(60));
  console.log(`LEAD ${i + 1}: ${row.name}`);
  console.log('='.repeat(60));
  console.log(row.content);
});

await client.end();
