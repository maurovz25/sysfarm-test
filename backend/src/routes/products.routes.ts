import { Router } from 'express';
import { getProducts, createProduct, updateProduct, deleteProduct, updateBatch, deleteBatch, getProductAuditHistory, bulkCreateProducts, validateBulkUpload } from '../controllers/products.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('canViewInventory', 'canCreateRequerimientos'), getProducts);
router.get('/audit', requirePermission('canViewInventory', 'canViewReports'), getProductAuditHistory);
router.post('/', requirePermission('canCreateProducts'), createProduct);
router.post('/bulk', requirePermission('canBulkUpload'), bulkCreateProducts);
router.post('/bulk/validate', requirePermission('canBulkUpload'), validateBulkUpload);
router.put('/:id', requirePermission('canEditInventory'), updateProduct);
router.delete('/:id', requirePermission('canDeleteProducts'), deleteProduct);

router.put('/batch/:id', requirePermission('canEditInventory'), updateBatch);
router.delete('/batch/:id', requirePermission('canDeleteBatches'), deleteBatch);

export default router;
