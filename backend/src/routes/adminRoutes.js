const express = require('express');
const { getPlatformStats, getDriverDirectory } = require('../controllers/adminController');
const { getPendingSettlements, processBatchSettlement, getWithdrawalRequests, handleWithdrawalRequest } = require('../controllers/payoutController');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const router = express.Router();

router.get('/stats', authMiddleware, roleMiddleware(['admin']), getPlatformStats);
router.get('/drivers', authMiddleware, roleMiddleware(['admin']), getDriverDirectory);

// Settlement management
router.get('/pending-settlements', authMiddleware, roleMiddleware(['admin']), getPendingSettlements);
router.post('/settle-all', authMiddleware, roleMiddleware(['admin']), processBatchSettlement);

// Withdrawal management
router.get('/withdrawals', authMiddleware, roleMiddleware(['admin']), getWithdrawalRequests);
router.post('/handle-withdrawal', authMiddleware, roleMiddleware(['admin']), handleWithdrawalRequest);

module.exports = router;
