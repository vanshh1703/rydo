const db = require('../models/db');
const razorpayService = require('../services/razorpayService');
const LedgerService = require('../services/ledgerService');

/**
 * Step 1: Create Razorpay order before ride payment.
 */
const createPaymentOrder = async (req, res) => {
    const { rideId } = req.body;
    const userId = req.user.id;

    try {
        const rideRes = await db.query('SELECT * FROM rides WHERE id = $1 AND user_id = $2', [rideId, userId]);
        if (!rideRes.rows[0]) return res.status(404).json({ message: 'Ride not found' });

        const ride = rideRes.rows[0];
        if (ride.payment_status === 'completed') return res.status(400).json({ message: 'Ride already paid' });

        const amountInPaise = Math.round(ride.fare * 100);
        const order = await razorpayService.createOrder(amountInPaise, rideId, userId);

        res.json({
            orderId: order.id,
            amount: amountInPaise,
            currency: 'INR',
            keyId: process.env.RAZORPAY_KEY_ID,
        });
    } catch (err) {
        console.error('Create payment order error:', err);
        res.status(500).json({ message: 'Failed to create payment order' });
    }
};

/**
 * Step 2: Verify payment after user completes Razorpay checkout.
 */
const verifyPayment = async (req, res) => {
    const { rideId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    try {
        const isValid = razorpayService.verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        if (!isValid) return res.status(400).json({ message: 'Invalid payment signature' });

        await db.query('BEGIN');

        // Update payment record
        await db.query(
            `UPDATE payments SET razorpay_payment_id = $1, razorpay_signature = $2, status = 'captured', updated_at = NOW()
             WHERE razorpay_order_id = $3`,
            [razorpay_payment_id, razorpay_signature, razorpay_order_id]
        );

        // Update ride payment status
        await db.query(
            `UPDATE rides SET payment_status = 'completed', payment_method = 'online' WHERE id = $1`,
            [rideId]
        );

        await db.query('COMMIT');

        // Trigger ledger update for the driver (non-blocking)
        const rideRes = await db.query('SELECT driver_id, fare FROM rides WHERE id = $1', [rideId]);
        const { driver_id, fare } = rideRes.rows[0];
        if (driver_id) {
            LedgerService.recordRideCompletion(rideId, driver_id, fare).catch(console.error);
        }

        // Emit real-time confirmation
        const io = req.app.get('io');
        if (io) io.to(`ride_${rideId}`).emit('payment-received', { rideId, status: 'completed' });

        res.json({ message: 'Payment verified successfully' });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Verify payment error:', err);
        res.status(500).json({ message: 'Payment verification failed' });
    }
};

/**
 * Razorpay webhook handler.
 * Handles delayed payment confirmations and payout status updates.
 */
const handleWebhook = async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = JSON.stringify(req.body);

    // Verify webhook authenticity
    if (!razorpayService.verifyWebhookSignature(rawBody, signature)) {
        return res.status(400).json({ message: 'Invalid webhook signature' });
    }

    const { event, payload } = req.body;

    try {
        if (event === 'payment.captured') {
            const payment = payload.payment.entity;
            await db.query(
                `UPDATE payments SET status = 'captured', webhook_received = true, updated_at = NOW()
                 WHERE razorpay_order_id = $1`,
                [payment.order_id]
            );
        }

        if (event === 'payout.processed') {
            const payout = payload.payout.entity;
            await db.query(
                `UPDATE withdrawal_requests SET status = 'paid', processed_at = NOW()
                 WHERE razorpay_payout_id = $1`,
                [payout.id]
            );
            // Notify driver via socket
            const withdrawalRes = await db.query(
                `SELECT d.user_id FROM withdrawal_requests wr 
                 JOIN drivers d ON wr.driver_id = d.id 
                 WHERE wr.razorpay_payout_id = $1`, [payout.id]
            );
            const io = req.app.get('io');
            if (io && withdrawalRes.rows[0]) {
                io.to(`user_${withdrawalRes.rows[0].user_id}`).emit('payout-success', { payoutId: payout.id });
            }
        }

        if (event === 'payout.failed') {
            const payout = payload.payout.entity;
            await db.query(
                `UPDATE withdrawal_requests SET status = 'failed', failure_reason = $1, processed_at = NOW()
                 WHERE razorpay_payout_id = $2`,
                [payout.failure_reason, payout.id]
            );
            // Refund balance back
            const withdrawalRes = await db.query(
                `SELECT * FROM withdrawal_requests WHERE razorpay_payout_id = $1`, [payout.id]
            );
            if (withdrawalRes.rows[0]) {
                const { driver_id, amount } = withdrawalRes.rows[0];
                const driverRes = await db.query('SELECT wallet_balance FROM drivers WHERE id = $1', [driver_id]);
                const newBalance = parseFloat(driverRes.rows[0].wallet_balance) + parseFloat(amount);
                await db.query('UPDATE drivers SET wallet_balance = $1 WHERE id = $2', [newBalance, driver_id]);
                // Ledger entry for refund
                await db.query(
                    `INSERT INTO wallet_ledger (driver_id, amount, transaction_type, description, balance_after)
                     VALUES ($1, $2, 'adjustment', 'Payout failed - balance restored', $3)`,
                    [driver_id, amount, newBalance]
                );
            }
        }

        res.json({ status: 'ok' });
    } catch (err) {
        console.error('Webhook processing error:', err);
        res.status(500).json({ message: 'Webhook processing failed' });
    }
};

module.exports = { createPaymentOrder, verifyPayment, handleWebhook };
