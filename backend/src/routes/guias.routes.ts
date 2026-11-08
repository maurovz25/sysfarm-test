import { Router } from 'express';
import {
    createOrUpdateGuia,
    getGuiaByMovementId,
    getGuias,
    getMedicosSugeridos,
} from '../controllers/guias.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

router.use(requireAuth);

// Las guías contienen datos de pacientes: solo roles que operan salidas o revisan movimientos
const canReadGuias = requirePermission('canViewMovements', 'canViewReports', 'canCreateSalidas');

router.post('/', requirePermission('canCreateSalidas'), createOrUpdateGuia);
router.get('/', canReadGuias, getGuias);
router.get('/medicos-sugeridos', requirePermission('canCreateSalidas'), getMedicosSugeridos);
router.get('/movimiento/:movementId', canReadGuias, getGuiaByMovementId);
router.get('/movement/:movementId', canReadGuias, getGuiaByMovementId);

export default router;
