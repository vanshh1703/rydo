const db = require('../models/db');

/**
 * LedgerService handles all financial transactions for drivers.
 * Implements a double-entry ledger system to ensure data integrity.
 */
class LedgerService {
    /**
     * Records ride earnings and deducts commission if no active subscription.
     */
    static async recordRideCompletion(rideId, driverId, totalFare) {
        try {
            await db.query('BEGIN');

            // 1. Check for active zero-commission subscription
            const subRes = await db.query(
                "SELECT id FROM driver_subscriptions WHERE driver_id = $1 AND is_active = true AND end_time > NOW() LIMIT 1",
                [driverId]
            );
            const hasSubscription = subRes.rows.length > 0;

            // 2. Fetch default commission rate if no subscription
            let commissionRate = 0;
            if (!hasSubscription) {
                const configRes = await db.query("SELECT value FROM platform_configs WHERE key = 'default_commission_rate'");
                commissionRate = parseFloat(configRes.rows[0]?.value || 20);
            }

            const commissionAmount = (totalFare * commissionRate) / 100;
            const netEarnings = totalFare - commissionAmount;

            // 3. Get current balance for balance_after calculation
            const driverRes = await db.query('SELECT wallet_balance FROM drivers WHERE id = $1 FOR UPDATE', [driverId]);
            let currentBalance = parseFloat(driverRes.rows[0].wallet_balance);

            // 4. Record Main Earnings Entry
            const balanceAfterEarnings = currentBalance + totalFare;
            await db.query(
                `INSERT INTO wallet_ledger (driver_id, ride_id, amount, transaction_type, description, balance_after)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [driverId, rideId, totalFare, 'ride_earnings', `Earnings for ride #${rideId.slice(0,8)}`, balanceAfterEarnings]
            );

            // 5. Record Commission Deduction Entry (if any)
            let finalBalance = balanceAfterEarnings;
            if (commissionAmount > 0) {
                finalBalance = balanceAfterEarnings - commissionAmount;
                await db.query(
                    `INSERT INTO wallet_ledger (driver_id, ride_id, amount, transaction_type, description, balance_after)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [driverId, rideId, -commissionAmount, 'platform_commission', `Commission deduction (${commissionRate}%)`, finalBalance]
                );
            }

            // 6. Update cached balance in drivers table
            await db.query(
                'UPDATE drivers SET wallet_balance = $1, total_earnings = total_earnings + $2 WHERE id = $3',
                [finalBalance, netEarnings, driverId]
            );

            await db.query('COMMIT');
            return { success: true, netEarnings, commissionAmount };
        } catch (err) {
            await db.query('ROLLBACK');
            console.error('Ledger error in recordRideCompletion:', err);
            throw err;
        }
    }

    /**
     * Records a withdrawal and updates ledger.
     */
    static async recordWithdrawal(driverId, amount, requestId) {
         try {
            await db.query('BEGIN');

            const driverRes = await db.query('SELECT wallet_balance FROM drivers WHERE id = $1 FOR UPDATE', [driverId]);
            const currentBalance = parseFloat(driverRes.rows[0].wallet_balance);
            const newBalance = currentBalance - amount;

            await db.query(
                `INSERT INTO wallet_ledger (driver_id, amount, transaction_type, description, balance_after)
                 VALUES ($1, $2, $3, $4, $5)`,
                [driverId, -amount, 'withdrawal', `Payout for request #${requestId.slice(0,8)}`, newBalance]
            );

            await db.query('UPDATE drivers SET wallet_balance = $1 WHERE id = $2', [newBalance, driverId]);

            await db.query('COMMIT');
            return true;
         } catch (err) {
            await db.query('ROLLBACK');
            throw err;
         }
    }

    /**
     * Deducts subscription fee and activates plan.
     */
    static async purchaseSubscription(driverId, planType, price) {
        try {
            await db.query('BEGIN');

            const driverRes = await db.query('SELECT wallet_balance FROM drivers WHERE id = $1 FOR UPDATE', [driverId]);
            const currentBalance = parseFloat(driverRes.rows[0].wallet_balance);

            if (currentBalance < price) {
                throw new Error('Insufficient balance to purchase subscription');
            }

            const newBalance = currentBalance - price;

            // 1. Add ledger entry
            await db.query(
                `INSERT INTO wallet_ledger (driver_id, amount, transaction_type, description, balance_after)
                 VALUES ($1, $2, $3, $4, $5)`,
                [driverId, -price, 'subscription_fee', `Purchase of ${planType} plan`, newBalance]
            );

            // 2. Update driver balance
            await db.query('UPDATE drivers SET wallet_balance = $1 WHERE id = $2', [newBalance, driverId]);

            // 3. Create/Update subscription
            // Deactivate existing
            await db.query('UPDATE driver_subscriptions SET is_active = false WHERE driver_id = $1', [driverId]);
            
            // Add new (24 hours for daily plan)
            const endTime = new Date();
            endTime.setHours(endTime.getHours() + 24);

            await db.query(
                `INSERT INTO driver_subscriptions (driver_id, plan_type, price, end_time, is_active)
                 VALUES ($1, $2, $3, $4, true)`,
                [driverId, planType, price, endTime]
            );

            await db.query('COMMIT');
            return true;
        } catch (err) {
            await db.query('ROLLBACK');
            throw err;
        }
    }
}

module.exports = LedgerService;
