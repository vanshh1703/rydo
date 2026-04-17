const db = require('../models/db');
const razorpayService = require('../services/razorpayService');
const { v4: uuidv4 } = require('crypto').webcrypto ? require('crypto') : { v4: () => require('crypto').randomUUID() };

// Driver: Request early withdrawal
const requestWithdrawal = async (req, res) => {
    const { amount } = req.body;
    const { id } = req.user;
    let driverId = req.user.driverId;

    try {
        if (!driverId) {
            const d = await db.query('SELECT id FROM drivers WHERE user_id = $1', [id]);
            driverId = d.rows[0]?.id;
        }

        if (!driverId) {
            return res.status(400).json({ message: 'Driver profile not found' });
        }
        const driverRes = await db.query('SELECT wallet_balance FROM drivers WHERE id = $1', [driverId]);
        const balance = driverRes.rows[0]?.wallet_balance || 0;

        if (amount > balance) {
            return res.status(400).json({ message: 'Insufficient balance for this withdrawal' });
        }

        if (amount <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        const result = await db.query(
            'INSERT INTO withdrawal_requests (driver_id, amount, status) VALUES ($1, $2, $3) RETURNING *',
            [driverId, amount, 'pending']
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Request withdrawal error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Driver: Get withdrawal history
const getWithdrawalHistory = async (req, res) => {
    const { id } = req.user;
    let driverId = req.user.driverId;
    try {
        if (!driverId) {
            const d = await db.query('SELECT id FROM drivers WHERE user_id = $1', [id]);
            driverId = d.rows[0]?.id;
        }

        if (!driverId) {
            return res.status(400).json({ message: 'Driver profile not found' });
        }
        const result = await db.query(
            'SELECT * FROM withdrawal_requests WHERE driver_id = $1 ORDER BY created_at DESC',
            [driverId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get withdrawal history error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin: Get all drivers with pending settlements (non-zero balance)
const getPendingSettlements = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT d.id, u.name as driver_name, u.phone as driver_phone, d.wallet_balance
            FROM drivers d
            JOIN users u ON d.user_id = u.id
            WHERE d.wallet_balance > 0
            ORDER BY d.wallet_balance DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Get pending settlements error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin: Process all settlements (The "Evening Settlement")
const processBatchSettlement = async (req, res) => {
    try {
        await db.query('BEGIN');

        // Calculate totals
        const stats = await db.query('SELECT SUM(wallet_balance) as total, COUNT(*) as count FROM drivers WHERE wallet_balance > 0');
        const totalAmount = stats.rows[0].total || 0;
        const driverCount = stats.rows[0].count || 0;

        if (totalAmount === 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: 'No pending settlements found' });
        }

        // Reset all balances
        await db.query('UPDATE drivers SET wallet_balance = 0 WHERE wallet_balance > 0');

        // Log settlement
        const result = await db.query(
            'INSERT INTO settlements (total_amount, driver_count, status) VALUES ($1, $2, $3) RETURNING *',
            [totalAmount, driverCount, 'completed']
        );

        await db.query('COMMIT');
        res.json({ message: 'Batch settlement processed successfully', settlement: result.rows[0] });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Process batch settlement error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin: Get all early withdrawal requests
const getWithdrawalRequests = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT wr.*, u.name as driver_name, u.phone as driver_phone, d.wallet_balance as current_balance
            FROM withdrawal_requests wr
            JOIN drivers d ON wr.driver_id = d.id
            JOIN users u ON d.user_id = u.id
            WHERE wr.status = 'pending'
            ORDER BY wr.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Get withdrawal requests error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin: Approve/Reject withdrawal request with Razorpay payout
const handleWithdrawalRequest = async (req, res) => {
    const { requestId, status } = req.body;
    const adminId = req.user.id;

    try {
        await db.query('BEGIN');

        const requestRes = await db.query('SELECT * FROM withdrawal_requests WHERE id = $1 FOR UPDATE', [requestId]);
        if (!requestRes.rows[0]) {
            await db.query('ROLLBACK');
            return res.status(404).json({ message: 'Request not found' });
        }

        const request = requestRes.rows[0];
        if (request.status !== 'pending') {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: 'Request already processed' });
        }

        if (status === 'rejected') {
            await db.query(
                "UPDATE withdrawal_requests SET status = 'rejected', processed_at = NOW() WHERE id = $1",
                [requestId]
            );
            await db.query('COMMIT');
            return res.json({ message: 'Request rejected' });
        }

        // APPROVED: Fetch driver's active payout method
        const methodRes = await db.query(
            'SELECT * FROM driver_payout_methods WHERE driver_id = $1 AND is_active = true LIMIT 1',
            [request.driver_id]
        );
        if (!methodRes.rows[0]) {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: 'Driver has no active payout method' });
        }

        const method = methodRes.rows[0];

        // Security: Enforce cooldown period
        if (method.cooldown_until && new Date(method.cooldown_until) > new Date()) {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: `Payout method is in cooldown until ${method.cooldown_until}` });
        }

        // Deduct balance via ledger
        const ledgerService = require('../services/ledgerService');
        await ledgerService.recordWithdrawal(request.driver_id, parseFloat(request.amount), requestId);

        // Determine payout mode
        const payoutMode = method.method_type === 'upi' ? 'UPI' : 'IMPS';
        const amountInPaise = Math.round(parseFloat(request.amount) * 100);

        let razorpayPayoutId = null;
        let payoutStatus = 'processing';

        // Trigger Razorpay payout
        if (method.razorpay_fund_account_id) {
            try {
                const payout = await razorpayService.triggerPayout({
                    amountInPaise,
                    fundAccountId: method.razorpay_fund_account_id,
                    mode: payoutMode,
                    referenceId: requestId,
                });
                razorpayPayoutId = payout.id;
                payoutStatus = payout.status === 'processed' ? 'paid' : 'processing';
            } catch (payoutErr) {
                console.error('Razorpay payout error:', payoutErr.error?.description);
                // Don't fail - mark as processing, webhook will update
                payoutStatus = 'processing';
            }
        }

        // Update withdrawal status
        await db.query(
            `UPDATE withdrawal_requests 
             SET status = $1, razorpay_payout_id = $2, payout_method = $3, processed_at = NOW()
             WHERE id = $4`,
            [payoutStatus, razorpayPayoutId, method.method_type, requestId]
        );

        // Audit log
        await db.query(
            `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
             VALUES ($1, 'admin', 'withdrawal_approved', 'withdrawal_requests', $2, $3)`,
            [adminId, requestId, JSON.stringify({ amount: request.amount, method: method.method_type, razorpayPayoutId })]
        );

        await db.query('COMMIT');

        // Notify driver via socket
        const io = req.app.get('io');
        if (io) {
            const driverRes = await db.query('SELECT user_id FROM drivers WHERE id = $1', [request.driver_id]);
            if (driverRes.rows[0]) {
                io.to(`user_${driverRes.rows[0].user_id}`).emit('withdrawal-status-update', {
                    requestId, status: payoutStatus
                });
            }
        }

        res.json({ message: `Withdrawal approved. Payout ${payoutStatus}.`, razorpayPayoutId });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Handle withdrawal error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin: Retry a failed payout
const retryPayout = async (req, res) => {
    const { requestId } = req.body;
    try {
        const requestRes = await db.query(
            "SELECT wr.*, dpm.razorpay_fund_account_id, dpm.method_type FROM withdrawal_requests wr JOIN driver_payout_methods dpm ON dpm.driver_id = wr.driver_id AND dpm.is_active = true WHERE wr.id = $1 AND wr.status = 'failed'",
            [requestId]
        );
        if (!requestRes.rows[0]) return res.status(404).json({ message: 'No failed withdrawal found' });

        const request = requestRes.rows[0];
        const amountInPaise = Math.round(parseFloat(request.amount) * 100);

        const payout = await razorpayService.triggerPayout({
            amountInPaise,
            fundAccountId: request.razorpay_fund_account_id,
            mode: request.method_type === 'upi' ? 'UPI' : 'IMPS',
            referenceId: `retry_${requestId}`,
        });

        await db.query(
            "UPDATE withdrawal_requests SET razorpay_payout_id = $1, status = 'processing', retry_count = retry_count + 1 WHERE id = $2",
            [payout.id, requestId]
        );

        res.json({ message: 'Payout retry initiated', payoutId: payout.id });
    } catch (err) {
        console.error('Retry payout error:', err);
        res.status(500).json({ message: 'Retry failed' });
    }
};

module.exports = {
    requestWithdrawal,
    getWithdrawalHistory,
    getPendingSettlements,
    processBatchSettlement,
    getWithdrawalRequests,
    handleWithdrawalRequest,
    retryPayout
};
