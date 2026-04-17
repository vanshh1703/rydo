const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const setupDatabase = async () => {
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: 'postgres', // Connect to default postgres to create our db if needed
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL server');

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'rydo_db';
    const checkDb = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${dbName}'`);
    
    if (checkDb.rows.length === 0) {
      console.log(`Creating database: ${dbName}...`);
      await client.query(`CREATE DATABASE ${dbName}`);
    } else {
      console.log(`Database ${dbName} already exists.`);
    }
    await client.end();

    // Now connect to the new database to run schema
    const dbClient = new Client({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: dbName,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 5432,
    });

    await dbClient.connect();
    console.log(`Connected to database: ${dbName}`);

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running schema.sql...');
    await dbClient.query(schema);
    console.log('Database setup complete! 🎉');

    await dbClient.end();
    process.exit(0);
  } catch (err) {
    console.error('Error during database setup:', err);
    process.exit(1);
  }
};

setupDatabase();
