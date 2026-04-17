const db = require('./src/models/db');

async function migrate() {
    console.log('🚀 Starting Razorpay Payment System migration...');
    try {

        // 1. Payments table (Razorpay inbound)
        await db.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                razorpay_order_id VARCHAR(100) UNIQUE,
                razorpay_payment_id VARCHAR(100) UNIQUE,
                razorpay_signature VARCHAR(255),
                amount DOUBLE PRECISION NOT NULL,
                currency VARCHAR(10) DEFAULT 'INR',
                status VARCHAR(20) DEFAULT 'created',
                method VARCHAR(20),
                webhook_received BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ payments table created');

        // 2. Driver payout methods (Bank/UPI)
        await db.query(`
            CREATE TABLE IF NOT EXISTS driver_payout_methods (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
                method_type VARCHAR(10) CHECK (method_type IN ('bank', 'upi')) NOT NULL,
                account_holder_name VARCHAR(100),
                account_number VARCHAR(50),
                ifsc_code VARCHAR(20),
                bank_name VARCHAR(100),
                upi_vpa VARCHAR(100),
                razorpay_fund_account_id VARCHAR(100),
                is_active BOOLEAN DEFAULT false,
                is_verified BOOLEAN DEFAULT false,
                cooldown_until TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ driver_payout_methods table created');

        // 3. Make withdrawals table production-grade
        await db.query(`
            ALTER TABLE withdrawal_requests
            ADD COLUMN IF NOT EXISTS razorpay_payout_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS payout_method VARCHAR(10),
            ADD COLUMN IF NOT EXISTS failure_reason TEXT,
            ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100) UNIQUE,
            ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;
        `);
        console.log('✅ withdrawal_requests table upgraded');

        // 4. Audit logs table
        await db.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                actor_id UUID,
                actor_role VARCHAR(20),
                action VARCHAR(100) NOT NULL,
                target_type VARCHAR(50),
                target_id UUID,
                metadata JSONB,
                ip_address VARCHAR(50),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ audit_logs table created');

        // 5. Settlement batches table
        await db.query(`
            CREATE TABLE IF NOT EXISTS settlement_batches (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                total_amount DOUBLE PRECISION NOT NULL,
                driver_count INTEGER NOT NULL,
                status VARCHAR(20) DEFAULT 'completed',
                batch_reference TEXT,
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ settlement_batches table created');

        // 6. Indexes
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_payments_ride ON payments(ride_id);
            CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
            CREATE INDEX IF NOT EXISTS idx_payout_methods_driver ON driver_payout_methods(driver_id, is_active);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
            CREATE INDEX IF NOT EXISTS idx_withdrawals_idempotency ON withdrawal_requests(idempotency_key);
        `);
        console.log('✅ Indexes created');

        console.log('\n🎉 Razorpay Payment System migration completed!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
