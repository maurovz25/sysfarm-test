import { Router } from 'express';
import {
    getAreas,
    getAreaById,
    createArea,
    updateArea,
    deleteArea,
} from '../controllers/areas.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

router.use(requireAuth);

// Lectura: cualquier usuario con rol (las áreas alimentan los formularios de salidas y requerimientos)
router.get('/', getAreas);
router.get('/:id', getAreaById);
// Escritura: quien registra salidas puede crear un área al vuelo; editar/eliminar es de quien aprueba
router.post('/', requirePermission('canCreateSalidas', 'canApproveRequerimientos'), createArea);
router.put('/:id', requirePermission('canApproveRequerimientos'), updateArea);
router.delete('/:id', requirePermission('canApproveRequerimientos'), deleteArea);

export default router;
