const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  updateStock,
  getInventory,
  getOwnerInventory,
} = require('../controllers/inventoryController');

// Owner/Admin only routes
router.put('/update', authenticate, authorize(['OWNER', 'ADMIN']), updateStock);
router.get('/:productId', getInventory);
router.get('/owner/list', authenticate, authorize(['OWNER', 'ADMIN']), getOwnerInventory);

module.exports = router;
