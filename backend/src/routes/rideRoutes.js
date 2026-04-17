const express = require('express');
const { createRide, getHistory, updateStatus, getActiveRide, getDriverStats, cancelRide, updateDriverStatus, getNearbyDrivers, rateRide } = require('../controllers/rideController');
const { buySubscription, getLedger } = require('../controllers/fintechController');
const { requestWithdrawal, getWithdrawalHistory } = require('../controllers/payoutController');
const { createPaymentOrder, verifyPayment } = require('../controllers/paymentController');
const { addPayoutMethod, getPayoutMethods, setActiveMethod } = require('../controllers/payoutMethodController');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const router = express.Router();

// Common routes
router.get('/active', authMiddleware, getActiveRide);
router.get('/nearby-drivers', authMiddleware, getNearbyDrivers);
router.post('/cancel', authMiddleware, cancelRide);

// User routes
router.post('/create', authMiddleware, roleMiddleware(['user']), createRide);
router.get('/history', authMiddleware, getHistory);
router.post('/confirm-payment', authMiddleware, roleMiddleware(['user']), require('../controllers/rideController').confirmRidePayment);
router.post('/rate', authMiddleware, roleMiddleware(['user']), rateRide);

// Driver routes
router.post('/update-status', authMiddleware, roleMiddleware(['driver']), updateStatus);
router.get('/stats', authMiddleware, roleMiddleware(['driver']), getDriverStats);
router.post('/driver-status', authMiddleware, roleMiddleware(['driver']), updateDriverStatus);

// Payout routes
router.post('/withdraw', authMiddleware, roleMiddleware(['driver']), requestWithdrawal);
router.get('/withdrawals', authMiddleware, roleMiddleware(['driver']), getWithdrawalHistory);

// Fintech routes
router.post('/subscribe', authMiddleware, roleMiddleware(['driver']), buySubscription);
router.get('/ledger', authMiddleware, roleMiddleware(['driver']), getLedger);

// Payment routes (User)
router.post('/payment/create-order', authMiddleware, roleMiddleware(['user']), createPaymentOrder);
router.post('/payment/verify', authMiddleware, roleMiddleware(['user']), verifyPayment);

// Payout method routes (Driver)
router.get('/payout-methods', authMiddleware, roleMiddleware(['driver']), getPayoutMethods);
router.post('/payout-methods', authMiddleware, roleMiddleware(['driver']), addPayoutMethod);
router.patch('/payout-methods/set-active', authMiddleware, roleMiddleware(['driver']), setActiveMethod);

module.exports = router;
