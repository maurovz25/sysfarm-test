"use client"

import { useEffect, useState } from "react"
import { CircleNotch as Loader2, Eye, EyeSlash } from "@phosphor-icons/react"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import type { AppUser } from "@/hooks/use-queries"

const NAME_MIN_LENGTH = 2
const NAME_MAX_LENGTH = 80
const PASSWORD_MIN_LENGTH = 6

interface EditUserDialogProps {
    user: AppUser | null
    onClose: () => void
    onSaved: () => void
}

export function EditUserDialog({ user, onClose, onSaved }: EditUserDialogProps) {
    const [fullName, setFullName] = useState("")
    const [savedName, setSavedName] = useState("")
    const [changePassword, setChangePassword] = useState(false)
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [saving, setSaving] = useState(false)

    // Cada vez que se abre para otro usuario, se parte de sus datos actuales
    useEffect(() => {
        if (!user) return
        setFullName(user.full_name ?? "")
        setSavedName(user.full_name ?? "")
        setChangePassword(false)
        setPassword("")
        setConfirmPassword("")
        setShowPassword(false)
        setSaving(false)
    }, [user?.id])

    const trimmedName = fullName.trim()
    const nameChanged = trimmedName !== savedName.trim()
    const nameError =
        trimmedName.length < NAME_MIN_LENGTH || trimmedName.length > NAME_MAX_LENGTH
            ? `El nombre debe tener entre ${NAME_MIN_LENGTH} y ${NAME_MAX_LENGTH} caracteres`
            : null

    const wantsPassword = changePassword && password.length > 0
    const passwordError = !wantsPassword
        ? null
        : password.length < PASSWORD_MIN_LENGTH
            ? `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`
            : password !== confirmPassword
                ? "Las contraseñas no coinciden"
                : null

    const hasChanges = nameChanged || wantsPassword
    const canSave = hasChanges && !saving && !passwordError && (!nameChanged || !nameError)

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!user || !canSave) return

        setSaving(true)
        let nameSaved = false
        try {
            if (nameChanged) {
                await api.put(`/users/${user.id}`, { full_name: trimmedName })
                nameSaved = true
                setSavedName(trimmedName)
            }
            if (wantsPassword) {
                await api.put(`/users/${user.id}/password`, { password })
            }

            toast.success("Usuario actualizado exitosamente")
            onSaved()
            onClose()
        } catch (error: any) {
            console.error("Error updating user:", error)
            // Si el nombre ya se guardó, se refresca la lista aunque la contraseña haya fallado
            if (nameSaved) onSaved()
            toast.error(error?.message || "Error al actualizar el usuario")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={!!user} onOpenChange={(open) => !open && !saving && onClose()}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit} className="space-y-5">
                    <DialogHeader>
                        <DialogTitle>Editar usuario</DialogTitle>
                        <DialogDescription>Actualiza el nombre o la contraseña de la cuenta.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-full-name">Nombre completo</Label>
                            <Input
                                id="edit-full-name"
                                value={fullName}
                                onChange={(event) => setFullName(event.target.value)}
                                maxLength={NAME_MAX_LENGTH + 20}
                                autoFocus
                                aria-invalid={nameChanged && !!nameError}
                            />
                            {nameChanged && nameError && (
                                <p className="text-xs text-destructive">{nameError}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-email">Email</Label>
                            <Input id="edit-email" value={user?.email ?? ""} disabled readOnly />
                            <p className="text-xs text-muted-foreground">El email no se puede modificar.</p>
                        </div>

                        {!changePassword ? (
                            <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0"
                                onClick={() => setChangePassword(true)}
                            >
                                Cambiar contraseña
                            </Button>
                        ) : (
                            <div className="space-y-3 rounded-md border p-3">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="edit-password">Nueva contraseña</Label>
                                    <Button
                                        type="button"
                                        variant="link"
                                        className="h-auto p-0 text-xs"
                                        onClick={() => {
                                            setChangePassword(false)
                                            setPassword("")
                                            setConfirmPassword("")
                                        }}
                                    >
                                        Cancelar cambio
                                    </Button>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="edit-password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        autoComplete="new-password"
                                        className="pr-10"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3"
                                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                        onClick={() => setShowPassword((visible) => !visible)}
                                    >
                                        {showPassword ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-password-confirm">Confirmar contraseña</Label>
                                    <Input
                                        id="edit-password-confirm"
                                        type={showPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                        autoComplete="new-password"
                                    />
                                </div>
                                {passwordError ? (
                                    <p className="text-xs text-destructive">{passwordError}</p>
                                ) : (
                                    <p className="text-xs text-muted-foreground">
                                        Mínimo {PASSWORD_MIN_LENGTH} caracteres. Déjala vacía para no cambiarla.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={!canSave}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar cambios
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
