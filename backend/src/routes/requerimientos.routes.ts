import { Router } from 'express';
import {
  getRequerimientos,
  getRequerimientoById,
  getPendingRequerimientosCount,
  createRequerimiento,
  updateRequerimiento,
  aprobarYDespacharRequerimiento,
  rechazarRequerimiento,
} from '../controllers/requerimientos.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('canViewRequerimientos'), getRequerimientos);
router.get('/count/pending', requirePermission('canViewRequerimientos'), getPendingRequerimientosCount);
router.get('/:id', requirePermission('canViewRequerimientos'), getRequerimientoById);
router.post('/', requirePermission('canCreateRequerimientos'), createRequerimiento);
router.put('/:id', requirePermission('canApproveRequerimientos'), updateRequerimiento);
router.post('/:id/despachar', requirePermission('canApproveRequerimientos'), aprobarYDespacharRequerimiento);
router.post('/:id/rechazar', requirePermission('canApproveRequerimientos'), rechazarRequerimiento);

export default router;
