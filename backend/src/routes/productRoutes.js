const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  createProduct,
  getProduct,
  getAllProducts,
  updateProduct,
  deleteProduct,
  getOwnerProducts,
} = require('../controllers/productController');

// Public routes
router.get('/all', getAllProducts);
router.get('/:id', getProduct);

// Owner/Admin only routes
router.post('/', authenticate, authorize(['OWNER', 'ADMIN']), upload.single('image'), createProduct);
router.put('/:id', authenticate, authorize(['OWNER', 'ADMIN']), upload.single('image'), updateProduct);
router.delete('/:id', authenticate, authorize(['OWNER', 'ADMIN']), deleteProduct);

// Owner products
router.get('/owner/list', authenticate, authorize(['OWNER', 'ADMIN']), getOwnerProducts);

module.exports = router;
