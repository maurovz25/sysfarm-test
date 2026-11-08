import { Request, Response, NextFunction } from 'express';

export enum UserRole {
    ADMIN = 'admin',
    FARMACEUTICO = 'farmaceutico',
    VENDEDOR = 'vendedor',
    SOLICITANTE = 'solicitante',
    AUDITOR = 'auditor'
}

export function requireRole(...allowedRoles: UserRole[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;

        if (!user) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        const userRole = user.role as UserRole;

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        next();
    };
}
