"use client"

import { ArrowRight, CircleNotch as Loader2, Warning } from "@phosphor-icons/react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { UserRole, ROLE_DESCRIPTIONS } from "@/lib/roles"
import type { AppUser } from "@/hooks/use-queries"
import { RoleBadge, normalizeRole } from "@/components/usuarios/role-badge"

export interface PendingRoleChange {
    user: AppUser
    newRole: UserRole
}

interface RoleChangeDialogProps {
    pending: PendingRoleChange | null
    saving: boolean
    onCancel: () => void
    onConfirm: () => void
}

export function RoleChangeDialog({ pending, saving, onCancel, onConfirm }: RoleChangeDialogProps) {
    const currentRole = normalizeRole(pending?.user.role)
    const newRole = pending?.newRole
    const touchesAdmin = newRole === UserRole.ADMIN || currentRole === UserRole.ADMIN
    const grantsAdmin = newRole === UserRole.ADMIN

    return (
        <AlertDialog open={!!pending} onOpenChange={(open) => !open && !saving && onCancel()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        ¿Cambiar el rol de {pending?.user.full_name || pending?.user.email}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>{pending?.user.email}</AlertDialogDescription>
                </AlertDialogHeader>

                {pending && newRole && (
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                            <RoleBadge role={currentRole} />
                            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="cambia a" />
                            <RoleBadge role={newRole} />
                        </div>

                        <p className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Nuevo acceso:</span>{" "}
                            {ROLE_DESCRIPTIONS[newRole]}.
                        </p>

                        {touchesAdmin && (
                            <div
                                role="alert"
                                className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                            >
                                <Warning className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>
                                    {grantsAdmin
                                        ? "Estás otorgando acceso total al sistema, incluida la gestión de usuarios."
                                        : "Se le quitará el acceso de administrador y la gestión de usuarios."}
                                </span>
                            </div>
                        )}

                        <div className="flex gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                            <Warning className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                                Este cambio modifica los permisos de la cuenta y se aplica de inmediato en el servidor.
                                En el equipo del usuario se verá al recargar o renovar la sesión.
                            </span>
                        </div>
                    </div>
                )}

                <AlertDialogFooter className="mt-2">
                    <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={saving}
                        className={
                            touchesAdmin
                                ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                : undefined
                        }
                        onClick={(event) => {
                            // Evita que el diálogo se cierre solo: se cierra cuando termina de guardar
                            event.preventDefault()
                            onConfirm()
                        }}
                    >
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Sí, cambiar rol
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
