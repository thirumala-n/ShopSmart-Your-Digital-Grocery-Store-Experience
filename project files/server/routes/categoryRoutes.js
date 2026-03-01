const express = require('express');
const {
  getCategories,
  createCategory,
  deleteCategory
} = require('../controllers/categoryController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.get('/', getCategories);
router.post('/', auth, authorize('ADMIN'), createCategory);
router.delete('/:id', auth, authorize('ADMIN'), deleteCategory);

module.exports = router;
