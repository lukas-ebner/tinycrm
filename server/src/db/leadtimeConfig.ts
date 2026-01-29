import pg from 'pg';

const { Pool } = pg;

let leadtimePool: pg.Pool | null = null;

export const getLeadtimePool = (): pg.Pool => {
  if (!leadtimePool) {
    const connectionString = process.env.LT_DB_READONLY_CONNECTION_STRING;

    if (!connectionString) {
      throw new Error('LT_DB_READONLY_CONNECTION_STRING not configured');
    }

    leadtimePool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    leadtimePool.on('error', (err) => {
      console.error('Leadtime DB pool error:', err);
    });
  }

  return leadtimePool;
};

export const closeLeadtimePool = async () => {
  if (leadtimePool) {
    await leadtimePool.end();
    leadtimePool = null;
  }
};
