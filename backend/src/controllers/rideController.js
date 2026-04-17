const db = require('../models/db');

// Simple Haversine for distance if needed, but for now we trust the client for simple fare calc
// or implement simple Euclidean distance on map coords for matching.

const createRide = async (req, res) => {
  const { pickup_lat, pickup_lng, drop_lat, drop_lng, distance_km, fare, vehicleType, paymentMethod, pickup_address, drop_address } = req.body;
  const user_id = req.user.id;

  try {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const result = await db.query(
      'INSERT INTO rides (user_id, pickup_lat, pickup_lng, drop_lat, drop_lng, distance_km, fare, status, vehicle_type, payment_method, payment_status, pickup_address, drop_address, otp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *',
      [user_id, pickup_lat, pickup_lng, drop_lat, drop_lng, distance_km, fare, 'requested', vehicleType, paymentMethod || 'cash', paymentMethod === 'cash' ? 'n/a' : 'pending', pickup_address, drop_address, otp]
    );

    const ride = result.rows[0];

    // Fetch user name to include in broadcast
    const userResult = await db.query('SELECT name FROM users WHERE id = $1', [user_id]);
    const rideWithUser = { ...ride, rider_name: userResult.rows[0]?.name || 'Valued Customer' };

    // Start Matching Engine (Wave-based)
    const MatchingService = require('../services/matchingService');
    await MatchingService.startMatching(rideWithUser);

    res.status(201).json(rideWithUser);
  } catch (error) {
    console.error('Create ride error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getHistory = async (req, res) => {
  const { id, role, driverId } = req.user;
  try {
    let query;
    let param;
    if (role === 'driver') {
      query = 'SELECT * FROM rides WHERE driver_id = $1 ORDER BY created_at DESC';
      param = driverId;
    } else {
      query = 'SELECT * FROM rides WHERE user_id = $1 ORDER BY created_at DESC';
      param = id;
    }
    const result = await db.query(query, [param]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateStatus = async (req, res) => {
  const { rideId, status } = req.body;
  const { driverId } = req.user;

  try {
    if (status === 'started') {
      const { otp } = req.body;
      const rideCheck = await db.query('SELECT otp FROM rides WHERE id = $1', [rideId]);
      if (rideCheck.rows[0]?.otp !== otp) {
        return res.status(400).json({ message: 'Invalid verification OTP. Please ask the passenger for the correct PIN.' });
      }
    }

    const result = await db.query(
      'UPDATE rides SET status = $1 WHERE id = $2 AND driver_id = $3 RETURNING *',
      [status, rideId, driverId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ride not found or not assigned to you' });
    }

    const updatedRide = result.rows[0];

    // Financial update on completion
    if (status === 'completed') {
      try {
        const ledgerService = require('../services/ledgerService');
        await ledgerService.recordRideCompletion(updatedRide.id, driverId, updatedRide.fare);
        console.log(`Driver ${driverId} wallet ledger entry created for ₹${updatedRide.fare}`);
      } catch (err) {
        console.error('Failed to update driver wallet ledger:', err);
      }
    }

    // Notify the rider via Socket.io
    const io = req.app.get('io');
    if (io) {
      const roomName = `ride_${rideId}`;
      console.log(`Sending status update [${status}] to room: ${roomName}`);
      io.to(roomName).emit('ride-status-changed', { status });
    }

    res.json(updatedRide);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getActiveRide = async (req, res) => {
  const { id, role, driverId } = req.user;
  try {
    let query;
    if (role === 'driver') {
      query = `
        SELECT r.*, u.name as rider_name 
        FROM rides r 
        LEFT JOIN users u ON r.user_id = u.id
        WHERE r.driver_id = $1 AND r.status NOT IN ('completed', 'cancelled') 
        ORDER BY r.created_at DESC
        LIMIT 1
      `;
      const result = await db.query(query, [driverId]);
      console.log(`Restoring active ride for driver ${driverId}:`, result.rows[0] ? result.rows[0].id : 'None');
      return res.json(result.rows[0] || null);
    } else {
      query = `
        SELECT r.*, u.name as driver_name, u.phone as driver_phone, d.rating_avg, d.rating_count
        FROM rides r
        LEFT JOIN drivers d ON r.driver_id = d.id
        LEFT JOIN users u ON d.user_id = u.id
        WHERE r.user_id = $1 AND r.status NOT IN ('completed', 'cancelled')
        ORDER BY r.created_at DESC LIMIT 1
      `;
      const result = await db.query(query, [id]);
      console.log(`Restoring active ride for user ${id}:`, result.rows[0] ? result.rows[0].id : 'None');
      return res.json(result.rows[0] || null);
    }
  } catch (error) {
    console.error('Get active ride error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getDriverStats = async (req, res) => {
  const { id } = req.user;
  let driverId = req.user.driverId;

  try {
    if (!driverId && req.user.role === 'driver') {
      const d = await db.query('SELECT id FROM drivers WHERE user_id = $1', [id]);
      driverId = d.rows[0]?.id;
    }

    if (!driverId) {
      return res.status(400).json({ message: 'Driver profile not found' });
    }

    console.log('Fetching stats for driverId:', driverId);
    const statsResult = await db.query(
      'SELECT SUM(fare) as total_earnings, COUNT(*) as total_rides FROM rides WHERE driver_id = $1 AND status = $2',
      [driverId, 'completed']
    );

    const todayStats = await db.query(
      "SELECT SUM(fare) as today_earnings FROM rides WHERE driver_id = $1 AND status = $2 AND created_at >= CURRENT_DATE",
      [driverId, 'completed']
    );

    const driverResult = await db.query(
      'SELECT is_online, rating_avg, rating_count, wallet_balance, total_earnings FROM drivers WHERE id = $1',
      [driverId]
    );

    res.json({
      total_rides: parseInt(statsResult.rows[0]?.total_rides) || 0,
      total_earnings: parseFloat(statsResult.rows[0]?.total_earnings) || 0,
      today_earnings: parseFloat(todayStats.rows[0]?.today_earnings) || 0,
      wallet_balance: parseFloat(driverResult.rows[0]?.wallet_balance) || 0,
      is_online: driverResult.rows[0]?.is_online || false,
      rating_avg: driverResult.rows[0]?.rating_avg || 5.0,
      rating_count: driverResult.rows[0]?.rating_count || 0
    });
  } catch (error) {
    console.error('Get driver stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateDriverStatus = async (req, res) => {
  const { isOnline } = req.body;
  const { driverId } = req.user;

  try {
    const result = await db.query(
      'UPDATE drivers SET is_online = $1 WHERE id = $2 RETURNING *',
      [isOnline, driverId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update driver status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const cancelRide = async (req, res) => {
  const { rideId } = req.body;
  const { id: userId, role, driverId } = req.user;

  console.log(`Cancellation attempt by ${role} ${userId} for ride ${rideId}`);

  try {
    let result;
    if (role === 'driver') {
      // Driver cancels an accepted or arrived ride
      result = await db.query(
        "UPDATE rides SET status = 'cancelled' WHERE id = $1 AND driver_id = $2 AND status IN ('accepted', 'arrived') RETURNING *",
        [rideId, driverId]
      );
    } else {
      // Rider cancels a requested, accepted, or arrived ride
      result = await db.query(
        "UPDATE rides SET status = 'cancelled' WHERE id = $1 AND user_id = $2 AND status IN ('requested', 'accepted', 'arrived') RETURNING *",
        [rideId, userId]
      );
    }

    if (result.rows.length === 0) {
      console.warn(`Cancellation failed: No matching ride found or status not requested/accepted. RideId: ${rideId}, Role: ${role}`);
      return res.status(404).json({ message: 'Ride not found, already started, or unauthorized' });
    }

    const cancelledRide = result.rows[0];
    const io = req.app.get('io');

    if (io) {
      if (role === 'driver') {
        // Notify the rider
        io.to(`ride_${rideId}`).emit('ride-cancelled-by-driver', { rideId });
      } else {
        // Notify the driver if one was assigned
        if (cancelledRide.driver_id) {
          io.to(`driver_${cancelledRide.driver_id}`).emit('ride-cancelled-by-rider', { rideId });
        }
      }
    }

    res.json({ message: 'Ride cancelled successfully' });
  } catch (error) {
    console.error('Cancel ride error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const confirmRidePayment = async (req, res) => {
  const { rideId, paymentId } = req.body;
  try {
    await db.query(
      "UPDATE rides SET payment_status = 'completed' WHERE id = $1",
      [rideId]
    );

    // Broadcast to the ride room so the driver and rider get real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(`ride_${rideId}`).emit('payment-received', { rideId, status: 'completed' });
    }

    res.json({ message: 'Payment confirmed in database' });
  } catch (error) {
    console.error('Payment confirm error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getNearbyDrivers = async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ message: 'Missing coordinates' });

  try {
    // Haversine formula in SQL to find drivers within 7km, grouped by vehicle_type
    const query = `
      SELECT vehicle_type, count(*) as count
      FROM drivers
      WHERE is_online = true 
      AND (6371 * acos(
        cos(radians($1)) * cos(radians(current_lat)) * 
        cos(radians(current_lng) - radians($2)) + 
        sin(radians($1)) * sin(radians(current_lat))
      )) <= 7
      GROUP BY vehicle_type
    `;
    const result = await db.query(query, [lat, lng]);
    
    // Convert array of rows to an object mapping type -> count
    const counts = {};
    result.rows.forEach(row => {
      counts[row.vehicle_type] = parseInt(row.count);
    });

    res.json({ counts });
  } catch (error) {
    console.error('Get nearby drivers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const rateRide = async (req, res) => {
  const { rideId, rating } = req.body;
  if (!rideId || !rating) return res.status(400).json({ message: 'Missing fields' });

  try {
    const ride = await db.query('SELECT driver_id, rating FROM rides WHERE id = $1', [rideId]);
    if (!ride.rows.length) return res.status(404).json({ message: 'Ride not found' });
    if (ride.rows[0].rating) return res.status(400).json({ message: 'Already rated' });

    const driverId = ride.rows[0].driver_id;
    if (!driverId) return res.status(400).json({ message: 'No driver to rate' });

    await db.query('BEGIN');
    
    // 1. Update ride rating
    await db.query('UPDATE rides SET rating = $1 WHERE id = $2', [rating, rideId]);

    // 2. Fetch current driver stats
    const driverRes = await db.query('SELECT rating_avg, rating_count FROM drivers WHERE id = $1', [driverId]);
    const currentAvg = parseFloat(driverRes.rows[0].rating_avg || 0);
    const currentCount = parseInt(driverRes.rows[0].rating_count || 0);

    // 3. Calculate new stats
    const newCount = currentCount + 1;
    const newAvg = ((currentAvg * currentCount) + rating) / newCount;

    // 4. Update driver
    await db.query('UPDATE drivers SET rating_avg = $1, rating_count = $2 WHERE id = $3', [newAvg.toFixed(2), newCount, driverId]);

    await db.query('COMMIT');
    res.json({ message: 'Rating submitted successfully', newAvg });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Rate ride error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createRide, getHistory, updateStatus, getActiveRide, getDriverStats, cancelRide, updateDriverStatus, confirmRidePayment, getNearbyDrivers, rateRide };
