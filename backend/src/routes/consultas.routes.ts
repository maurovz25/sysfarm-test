import { Router } from 'express';
import { consultarDni } from '../controllers/consultas.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

// La consulta de DNI llama a un servicio externo y devuelve datos personales: solo con sesión y rol
router.use(requireAuth);

router.get('/dni', requirePermission('canCreateSalidas'), consultarDni);

export default router;
