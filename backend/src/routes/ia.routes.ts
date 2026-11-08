import { Router } from 'express';
import { chat } from '../controllers/ia.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

router.use(requireAuth);

router.post('/chat', requirePermission('canViewInventory'), chat);

export default router;
