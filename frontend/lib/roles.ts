export enum UserRole {
    ADMIN = 'admin',
    FARMACEUTICO = 'farmaceutico',
    VENDEDOR = 'vendedor',
    SOLICITANTE = 'solicitante',
    AUDITOR = 'auditor'
}

export const ROLE_LABELS: Record<UserRole, string> = {
    [UserRole.ADMIN]: 'Administrador',
    [UserRole.FARMACEUTICO]: 'Farmacéutico',
    [UserRole.VENDEDOR]: 'Vendedor',
    [UserRole.SOLICITANTE]: 'Solicitante por Área',
    [UserRole.AUDITOR]: 'Auditor'
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
    [UserRole.ADMIN]: 'Acceso total al sistema',
    [UserRole.FARMACEUTICO]: 'Gestión completa de inventario y movimientos',
    [UserRole.VENDEDOR]: 'Registro de salidas y consulta de inventario',
    [UserRole.SOLICITANTE]: 'Registro de solicitudes de requerimientos por área',
    [UserRole.AUDITOR]: 'Consulta exclusiva de inventario, lotes y kardex sin permisos de modificación'
}

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
}

export type PermissionKey = keyof typeof ROLE_PERMISSIONS[UserRole.ADMIN]

// Permisos de una cuenta sin rol asignado: ninguno
export const NO_PERMISSIONS = Object.fromEntries(
    (Object.keys(ROLE_PERMISSIONS[UserRole.ADMIN]) as PermissionKey[]).map((key) => [key, false])
) as Record<PermissionKey, boolean>

export function isUserRole(value: unknown): value is UserRole {
    return typeof value === 'string' && (Object.values(UserRole) as string[]).includes(value)
}

// El rol vive en app_metadata (solo lo escribe el administrador desde el servidor).
// user_metadata NO se usa: el propio usuario puede modificarlo desde el navegador.
// Devuelve null si la cuenta no tiene un rol válido (sin acceso).
export function getUserRole(user: any): UserRole | null {
    const role = user?.app_metadata?.role
    return isUserRole(role) ? role : null
}

export function getUserDepartamento(user: any): string {
    return user?.user_metadata?.departamento || 'Hospitalizacion'
}

export function hasPermission(user: any, permission: PermissionKey): boolean {
    const role = getUserRole(user)
    if (!role) return false
    return ROLE_PERMISSIONS[role]?.[permission] || false
}

export function canAccessRoute(user: any, route: string): boolean {
    const role = getUserRole(user)
    if (!role) return false

    if (role === UserRole.AUDITOR) {
        return ['/inventario', '/lotes', '/kardex'].includes(route)
    }

    const permissions = ROLE_PERMISSIONS[role]

    // Mapeo de rutas a permisos
    const routePermissions: Record<string, keyof typeof permissions> = {
        '/dashboard': 'canViewMovements',
        '/inventario': 'canViewInventory',
        '/ingresos': 'canViewMovements',
        '/ingresos/nuevo': 'canCreateIngresos',
        '/salidas': 'canViewMovements',
        '/salidas/nuevo': 'canCreateSalidas',
        '/kardex': 'canViewReports',
        '/lotes': 'canViewInventory',
        '/asistente': 'canViewInventory',
        '/usuarios': 'canManageUsers',
        '/requerimientos': 'canViewRequerimientos',
        '/requerimientos/nuevo': 'canCreateRequerimientos',
    }

    const requiredPermission = routePermissions[route]
    return requiredPermission ? (permissions[requiredPermission] ?? false) : true
}

