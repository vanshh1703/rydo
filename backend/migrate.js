const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function migrate() {
  console.log('--- Database Migration Started ---');
  const client = await pool.connect();
  try {
    console.log('1. Adding vehicle_type...');
    await client.query('ALTER TABLE rides ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(50)');
    
    console.log('2. Adding payment_method...');
    await client.query('ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT \'cash\'');
    
    console.log('3. Adding payment_status...');
    await client.query('ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT \'pending\'');
    
    console.log('4. Adding address columns...');
    await client.query('ALTER TABLE rides ADD COLUMN IF NOT EXISTS pickup_address TEXT');
    await client.query('ALTER TABLE rides ADD COLUMN IF NOT EXISTS drop_address TEXT');
    
    console.log('5. Cleaning up stuck rides...');
    await client.query('UPDATE rides SET status = \'cancelled\' WHERE status = \'requested\'');
    
    console.log('--- Migration Completed Successfully! ---');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
