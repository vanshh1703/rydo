const express = require('express');
const { getPlatformStats, getDriverDirectory } = require('../controllers/adminController');
const { getPendingSettlements, processBatchSettlement, getWithdrawalRequests, handleWithdrawalRequest, retryPayout } = require('../controllers/payoutController');
const { updateConfig, getConfigs } = require('../controllers/fintechController');
const { handleWebhook } = require('../controllers/paymentController');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const router = express.Router();

// Razorpay webhook (no auth - verified by signature)
router.post('/webhook/razorpay', express.raw({ type: 'application/json' }), handleWebhook);

router.get('/stats', authMiddleware, roleMiddleware(['admin']), getPlatformStats);
router.get('/drivers', authMiddleware, roleMiddleware(['admin']), getDriverDirectory);

// Settlement management
router.get('/pending-settlements', authMiddleware, roleMiddleware(['admin']), getPendingSettlements);
router.post('/settle-all', authMiddleware, roleMiddleware(['admin']), processBatchSettlement);

// Withdrawal management
router.get('/withdrawals', authMiddleware, roleMiddleware(['admin']), getWithdrawalRequests);
router.post('/handle-withdrawal', authMiddleware, roleMiddleware(['admin']), handleWithdrawalRequest);
router.post('/retry-payout', authMiddleware, roleMiddleware(['admin']), retryPayout);

// Platform config management
router.get('/configs', authMiddleware, roleMiddleware(['admin']), getConfigs);
router.patch('/configs', authMiddleware, roleMiddleware(['admin']), updateConfig);

// Driver management
router.post('/blacklist-driver', authMiddleware, roleMiddleware(['admin']), require('../controllers/adminController').blacklistDriver);

module.exports = router;
