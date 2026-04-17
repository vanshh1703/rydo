const Razorpay = require('razorpay');
const crypto = require('crypto');
const db = require('../models/db');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Creates a Razorpay order for ride payment.
 */
const createOrder = async (amountInPaise, rideId, userId) => {
    const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `ride_${rideId.slice(0, 16)}`,
        notes: { rideId, userId },
    });

    // Store in payments table
    await db.query(
        `INSERT INTO payments (ride_id, user_id, razorpay_order_id, amount, status)
         VALUES ($1, $2, $3, $4, 'created')`,
        [rideId, userId, order.id, amountInPaise / 100]
    );

    return order;
};

/**
 * Verifies Razorpay payment signature.
 */
const verifyPaymentSignature = (orderId, paymentId, signature) => {
    const body = `${orderId}|${paymentId}`;
    const expectedSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');
    return expectedSig === signature;
};

/**
 * Verifies Razorpay webhook signature.
 */
const verifyWebhookSignature = (rawBody, signature) => {
    const expectedSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
    return expectedSig === signature;
};

/**
 * Creates a Fund Account on Razorpay for driver payout.
 * Returns fund_account_id used for future payouts.
 */
const createFundAccount = async (payoutMethod) => {
    const contactPayload = {
        name: payoutMethod.account_holder_name || payoutMethod.upi_vpa,
        type: 'vendor',
        reference_id: payoutMethod.driver_id,
    };
    const contact = await razorpay.contacts.create(contactPayload);

    let fundAccountPayload = { contact_id: contact.id };

    if (payoutMethod.method_type === 'bank') {
        fundAccountPayload = {
            ...fundAccountPayload,
            account_type: 'bank_account',
            bank_account: {
                name: payoutMethod.account_holder_name,
                ifsc: payoutMethod.ifsc_code,
                account_number: payoutMethod.account_number,
            },
        };
    } else {
        fundAccountPayload = {
            ...fundAccountPayload,
            account_type: 'vpa',
            vpa: { address: payoutMethod.upi_vpa },
        };
    }

    const fundAccount = await razorpay.fundAccount.create(fundAccountPayload);
    return fundAccount.id;
};

/**
 * Triggers a real money payout via Razorpay Payouts API.
 */
const triggerPayout = async ({ amountInPaise, fundAccountId, mode, referenceId, purpose }) => {
    const idempotencyKey = `rydo_payout_${referenceId}`;

    const payout = await razorpay.payouts.create({
        account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
        fund_account_id: fundAccountId,
        amount: amountInPaise,
        currency: 'INR',
        mode,
        purpose: purpose || 'payout',
        reference_id: referenceId,
        queue_if_low_balance: true,
        narration: 'Rydo Driver Earnings',
    }, { 'Idempotency-Key': idempotencyKey });

    return payout;
};

module.exports = { createOrder, verifyPaymentSignature, verifyWebhookSignature, createFundAccount, triggerPayout };
