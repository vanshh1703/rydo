const db = require('../models/db');
const razorpayService = require('../services/razorpayService');

/**
 * Driver: Add a new payout method (Bank or UPI).
 * Enforces one active method + cooldown after change.
 */
const addPayoutMethod = async (req, res) => {
    const { driverId } = req.user;
    const { method_type, account_holder_name, account_number, ifsc_code, bank_name, upi_vpa } = req.body;

    if (!['bank', 'upi'].includes(method_type)) {
        return res.status(400).json({ message: 'Invalid method type. Use "bank" or "upi"' });
    }
    if (method_type === 'bank' && (!account_holder_name || !account_number || !ifsc_code)) {
        return res.status(400).json({ message: 'Bank details incomplete' });
    }
    if (method_type === 'upi' && !upi_vpa) {
        return res.status(400).json({ message: 'UPI VPA required' });
    }

    try {
        // Check for pending withdrawals before allowing update
        const pendingRes = await db.query(
            "SELECT id FROM withdrawal_requests WHERE driver_id = $1 AND status = 'pending'",
            [driverId]
        );
        if (pendingRes.rows.length > 0) {
            return res.status(400).json({ message: 'Cannot change payout method while a withdrawal is pending' });
        }

        // Create Razorpay Fund Account
        let fundAccountId = null;
        try {
            fundAccountId = await razorpayService.createFundAccount({
                driver_id: driverId,
                method_type,
                account_holder_name,
                account_number,
                ifsc_code,
                upi_vpa,
            });
        } catch (razorErr) {
            console.warn('Razorpay fund account creation skipped (test mode):', razorErr.message);
        }

        await db.query('BEGIN');

        // Deactivate existing methods
        await db.query('UPDATE driver_payout_methods SET is_active = false WHERE driver_id = $1', [driverId]);

        // Set cooldown (48 hours security window)
        const cooldownUntil = new Date(Date.now() + 48 * 60 * 60 * 1000);

        // Insert new method as active
        const result = await db.query(
            `INSERT INTO driver_payout_methods 
             (driver_id, method_type, account_holder_name, account_number, ifsc_code, bank_name, upi_vpa, razorpay_fund_account_id, is_active, is_verified, cooldown_until)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10) RETURNING id`,
            [driverId, method_type, account_holder_name, account_number, ifsc_code, bank_name, upi_vpa, fundAccountId, !!fundAccountId, cooldownUntil]
        );

        // Audit log
        await db.query(
            `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
             VALUES ($1, 'driver', 'payout_method_added', 'driver_payout_methods', $2, $3)`,
            [req.user.id, result.rows[0].id, JSON.stringify({ method_type })]
        );

        await db.query('COMMIT');
        res.status(201).json({ message: 'Payout method added successfully', cooldownUntil });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Add payout method error:', err);
        res.status(500).json({ message: 'Failed to add payout method' });
    }
};

/**
 * Driver: Get their saved payout methods.
 */
const getPayoutMethods = async (req, res) => {
    const { driverId } = req.user;
    try {
        const result = await db.query(
            `SELECT id, method_type, account_holder_name,
             LEFT(account_number, 4) || '****' || RIGHT(account_number, 4) AS masked_account,
             ifsc_code, bank_name, upi_vpa, is_active, is_verified, cooldown_until, created_at
             FROM driver_payout_methods WHERE driver_id = $1 ORDER BY created_at DESC`,
            [driverId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get payout methods error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Driver: Set a specific method as active.
 */
const setActiveMethod = async (req, res) => {
    const { driverId } = req.user;
    const { methodId } = req.body;
    try {
        // Verify ownership
        const check = await db.query('SELECT id FROM driver_payout_methods WHERE id = $1 AND driver_id = $2', [methodId, driverId]);
        if (!check.rows[0]) return res.status(404).json({ message: 'Payout method not found' });

        await db.query('UPDATE driver_payout_methods SET is_active = false WHERE driver_id = $1', [driverId]);
        await db.query('UPDATE driver_payout_methods SET is_active = true WHERE id = $1', [methodId]);

        res.json({ message: 'Active payout method updated' });
    } catch (err) {
        console.error('Set active method error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { addPayoutMethod, getPayoutMethods, setActiveMethod };
