import { Router } from 'express';
import {
    getPlantillas,
    getPlantillaById,
    createPlantilla,
    updatePlantilla,
    deletePlantilla,
} from '../controllers/plantillas.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', getPlantillas);
router.get('/:id', getPlantillaById);
router.post('/', requirePermission('canCreateRequerimientos'), createPlantilla);
router.put('/:id', requirePermission('canCreateRequerimientos'), updatePlantilla);
router.delete('/:id', requirePermission('canCreateRequerimientos'), deletePlantilla);

export default router;
