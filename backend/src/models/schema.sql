-- Schema for Rydo Database

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('user', 'driver')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(50) NOT NULL,
    is_online BOOLEAN DEFAULT FALSE,
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    wallet_balance DOUBLE PRECISION DEFAULT 0,
    total_earnings DOUBLE PRECISION DEFAULT 0,
    rating_avg DECIMAL(3,2) DEFAULT 5.0,
    rating_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rides table
CREATE TABLE IF NOT EXISTS rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    pickup_lat DOUBLE PRECISION NOT NULL,
    pickup_lng DOUBLE PRECISION NOT NULL,
    drop_lat DOUBLE PRECISION NOT NULL,
    drop_lng DOUBLE PRECISION NOT NULL,
    pickup_address TEXT,
    drop_address TEXT,
    distance_km DOUBLE PRECISION,
    fare DOUBLE PRECISION,
    status VARCHAR(20) CHECK (status IN ('requested', 'accepted', 'arrived', 'started', 'completed', 'cancelled')) DEFAULT 'requested',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ride requests table (for matching logic)
CREATE TABLE IF NOT EXISTS ride_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    status VARCHAR(20) CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for spatial queries (optional but good practice)
-- If using PostGIS, we'd use GEOGRAPHY type, but for simplicity we use lat/lng.
CREATE INDEX idx_drivers_lat_lng ON drivers (current_lat, current_lng);

-- Withdrawal requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    amount DOUBLE PRECISION NOT NULL,
    status VARCHAR(20) CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Settlements table (Evening batch settlements)
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_amount DOUBLE PRECISION NOT NULL,
    driver_count INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Financial Engine (Double-Entry Ledger)
CREATE TABLE IF NOT EXISTS wallet_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
    amount DOUBLE PRECISION NOT NULL, -- Positive for Credit, Negative for Debit
    transaction_type VARCHAR(50) NOT NULL, -- 'ride_earnings', 'platform_commission', 'subscription_fee', 'withdrawal', 'manual_adjustment'
    description TEXT,
    balance_after DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Driver Subscriptions
CREATE TABLE IF NOT EXISTS driver_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    plan_type VARCHAR(50) DEFAULT 'unlimited_zero_commission',
    price DOUBLE PRECISION NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Platform Configurations
CREATE TABLE IF NOT EXISTS platform_configs (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Initialize default configs
INSERT INTO platform_configs (key, value, description) VALUES 
('default_commission_rate', '20', 'Platform commission percentage (0-100)'),
('daily_subscription_price', '100', 'Price for one day of zero commission')
ON CONFLICT (key) DO NOTHING;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_ledger_driver_id ON wallet_ledger(driver_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_driver_active ON driver_subscriptions(driver_id, is_active);
