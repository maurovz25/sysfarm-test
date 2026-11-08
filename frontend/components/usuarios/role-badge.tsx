import { Shield } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { UserRole, ROLE_LABELS, isUserRole } from "@/lib/roles"

const ROLE_VARIANT: Record<UserRole, "destructive" | "default" | "secondary" | "outline"> = {
    [UserRole.ADMIN]: "destructive",
    [UserRole.FARMACEUTICO]: "default",
    [UserRole.VENDEDOR]: "secondary",
    [UserRole.SOLICITANTE]: "outline",
    [UserRole.AUDITOR]: "outline",
}

// null = la cuenta no tiene un rol válido (sin acceso al sistema)
export function normalizeRole(role: string | undefined | null): UserRole | null {
    return isUserRole(role) ? role : null
}

export function RoleBadge({ role, className }: { role: string | undefined | null; className?: string }) {
    const safeRole = normalizeRole(role)

    if (!safeRole) {
        return (
            <Badge variant="outline" className={cn("min-w-0 max-w-full shrink border-dashed text-muted-foreground", className)}>
                <Shield className="h-3 w-3 shrink-0" />
                <span className="truncate">Sin rol</span>
            </Badge>
        )
    }

    return (
        // `shrink min-w-0` anula el `shrink-0` del Badge para que se recorte en vez de desbordar su contenedor
        <Badge variant={ROLE_VARIANT[safeRole]} className={cn("min-w-0 max-w-full shrink", className)}>
            <Shield className="h-3 w-3 shrink-0" />
            <span className="truncate">{ROLE_LABELS[safeRole]}</span>
        </Badge>
    )
}
