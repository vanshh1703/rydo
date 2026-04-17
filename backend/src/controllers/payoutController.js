const db = require('../models/db');

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

// Admin: Approve/Reject withdrawal request
const handleWithdrawalRequest = async (req, res) => {
    const { requestId, status } = req.body; // status: 'approved' or 'rejected'

    try {
        await db.query('BEGIN');

        const requestRes = await db.query('SELECT * FROM withdrawal_requests WHERE id = $1', [requestId]);
        if (requestRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ message: 'Request not found' });
        }

        const request = requestRes.rows[0];
        if (request.status !== 'pending') {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: 'Request already processed' });
        }

        if (status === 'approved') {
            const ledgerService = require('../services/ledgerService');
            await ledgerService.recordWithdrawal(request.driver_id, parseFloat(request.amount), requestId);
        }

        await db.query('UPDATE withdrawal_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, requestId]);

        await db.query('COMMIT');
        res.json({ message: `Request ${status} successfully` });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Handle withdrawal request error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    requestWithdrawal,
    getWithdrawalHistory,
    getPendingSettlements,
    processBatchSettlement,
    getWithdrawalRequests,
    handleWithdrawalRequest
};
