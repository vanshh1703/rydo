const db = require('../models/db');

const setupRideSockets = (io) => {
  io.on('connection', (socket) => {
    // Driver updates location
    socket.on('driver-location-update', async (data) => {
      const { driverId, lat, lng } = data;
      try {
        await db.query(
          'UPDATE drivers SET current_lat = $1, current_lng = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
          [lat, lng, driverId]
        );
        // Broadcast location to any users tracking this driver's ride
        // We broadcast to the ride_ID room which includes the rider
        const rideRes = await db.query('SELECT id FROM rides WHERE driver_id = $1 AND status IN (' + "'accepted', 'arrived', 'started'" + ') LIMIT 1', [driverId]);
        if (rideRes.rows.length > 0) {
          io.to(`ride_${rideRes.rows[0].id}`).emit('live-ride-tracking', { lat, lng });
        }
      } catch (err) {
        console.error('Error updating driver location:', err);
      }
    });

    // Accept ride request
    socket.on('ride-request-response', async (data) => {
      const { rideId, driverId, status } = data;
      if (status === 'accepted') {
        try {
          // Transaction to assign driver
          await db.query('BEGIN');
          
          const rideCheck = await db.query('SELECT status FROM rides WHERE id = $1', [rideId]);
          if (rideCheck.rows[0].status !== 'requested') {
            await db.query('ROLLBACK');
            socket.emit('error', 'Ride no longer available');
            return;
          }

          await db.query(
            'UPDATE rides SET driver_id = $1, status = $2 WHERE id = $3',
            [driverId, 'accepted', rideId]
          );
          
          await db.query('COMMIT');

          // Fetch driver details to send to rider
          const driverDetails = await db.query(`
            SELECT u.name as driver_name, u.phone as driver_phone, d.rating_avg, d.rating_count
            FROM drivers d
            JOIN users u ON d.user_id = u.id
            WHERE d.id = $1
          `, [driverId]);

          // Notify user and other drivers
          io.to(`ride_${rideId}`).emit('ride-status-changed', { 
            status: 'accepted', 
            driverId,
            driver: driverDetails.rows[0]
          });
          io.emit('ride-assigned', { rideId }); // Global notification to clear requests for other drivers
        } catch (err) {
          await db.query('ROLLBACK');
          console.error('Error accepting ride:', err);
        }
      }
    });

    // Room management
    socket.on('join-driver', (driverId) => {
      socket.join(`driver_${driverId}`);
      console.log(`Driver ${driverId} joined their notification room`);
    });

    socket.on('payment-confirmed', (data) => {
      const { rideId } = data;
      console.log(`Payment confirmed for ride: ${rideId}`);
      // Notify everyone in the ride room (includes driver if they track-ride)
      io.to(`ride_${rideId}`).emit('payment-received', { rideId, status: 'completed' });
    });

    socket.on('track-ride', (rideId) => {
      socket.join(`ride_${rideId}`);
      console.log(`Socket joined tracking room for ride ${rideId}`);
    });
  });
};

module.exports = setupRideSockets;
