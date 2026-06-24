const express = require('express');
const { upload } = require('../../utils/online/uploadS3');
const {
  getAllCategories,
  getCategoryById,
  getCategoryByName,
  createCategory,
  createCategoryOnly,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  getCategoryNames,
  getSubcategoriesByCategory,
  getSubcategoriesWithIdsByCategory,
  getUniqueCategories,
  generateEnhancedSEO,
} = require('../../controllers/online/categorySubcategoryController');

const { authenticateToken } = require('../../middleware/auth');
const { requirePermission, requireDashboardAccess } = require('../../middleware/permission');

const router = express.Router();

// Category CRUD routes
router.get('/', authenticateToken, requireDashboardAccess, getAllCategories);
router.get('/names', authenticateToken, requireDashboardAccess, getCategoryNames);
router.get('/subcategories/:categoryName', authenticateToken, requireDashboardAccess, getSubcategoriesByCategory);
router.get('/subcategories-with-ids/:categoryName', authenticateToken, requireDashboardAccess, getSubcategoriesWithIdsByCategory);
router.get('/by-name/:categoryName', authenticateToken, requireDashboardAccess, getCategoryByName);
router.get('/unique', authenticateToken, requireDashboardAccess, getUniqueCategories);
router.get('/:id', authenticateToken, requireDashboardAccess, getCategoryById);
router.post('/category-only', authenticateToken, requirePermission('online_products', 'add'), createCategoryOnly);
router.post('/', authenticateToken, requirePermission('online_products', 'add'), upload.fields([
  { name: 'categoryImage', maxCount: 1 },
  { name: 'subcategoryImage', maxCount: 1 }
]), createCategory);
router.put('/:id', authenticateToken, requirePermission('online_products', 'edit'), upload.fields([
  { name: 'categoryImage', maxCount: 1 },
  { name: 'subcategoryImage', maxCount: 1 }
]), updateCategory);
router.delete('/:id', authenticateToken, requirePermission('online_products', 'delete'), deleteCategory);

// Status management
router.put('/:id/toggle-status', authenticateToken, requirePermission('online_products', 'edit'), toggleCategoryStatus);

// SEO generation route
router.post('/generate-enhanced-seo', authenticateToken, requirePermission('online_products', 'add'), generateEnhancedSEO);

module.exports = router;
