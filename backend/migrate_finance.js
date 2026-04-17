const db = require('./src/models/db');

async function migrate() {
    try {
        console.log('Starting migration...');
        
        // Add columns to drivers if they don't exist
        await db.query(`
            ALTER TABLE drivers 
            ADD COLUMN IF NOT EXISTS wallet_balance DOUBLE PRECISION DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_earnings DOUBLE PRECISION DEFAULT 0,
            ADD COLUMN IF NOT EXISTS rating_avg DECIMAL(3,2) DEFAULT 5.0,
            ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;
        `);
        console.log('Drivers table updated.');

        // Create withdrawal_requests
        await db.query(`
            CREATE TABLE IF NOT EXISTS withdrawal_requests (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
                amount DOUBLE PRECISION NOT NULL,
                status VARCHAR(20) CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Withdrawal requests table created.');

        // Create settlements
        await db.query(`
            CREATE TABLE IF NOT EXISTS settlements (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                total_amount DOUBLE PRECISION NOT NULL,
                driver_count INTEGER NOT NULL,
                status VARCHAR(20) DEFAULT 'completed',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Settlements table created.');

        console.log('Migration completed successfully! 🎉');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
