"use client"

import type React from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useUserRole } from "@/hooks/use-user-role"
import { canAccessRoute } from "@/lib/roles"
import { usePresenceHeartbeat } from "@/hooks/use-presence-heartbeat"
import { auth } from "@/lib/supabase"
import { toast } from "sonner"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, role, loading } = useUserRole()

  usePresenceHeartbeat(!loading && !!user && !!role)

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login')
        return
      }

      // Sin rol válido en app_metadata no hay acceso: se cierra la sesión
      if (!role) {
        toast.error('Tu cuenta no tiene un rol asignado. Contacta al administrador.')
        auth.signOut().finally(() => router.replace('/login'))
        return
      }

      if (role === 'solicitante' && !pathname.startsWith('/requerimientos')) {
        router.push('/requerimientos')
      } else if (role === 'auditor' && !['/inventario', '/lotes', '/kardex'].includes(pathname)) {
        router.push('/inventario')
      } else if (!canAccessRoute(user, pathname)) {
        router.push(role === 'solicitante' ? '/requerimientos' : role === 'auditor' ? '/inventario' : '/dashboard')
      }
    }
  }, [user, role, loading, pathname, router])

  if (loading || !user || !role) {
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onCollapseChange={setIsCollapsed} />
      <div className="flex flex-1 flex-col min-w-0">
        <main className="flex-1 overflow-y-auto bg-background p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}

