import { Router } from 'express';
import { getSugerencias } from '../controllers/sugerencias.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('canViewReports'), getSugerencias);

export default router;
