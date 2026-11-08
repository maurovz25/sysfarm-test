import { Router } from 'express';
import { listUsers, createUser, updateUser, deleteUser, updateUserPassword } from '../controllers/users.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRole, UserRole } from '../middlewares/role.middleware';

const router = Router();

// Todas las rutas requieren autenticación y rol de admin
router.use(requireAuth);
router.use(requireRole(UserRole.ADMIN));

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:userId', updateUser);
router.put('/:userId/password', updateUserPassword);
router.delete('/:userId', deleteUser);

export default router;
