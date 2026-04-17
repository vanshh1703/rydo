const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://postgres:vansh123@localhost:5432/rydo_db' 
});

const hash = '$2b$10$0ge8g0COBzd5fXzIHlI6.eepf68JMUlsIfJ69UOZBpWiSarDwAUKu';
const email = 'admin@gmail.com';

pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, email])
  .then(() => {
    console.log('Admin password hash updated successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Update failed:', err);
    process.exit(1);
  });
