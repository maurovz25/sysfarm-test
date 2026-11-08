import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { touch, clear } from '../utils/presence';

const router = Router();

// Disponible para cualquier usuario autenticado (no requiere rol de admin)
router.use(requireAuth);

// Respuestas JSON mínimas: el cliente `api` del frontend siempre parsea JSON (un 204 vacío lo rompería)
router.post('/heartbeat', (req, res) => {
    touch((req as any).user.id);
    res.json({ ok: true });
});

router.post('/offline', (req, res) => {
    clear((req as any).user.id);
    res.json({ ok: true });
});

export default router;
