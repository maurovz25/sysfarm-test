import { Router } from 'express';
import { getDashboardSummary } from '../controllers/dashboard.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

router.use(requireAuth);

router.get('/summary', requirePermission('canViewMovements', 'canViewReports'), getDashboardSummary);

export default router;
