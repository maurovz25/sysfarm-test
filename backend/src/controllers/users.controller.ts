import { Request, Response } from 'express';
import { createClient, User } from '@supabase/supabase-js';
import { UserRole } from '../middlewares/role.middleware';
import { invalidateUserTokens } from '../middlewares/auth.middleware';
import { isOnline, getLastSeen, clear as clearPresence } from '../utils/presence';
import { isValidRole, resolveRole } from '../utils/permissions';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cliente de Supabase con permisos de admin
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const FULL_NAME_MIN_LENGTH = 2;
const FULL_NAME_MAX_LENGTH = 80;
const USERS_PER_PAGE = 1000;

// El rol se lee de app_metadata (solo escribible con service_role). null = cuenta sin rol, sin acceso.
function getRole(user: User): UserRole | null {
    return resolveRole(user.app_metadata);
}

// Solo los campos que necesita la pantalla de usuarios (no se expone el objeto crudo de GoTrue)
function toUserDto(user: User) {
    const lastSeen = getLastSeen(user.id);
    return {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name ?? null,
        role: getRole(user),
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
        is_online: isOnline(user.id),
        last_seen_at: lastSeen ? new Date(lastSeen).toISOString() : null,
    };
}

async function countAdmins(): Promise<number> {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: USERS_PER_PAGE });
    if (error) throw error;
    return data.users.filter((u) => getRole(u) === UserRole.ADMIN).length;
}

export async function listUsers(req: Request, res: Response) {
    try {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: USERS_PER_PAGE });

        if (error) {
            console.error('Supabase error:', error);
            return res.status(400).json({ error: error.message });
        }

        res.json(data.users.map(toUserDto));
    } catch (error) {
        console.error('Error listing users:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

export async function createUser(req: Request, res: Response) {
    try {
        const { email, password, full_name, role } = req.body;

        // El rol es obligatorio y explícito: no se asigna ninguno por defecto
        if (!isValidRole(role)) {
            return res.status(400).json({ error: 'Rol inválido' });
        }

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            app_metadata: { role },
            user_metadata: { full_name },
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json(data.user);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

export async function updateUser(req: Request, res: Response) {
    try {
        const { userId } = req.params;
        const { role, full_name } = req.body;
        const currentUserId = (req as any).user.id;

        const updateData: { role?: UserRole; full_name?: string } = {};

        if (role !== undefined) {
            if (!isValidRole(role)) {
                return res.status(400).json({ error: 'Rol inválido' });
            }
            updateData.role = role;
        }

        if (full_name !== undefined) {
            const trimmedName = typeof full_name === 'string' ? full_name.trim() : '';
            if (trimmedName.length < FULL_NAME_MIN_LENGTH || trimmedName.length > FULL_NAME_MAX_LENGTH) {
                return res.status(400).json({
                    error: `El nombre debe tener entre ${FULL_NAME_MIN_LENGTH} y ${FULL_NAME_MAX_LENGTH} caracteres`,
                });
            }
            updateData.full_name = trimmedName;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No hay cambios para aplicar' });
        }

        if (updateData.role) {
            const { data: target, error: targetError } = await supabaseAdmin.auth.admin.getUserById(userId);
            if (targetError || !target.user) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            const currentRole = getRole(target.user);
            if (currentRole !== updateData.role) {
                if (userId === currentUserId) {
                    return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
                }
                if (currentRole === UserRole.ADMIN && (await countAdmins()) <= 1) {
                    return res.status(400).json({ error: 'No se puede quitar el rol al último administrador' });
                }
            }
        }

        // El rol va en app_metadata (inmodificable por el usuario) y el nombre en user_metadata
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            ...(updateData.role && { app_metadata: { role: updateData.role } }),
            ...(updateData.full_name && { user_metadata: { full_name: updateData.full_name } }),
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        // El rol queda cacheado en requireAuth: se invalida para que aplique de inmediato
        invalidateUserTokens(userId);

        res.json(toUserDto(data.user));
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

export async function deleteUser(req: Request, res: Response) {
    try {
        const { userId } = req.params;

        if (userId === (req as any).user.id) {
            return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
        }

        const { data: target } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (target?.user && getRole(target.user) === UserRole.ADMIN && (await countAdmins()) <= 1) {
            return res.status(400).json({ error: 'No se puede eliminar al último administrador' });
        }

        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        invalidateUserTokens(userId);
        clearPresence(userId);

        res.json({ message: 'Usuario eliminado exitosamente' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

export async function updateUserPassword(req: Request, res: Response) {
    try {
        const { userId } = req.params;
        const { password } = req.body;

        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }

        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: password,
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ message: 'Contraseña actualizada exitosamente' });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}
