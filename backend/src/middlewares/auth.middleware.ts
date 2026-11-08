import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { touch } from '../utils/presence';
import { resolveRole } from '../utils/permissions';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
);

// Caché en memoria para tokens validados (TTL: 2 minutos)
interface CachedUser {
    id: string;
    email?: string;
    role: string;
    full_name: string;
}

const tokenCache = new Map<string, { user: CachedUser; expiresAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos
const MAX_CACHE_SIZE = 500;

function cleanupExpiredTokens() {
    const now = Date.now();
    for (const [token, data] of tokenCache.entries()) {
        if (data.expiresAt <= now) {
            tokenCache.delete(token);
        }
    }
}

// Elimina del caché todos los tokens de un usuario para que un cambio de rol,
// eliminación, etc. surta efecto en la siguiente petición y no tras el TTL.
export function invalidateUserTokens(userId: string) {
    for (const [token, data] of tokenCache.entries()) {
        if (data.user.id === userId) {
            tokenCache.delete(token);
        }
    }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Cabecera de autorización faltante o inválida' });
        }

        const token = authHeader.substring(7);

        // 1. Revisar caché en memoria
        const now = Date.now();
        const cached = tokenCache.get(token);
        if (cached && cached.expiresAt > now) {
            (req as any).user = cached.user;
            touch(cached.user.id);
            return next();
        }

        // 2. Si no está en caché o expiró, verificar con Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            tokenCache.delete(token);
            return res.status(401).json({ error: 'Token inválido o expirado' });
        }

        // Sin rol válido en app_metadata no hay acceso (no se asume ningún rol por defecto)
        const role = resolveRole(user.app_metadata);
        if (!role) {
            tokenCache.delete(token);
            return res.status(403).json({ error: 'Tu cuenta no tiene un rol asignado. Contacta al administrador.' });
        }

        const userData: CachedUser = {
            id: user.id,
            email: user.email,
            role,
            // Nombre mostrado en auditoría: viene de la sesión verificada, no del cuerpo de la petición
            full_name: user.user_metadata?.full_name || user.email || 'Usuario'
        };

        // 3. Almacenar en caché y limpiar si supera tamaño máximo
        if (tokenCache.size >= MAX_CACHE_SIZE) {
            cleanupExpiredTokens();
            if (tokenCache.size >= MAX_CACHE_SIZE) {
                // Eliminar el primer elemento si sigue lleno
                const firstKey = tokenCache.keys().next().value;
                if (firstKey) tokenCache.delete(firstKey);
            }
        }

        tokenCache.set(token, {
            user: userData,
            expiresAt: now + CACHE_TTL_MS
        });

        // Adjuntar usuario al request
        (req as any).user = userData;
        touch(userData.id);

        next();
    } catch (error) {
        console.error('Unexpected auth error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

