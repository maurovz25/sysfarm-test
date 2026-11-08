"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { UserPlus, CircleNotch as Loader2, Trash as Trash2, PencilSimple } from "@phosphor-icons/react"
import { useUserRole } from "@/hooks/use-user-role"
import { UserRole, ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/roles"
import { api } from "@/lib/api"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { toast } from "sonner"
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
import { useUsers, type AppUser } from "@/hooks/use-queries"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { RoleSelect } from "@/components/usuarios/role-select"
import { RoleChangeDialog, type PendingRoleChange } from "@/components/usuarios/role-change-dialog"
import { EditUserDialog } from "@/components/usuarios/edit-user-dialog"
import { StatusCell } from "@/components/usuarios/status-cell"
import { normalizeRole } from "@/components/usuarios/role-badge"

const COLUMN_COUNT = 6

export default function UsuariosPage() {
    const { user: currentUser, hasPermission } = useUserRole()
    const { data: rawUsersData = [], isLoading: fetchingUsers, refetch: refetchUsers } = useUsers({ live: true })
    const [creating, setCreating] = useState(false)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [userToDelete, setUserToDelete] = useState<{ id: string; email: string } | null>(null)
    const [userToEdit, setUserToEdit] = useState<AppUser | null>(null)
    const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange | null>(null)
    const [savingRole, setSavingRole] = useState(false)

    const [itemsPerPage, setItemsPerPage] = useState(15)
    const [currentPage, setCurrentPage] = useState(1)

    // Form state
    const [newUser, setNewUser] = useState({
        email: "",
        password: "",
        full_name: "",
        role: UserRole.VENDEDOR,
    })

    const users: AppUser[] = rawUsersData
    const totalPages = Math.ceil(users.length / itemsPerPage)
    const paginatedUsers = users.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    const fetchUsers = async (_silent = false) => {
        refetchUsers()
    }


    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreating(true)

        try {
            await api.post('/users', {
                email: newUser.email,
                password: newUser.password,
                full_name: newUser.full_name,
                role: newUser.role,
            })

            toast.success('Usuario creado exitosamente')
            setShowCreateForm(false)
            setNewUser({
                email: "",
                password: "",
                full_name: "",
                role: UserRole.VENDEDOR,
            })
            fetchUsers(true)
        } catch (error) {
            console.error('Error creating user:', error)
            toast.error('Error al crear usuario')
        } finally {
            setCreating(false)
        }
    }

    // El select solo propone el cambio; se aplica tras confirmar en el modal
    const requestRoleChange = (user: AppUser, newRole: UserRole) => {
        if (normalizeRole(user.role) === newRole) return
        setPendingRoleChange({ user, newRole })
    }

    const confirmRoleChange = async () => {
        if (!pendingRoleChange) return
        const { user, newRole } = pendingRoleChange

        setSavingRole(true)
        try {
            await api.put(`/users/${user.id}`, { role: newRole })

            toast.success(`Rol de ${user.full_name || user.email} actualizado a ${ROLE_LABELS[newRole]}`)
            setPendingRoleChange(null)
            fetchUsers(true)
        } catch (error: any) {
            console.error('Error updating role:', error)
            toast.error(error?.message || 'Error al actualizar rol')
        } finally {
            setSavingRole(false)
        }
    }

    const confirmDeleteUser = async () => {
        if (!userToDelete) return

        try {
            await api.delete(`/users/${userToDelete.id}`)
            toast.success(`Usuario "${userToDelete.email}" eliminado exitosamente`)
            setUserToDelete(null)
            fetchUsers(true)
        } catch (error: any) {
            console.error('Error deleting user:', error)
            toast.error(error?.message || 'Error al eliminar usuario')
        }
    }

    if (!hasPermission('canManageUsers')) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Acceso Denegado</CardTitle>
                        <CardDescription>
                            No tienes permisos para gestionar usuarios.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
                    <p className="text-muted-foreground">Administra usuarios y sus roles</p>
                </div>
                <Button onClick={() => setShowCreateForm(!showCreateForm)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Crear Usuario
                </Button>
            </div>

            {showCreateForm && (
                <Card>
                    <CardHeader>
                        <CardTitle>Crear Nuevo Usuario</CardTitle>
                        <CardDescription>Los usuarios recibirán un email de confirmación</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={newUser.email}
                                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="full_name">Nombre Completo</Label>
                                    <Input
                                        id="full_name"
                                        value={newUser.full_name}
                                        onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="password">Contraseña</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={newUser.password}
                                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                        required
                                        minLength={6}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="role">Rol</Label>
                                    <Select
                                        value={newUser.role}
                                        onValueChange={(value) => setNewUser({ ...newUser, role: value as UserRole })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.values(UserRole).map((role) => (
                                                <SelectItem key={role} value={role}>
                                                    <div className="flex flex-col">
                                                        <span>{ROLE_LABELS[role]}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {ROLE_DESCRIPTIONS[role]}
                                                        </span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button type="submit" disabled={creating}>
                                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Crear Usuario
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowCreateForm(false)}
                                >
                                    Cancelar
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Usuarios del Sistema</CardTitle>
                    <CardDescription>Total: {users.length} usuarios</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Fecha de Creación</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fetchingUsers ? (
                                <TableSkeleton
                                    columns={COLUMN_COUNT}
                                    rows={5}
                                    columnWidths={["w-36", "w-44", "w-48", "w-28", "w-28", "w-20 ml-auto"]}
                                />
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={COLUMN_COUNT} className="text-center py-8 text-muted-foreground">
                                        No se encontraron usuarios
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedUsers.map((user) => {
                                    const isSelf = user.id === currentUser?.id
                                    const displayName = user.full_name || 'Sin nombre'

                                    return (
                                        <TableRow key={user.id}>
                                            <TableCell className="font-medium">
                                                {displayName}
                                                {isSelf && (
                                                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                        Tú
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>{user.email}</TableCell>
                                            <TableCell>
                                                <RoleSelect
                                                    value={user.role}
                                                    onChange={(role) => requestRoleChange(user, role)}
                                                    disabled={isSelf}
                                                    disabledReason="No puedes cambiar tu propio rol"
                                                    ariaLabel={`Rol de ${displayName}`}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <StatusCell
                                                    isOnline={isSelf || user.is_online}
                                                    lastSignInAt={user.last_sign_in_at}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {new Date(user.created_at).toLocaleDateString('es-ES')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title="Editar usuario"
                                                        aria-label={`Editar ${displayName}`}
                                                        onClick={() => setUserToEdit(user)}
                                                    >
                                                        <PencilSimple className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title={isSelf ? "No puedes eliminar tu propia cuenta" : "Eliminar usuario"}
                                                        aria-label={`Eliminar ${displayName}`}
                                                        disabled={isSelf}
                                                        onClick={() => setUserToDelete({ id: user.id, email: user.email })}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>

                    {!fetchingUsers && users.length > 0 && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={users.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={(newSize) => {
                                setItemsPerPage(newSize)
                                setCurrentPage(1)
                            }}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Modal de edición (nombre y contraseña) */}
            <EditUserDialog
                user={userToEdit}
                onClose={() => setUserToEdit(null)}
                onSaved={() => fetchUsers(true)}
            />

            {/* Modal de confirmación de cambio de rol */}
            <RoleChangeDialog
                pending={pendingRoleChange}
                saving={savingRole}
                onCancel={() => setPendingRoleChange(null)}
                onConfirm={confirmRoleChange}
            />

            {/* Modal de Confirmación de Eliminación de Usuario */}
            <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar este usuario?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El usuario <strong className="text-foreground">{userToDelete?.email}</strong> perderá el acceso al sistema. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-2">
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            onClick={confirmDeleteUser}
                        >
                            Eliminar Usuario
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
