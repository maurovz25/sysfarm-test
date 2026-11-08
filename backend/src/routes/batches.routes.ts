import { Router } from 'express';
import { getBatches, getBatchById, createBatch, updateBatch, getAdjustmentHistory } from '../controllers/batches.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('canViewInventory'), getBatches);
router.get('/adjustments/history', requirePermission('canViewInventory', 'canViewReports'), getAdjustmentHistory);
router.post('/', requirePermission('canEditInventory', 'canCreateIngresos'), createBatch);

router.get('/:id', requirePermission('canViewInventory'), getBatchById);
router.put('/:id', requirePermission('canEditInventory'), updateBatch);

export default router;
