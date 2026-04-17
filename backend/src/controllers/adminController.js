const db = require('../models/db');

const getPlatformStats = async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*)::INT as total_rides,
        COUNT(*) FILTER (WHERE status = 'completed')::INT as completed_rides,
        COUNT(*) FILTER (WHERE status = 'cancelled')::INT as cancelled_rides,
        COALESCE(SUM(fare) FILTER (WHERE status = 'completed'), 0)::FLOAT as total_earnings
      FROM rides
    `);
    
    const driverCount = await db.query('SELECT COUNT(*) FROM drivers');
    const userCount = await db.query("SELECT COUNT(*) FROM users WHERE role = 'user'");

    res.json({
      ...stats.rows[0],
      total_drivers: parseInt(driverCount.rows[0].count) || 0,
      total_users: parseInt(userCount.rows[0].count) || 0
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const getDriverDirectory = async (req, res) => {
  try {
    const drivers = await db.query(`
      SELECT 
        d.id,
        u.name as driver_name,
        u.phone as driver_phone,
        d.vehicle_type,
        d.rating_avg,
        d.rating_count,
        COUNT(r.id) FILTER (WHERE r.status = 'completed')::INT as rides_completed,
        COUNT(r.id) FILTER (WHERE r.status = 'cancelled')::INT as rides_cancelled,
        COALESCE(SUM(r.fare) FILTER (WHERE r.status = 'completed'), 0)::FLOAT as total_earnings
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN rides r ON d.id = r.driver_id
      GROUP BY d.id, u.name, u.phone, d.vehicle_type, d.rating_avg, d.rating_count
      ORDER BY d.rating_avg DESC
    `);

    res.json(drivers.rows);
  } catch (err) {
    console.error('Admin driver directory error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const blacklistDriver = async (req, res) => {
  const { driverId, blacklisted } = req.body;
  try {
    await db.query(
      'UPDATE drivers SET is_blacklisted = $1 WHERE id = $2',
      [blacklisted, driverId]
    );
    const action = blacklisted ? 'blacklisted' : 'reinstated';
    res.json({ message: `Driver ${action} successfully` });
  } catch (err) {
    console.error('Blacklist driver error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getPlatformStats, getDriverDirectory, blacklistDriver };
