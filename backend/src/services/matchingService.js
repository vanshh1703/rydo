const db = require('../models/db');

/**
 * MatchingService handles the lifecycle of assigning a driver to a ride request.
 * Implements Wave-based matching to optimize for distance and availability.
 */
class MatchingService {
    static io = null;

    static init(ioInstance) {
        this.io = ioInstance;
    }

    /**
     * Starts the matching process for a new ride.
     */
    static async startMatching(ride) {
        if (!this.io) {
            console.error('MatchingService: Socket.io instance not initialized');
            return;
        }

        console.log(`Starting matching for ride ${ride.id} (${ride.vehicle_type})`);

        // Wave 1: Immediate proximity (2km)
        await this.notifyWave(ride, 2, 0);

        // Schedule Wave 2: Extended proximity (5km) after 20 seconds
        setTimeout(async () => {
            const currentRide = await db.query('SELECT status FROM rides WHERE id = $1', [ride.id]);
            if (currentRide.rows[0]?.status === 'requested') {
                console.log(`Wave 2 matching for ride ${ride.id} (5km)`);
                await this.notifyWave(ride, 5, 2); // 2km to 5km
            }
        }, 20000);

        // Schedule Wave 3: Wide proximity (10km) after 40 seconds
        setTimeout(async () => {
            const currentRide = await db.query('SELECT status FROM rides WHERE id = $1', [ride.id]);
            if (currentRide.rows[0]?.status === 'requested') {
                console.log(`Wave 3 matching for ride ${ride.id} (10km)`);
                await this.notifyWave(ride, 10, 5); // 5km to 10km
            }
        }, 40000);

        // Final Timeout: No drivers found after 60 seconds
        setTimeout(async () => {
            const currentRide = await db.query('SELECT status FROM rides WHERE id = $1', [ride.id]);
            if (currentRide.rows[0]?.status === 'requested') {
                console.log(`Matching timeout for ride ${ride.id}. No drivers found.`);
                
                await db.query("UPDATE rides SET status = 'cancelled' WHERE id = $1", [ride.id]);
                this.io.to(`ride_${ride.id}`).emit('ride-status-changed', { status: 'cancelled', message: 'No drivers available in your area.' });
            }
        }, 60000);
    }

    /**
     * Finds and notifies drivers within a specific radius wave.
     */
    static async notifyWave(ride, maxRadius, minRadius = 0) {
        try {
            const query = `
                SELECT id FROM drivers
                WHERE is_online = true 
                AND vehicle_type = $3
                AND (6371 * acos(
                    cos(radians($1)) * cos(radians(current_lat)) * 
                    cos(radians(current_lng) - radians($2)) + 
                    sin(radians($1)) * sin(radians(current_lat))
                )) <= $4
                AND (6371 * acos(
                    cos(radians($1)) * cos(radians(current_lat)) * 
                    cos(radians(current_lng) - radians($2)) + 
                    sin(radians($1)) * sin(radians(current_lat))
                )) > $5
            `;
            const result = await db.query(query, [
                ride.pickup_lat, 
                ride.pickup_lng, 
                ride.vehicle_type, 
                maxRadius, 
                minRadius
            ]);

            const drivers = result.rows;
            console.log(`Notifying ${drivers.length} drivers for ride ${ride.id} in wave ${maxRadius}km`);

            drivers.forEach(driver => {
                this.io.to(`driver_${driver.id}`).emit('ride-request-created', ride);
            });
        } catch (err) {
            console.error('MatchingService: notifyWave error:', err);
        }
    }
}

module.exports = MatchingService;
