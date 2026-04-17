const db = require('../models/db');
const LedgerService = require('../services/ledgerService');

/**
 * FintechController handles financial interactions for drivers and admins.
 */

// Driver: Purchase a zero-commission subscription
const buySubscription = async (req, res) => {
    const { driverId } = req.user;
    
    try {
        // Fetch price from config
        const configRes = await db.query("SELECT value FROM platform_configs WHERE key = 'daily_subscription_price'");
        const price = parseFloat(configRes.rows[0]?.value || 100);

        await LedgerService.purchaseSubscription(driverId, 'daily_zero_commission', price);
        
        res.json({ message: 'Subscription purchased successfully', price });
    } catch (err) {
        console.error('Buy subscription error:', err);
        res.status(400).json({ message: err.message || 'Failed to purchase subscription' });
    }
};

// Driver: Get full ledger history
const getLedger = async (req, res) => {
    const { driverId } = req.user;
    
    try {
        const result = await db.query(
            "SELECT * FROM wallet_ledger WHERE driver_id = $1 ORDER BY created_at DESC LIMIT 100",
            [driverId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get ledger error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin: Update platform configurations
const updateConfig = async (req, res) => {
    const { key, value } = req.body;
    
    try {
        await db.query(
            "UPDATE platform_configs SET value = $1, updated_at = NOW() WHERE key = $2",
            [value, key]
        );
        res.json({ message: `Config ${key} updated successfully` });
    } catch (err) {
        console.error('Update config error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin: Get all platform configs
const getConfigs = async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM platform_configs");
        res.json(result.rows);
    } catch (err) {
        console.error('Get configs error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { buySubscription, getLedger, updateConfig, getConfigs };
