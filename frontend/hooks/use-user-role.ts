'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { UserRole, getUserRole, hasPermission, ROLE_PERMISSIONS, NO_PERMISSIONS, type PermissionKey } from '@/lib/roles'

export function useUserRole() {
    const [user, setUser] = useState<any>(null)
    // null = cuenta sin rol asignado (sin acceso)
    const [role, setRole] = useState<UserRole | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let isMounted = true

        const syncUserFromSession = (currentUser: any) => {
            if (!isMounted) return
            if (currentUser) {
                setUser(currentUser)
                setRole(getUserRole(currentUser))
            } else {
                setUser(null)
                setRole(null)
            }
            setLoading(false)
        }

        // Carga inicial de sesión
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            let sessionUser = session?.user || null

            // Las sesiones guardadas antes de mover el rol a app_metadata no lo traen:
            // se renuevan una vez para obtener el rol actual del servidor.
            if (sessionUser && !getUserRole(sessionUser)) {
                const { data } = await supabase.auth.refreshSession()
                sessionUser = data.session?.user || sessionUser
            }

            syncUserFromSession(sessionUser)
        }).catch((err) => {
            console.error("Error al obtener sesión inicial:", err)
            if (isMounted) {
                setUser(null)
                setLoading(false)
            }
        })

        // Escuchar eventos de sesión (login, token refresh, logout) en tiempo real
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            syncUserFromSession(session?.user || null)
        })

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [])

    const checkPermission = (permission: PermissionKey) => {
        return hasPermission(user, permission)
    }

    return {
        user,
        role,
        loading,
        permissions: role ? ROLE_PERMISSIONS[role] : NO_PERMISSIONS,
        hasPermission: checkPermission,
    }
}
