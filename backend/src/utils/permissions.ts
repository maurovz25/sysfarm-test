import { UserRole } from '../middlewares/role.middleware';

// Copia en el servidor de ROLE_PERMISSIONS (frontend/lib/roles.ts).
// tests/permissions.test.cjs verifica que ambas tablas sean idénticas.
export const ROLE_PERMISSIONS = {
    [UserRole.ADMIN]: {
        canViewInventory: true,
        canEditInventory: true,
        canCreateProducts: true,
        canDeleteProducts: true,
        canDeleteBatches: true,
        canViewMovements: true,
        canCreateIngresos: true,
        canCreateSalidas: true,
        canViewReports: true,
        canManageUsers: true,
        canBulkUpload: true,
        canCreateRequerimientos: true,
        canViewRequerimientos: true,
        canApproveRequerimientos: true,
    },
    [UserRole.FARMACEUTICO]: {
        canViewInventory: true,
        canEditInventory: true,
        canCreateProducts: true,
        canDeleteProducts: false,
        canDeleteBatches: true,
        canViewMovements: true,
        canCreateIngresos: true,
        canCreateSalidas: true,
        canViewReports: true,
        canManageUsers: false,
        canBulkUpload: true,
        canCreateRequerimientos: true,
        canViewRequerimientos: true,
        canApproveRequerimientos: true,
    },
    [UserRole.VENDEDOR]: {
        canViewInventory: true,
        canEditInventory: false,
        canCreateProducts: false,
        canDeleteProducts: false,
        canDeleteBatches: false,
        canViewMovements: true,
        canCreateIngresos: false,
        canCreateSalidas: true,
        canViewReports: false,
        canManageUsers: false,
        canBulkUpload: false,
        canCreateRequerimientos: false,
        canViewRequerimientos: false,
        canApproveRequerimientos: false,
    },
    [UserRole.SOLICITANTE]: {
        canViewInventory: false,
        canEditInventory: false,
        canCreateProducts: false,
        canDeleteProducts: false,
        canDeleteBatches: false,
        canViewMovements: false,
        canCreateIngresos: false,
        canCreateSalidas: false,
        canViewReports: false,
        canManageUsers: false,
        canBulkUpload: false,
        canCreateRequerimientos: true,
        canViewRequerimientos: true,
        canApproveRequerimientos: false,
    },
    [UserRole.AUDITOR]: {
        canViewInventory: true,
        canEditInventory: false,
        canCreateProducts: false,
        canDeleteProducts: false,
        canDeleteBatches: false,
        canViewMovements: false,
        canCreateIngresos: false,
        canCreateSalidas: false,
        canViewReports: true,
        canManageUsers: false,
        canBulkUpload: false,
        canCreateRequerimientos: false,
        canViewRequerimientos: false,
        canApproveRequerimientos: false,
    },
} as const;

export type Permission = keyof (typeof ROLE_PERMISSIONS)[UserRole.ADMIN];

const VALID_ROLES: string[] = Object.values(UserRole);

export function isValidRole(role: unknown): role is UserRole {
    return typeof role === 'string' && VALID_ROLES.includes(role);
}

// El rol vive en app_metadata: solo la API de administración (service_role) puede escribirlo.
// user_metadata NO se usa para autorizar porque cada usuario puede editarlo desde el navegador.
export function resolveRole(appMetadata: object | null | undefined): UserRole | null {
    const role = (appMetadata as { role?: unknown } | null | undefined)?.role;
    return isValidRole(role) ? role : null;
}

// true si el rol tiene AL MENOS UNO de los permisos indicados
export function roleHasAnyPermission(role: string | null | undefined, permissions: Permission[]): boolean {
    if (!isValidRole(role)) return false;
    return permissions.some((permission) => ROLE_PERMISSIONS[role][permission]);
}
