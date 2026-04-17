const db = require('./src/models/db');

async function migrate() {
    console.log('🚀 Starting production migration...');

    try {
        // 1. Add is_blacklisted and subscription_expiry to drivers
        await db.query(`
            ALTER TABLE drivers
            ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS subscription_expiry TIMESTAMP WITH TIME ZONE;
        `);
        console.log('✅ drivers table: added is_blacklisted, subscription_expiry');

        // 2. Add vehicle_type, payment_method, payment_status, otp, rating to rides
        await db.query(`
            ALTER TABLE rides
            ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(20),
            ADD COLUMN IF NOT EXISTS payment_method VARCHAR(10) DEFAULT 'cash',
            ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS otp CHAR(4),
            ADD COLUMN IF NOT EXISTS rating INT,
            ADD COLUMN IF NOT EXISTS commission_deducted DOUBLE PRECISION DEFAULT 0,
            ADD COLUMN IF NOT EXISTS net_driver_earnings DOUBLE PRECISION DEFAULT 0,
            ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
            ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(10),
            ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
        `);
        console.log('✅ rides table: added vehicle_type, otp, payment columns, rating');

        // 3. Create wallet_ledger table
        await db.query(`
            CREATE TABLE IF NOT EXISTS wallet_ledger (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
                ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
                amount DOUBLE PRECISION NOT NULL,
                transaction_type VARCHAR(50) NOT NULL,
                description TEXT,
                balance_after DOUBLE PRECISION NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ wallet_ledger table created');

        // 4. Create driver_subscriptions table
        await db.query(`
            CREATE TABLE IF NOT EXISTS driver_subscriptions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
                plan_type VARCHAR(50) DEFAULT 'daily_zero_commission',
                price DOUBLE PRECISION NOT NULL,
                start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                end_time TIMESTAMP WITH TIME ZONE NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ driver_subscriptions table created');

        // 5. Create platform_configs table
        await db.query(`
            CREATE TABLE IF NOT EXISTS platform_configs (
                key VARCHAR(50) PRIMARY KEY,
                value TEXT NOT NULL,
                description TEXT,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ platform_configs table created');

        // 6. Seed default configs (safe to run multiple times)
        await db.query(`
            INSERT INTO platform_configs (key, value, description) VALUES 
            ('commission_rate', '20', 'Platform commission percentage per ride'),
            ('daily_sub_price', '100', 'Price for one day of zero commission'),
            ('matching_wave1_km', '2', 'Wave 1 matching radius in km'),
            ('matching_wave2_km', '5', 'Wave 2 matching radius in km'),
            ('matching_timeout_sec', '60', 'Seconds before auto-cancelling a ride with no driver')
            ON CONFLICT (key) DO NOTHING;
        `);
        console.log('✅ platform_configs seeded with defaults');

        // 7. Add indexes for performance
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_ledger_driver ON wallet_ledger(driver_id);
            CREATE INDEX IF NOT EXISTS idx_ledger_ride ON wallet_ledger(ride_id);
            CREATE INDEX IF NOT EXISTS idx_sub_driver_active ON driver_subscriptions(driver_id, is_active);
            CREATE INDEX IF NOT EXISTS idx_drivers_online ON drivers(is_online, is_blacklisted);
        `);
        console.log('✅ Performance indexes created');

        console.log('\n🎉 Production migration completed successfully!');
        console.log('New tables: wallet_ledger, driver_subscriptions, platform_configs');
        console.log('Updated tables: drivers (is_blacklisted), rides (otp, vehicle_type, etc.)');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
