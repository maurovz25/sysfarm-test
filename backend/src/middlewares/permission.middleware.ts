import { Request, Response, NextFunction } from 'express';
import { Permission, roleHasAnyPermission } from '../utils/permissions';

// RBAC_ENFORCE=true  -> deniega con 403 cuando el rol no tiene el permiso.
// RBAC_ENFORCE=false -> modo registro: deja pasar y avisa en consola qué habría denegado.
//                       Sirve para validar el mapeo con uso real antes de activar el bloqueo.
const isEnforced = () => process.env.RBAC_ENFORCE === 'true';

// Basta con que el rol tenga AL MENOS UNO de los permisos indicados.
export function requirePermission(...permissions: Permission[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;

        if (!user) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        if (roleHasAnyPermission(user.role, permissions)) {
            return next();
        }

        if (!isEnforced()) {
            console.warn(
                `[RBAC] modo registro: habría denegado ${req.method} ${req.originalUrl} ` +
                `al rol "${user.role}" (requiere: ${permissions.join(' | ')})`
            );
            return next();
        }

        return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
    };
}
