import { Router } from 'express';
import {
    getMovements,
    getMonthlyMovementStats,
    createIngreso,
    createIngresosBulk,
    createSalida,
    createSalidasBulk
} from '../controllers/inventory.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('canViewMovements', 'canViewReports'), getMovements);
router.get('/stats/monthly', requirePermission('canViewMovements', 'canViewReports'), getMonthlyMovementStats);
router.post('/ingreso', requirePermission('canCreateIngresos'), createIngreso);
router.post('/ingresos-bulk', requirePermission('canCreateIngresos'), createIngresosBulk);
router.post('/salida', requirePermission('canCreateSalidas'), createSalida);
router.post('/salidas-bulk', requirePermission('canCreateSalidas'), createSalidasBulk);

export default router;
