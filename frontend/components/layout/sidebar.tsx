"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  SquaresFour as LayoutDashboard,
  Package,
  ArrowLineDown as ArrowDownToLine,
  ArrowLineUp as ArrowUpFromLine,
  FileText,
  SignOut as LogOut,
  List as Menu,
  X,
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  CaretDown as ChevronDown,
  User,
  Archive as PackageCheck,
  Robot as Bot,
  ClipboardText as ClipboardList,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { auth } from "@/lib/supabase"
import { api } from "@/lib/api"
import { useUserRole } from "@/hooks/use-user-role"
import { ROLE_LABELS } from "@/lib/roles"
import { usePendingRequerimientosCount } from "@/hooks/use-queries"

interface MenuItem {
  title: string
  href: string
  icon: any
  badge?: number
  subItems?: { title: string; href: string }[]
}

const menuItems: MenuItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Inventario",
    href: "/inventario",
    icon: Package,
  },
  {
    title: "Requerimientos",
    href: "/requerimientos",
    icon: ClipboardList,
    subItems: [
      { title: "Crear Pedido", href: "/requerimientos/nuevo" },
      { title: "Gestión de Pedidos", href: "/requerimientos" },
      { title: "Plantillas", href: "/requerimientos/plantillas" },
      { title: "Áreas", href: "/requerimientos/areas" },
    ],
  },
  {
    title: "Ingresos",
    href: "/ingresos",
    icon: ArrowDownToLine,
    subItems: [
      { title: "Registrar", href: "/ingresos/nuevo" },
      { title: "Historial", href: "/ingresos" },
    ],
  },
  {
    title: "Salidas",
    href: "/salidas",
    icon: ArrowUpFromLine,
    subItems: [
      { title: "Registrar", href: "/salidas/nuevo" },
      { title: "Historial", href: "/salidas" },
    ],
  },
  {
    title: "Kardex",
    href: "/kardex",
    icon: FileText,
  },
  {
    title: "Lotes",
    href: "/lotes",
    icon: PackageCheck,
  },
  {
    title: "Asistente IA",
    href: "/asistente",
    icon: Bot,
  },
  {
    title: "Usuarios",
    href: "/usuarios",
    icon: User,
  },
]

interface SidebarProps {
  onCollapseChange?: (collapsed: boolean) => void
}

export function Sidebar({ onCollapseChange }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, role } = useUserRole()
  const [isOpen, setIsOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const { data: pendingReqCount = 0 } = usePendingRequerimientosCount()

  useEffect(() => {
    setMounted(true)
  }, [])


  useEffect(() => {
    onCollapseChange?.(isCollapsed)
  }, [isCollapsed, onCollapseChange])

  // Auto-expand submenu if active path
  useEffect(() => {
    if (isCollapsed) return
    const activeItem = menuItems.find(item =>
      item.subItems?.some(sub => pathname === sub.href)
    )
    if (activeItem) {
      setOpenSubmenu(activeItem.title)
    }
  }, [pathname, isCollapsed])

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
    if (!isCollapsed) {
      setOpenSubmenu(null) // Cerrar submenús al colapsar sidebar
    }
  }

  const toggleSubmenu = (title: string) => {
    if (isCollapsed) return
    setOpenSubmenu(openSubmenu === title ? null : title)
  }

  const handleLogout = async () => {
    try {
      // Antes de cerrar sesión (necesita el token) para que figure Desconectado de inmediato
      await api.post('/presence/offline', {}).catch(() => {})
      await auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden bg-card border shadow-sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay */}
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out lg:translate-x-0 flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full",
          isCollapsed ? "lg:w-16" : "lg:w-64",
          "w-64",
        )}
      >
        {/* Logo */}
        <div className={cn("flex h-16 items-center border-b border-sidebar-border relative shrink-0", isCollapsed ? "justify-center px-0" : "gap-3 px-4")}>
          {!isCollapsed && (
            <>
              <img
                src="/icon.png"
                alt="Logo SysFarm"
                className="h-10 w-auto max-w-[50px] object-contain  invert"
              />
              <div className="flex flex-col min-w-0 justify-center">
                <h1 className="text-base font-bold text-sidebar-foreground leading-tight tracking-tight truncate">
                  SysFarm
                </h1>
                <p className="text-xs text-sidebar-foreground/60 leading-none truncate mt-0.5">
                  Gestión Farmacéutica
                </p>
              </div>
            </>
          )}
          {isCollapsed && (
            <div className="flex items-center justify-center w-full">
              <img
                src="/icon.png"
                alt="Logo SysFarm"
                className="h-10 w-10 object-contain  invert"
              />
            </div>
          )}
          {/* Toggle Button */}
          <button
            className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:shadow-md transition-shadow z-50"
            onClick={toggleCollapse}
          >
            {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
          {mounted && menuItems
            .filter(item => {
              // Ocultar "Usuarios" si no es admin
              if (item.href === '/usuarios' && role !== 'admin') {
                return false
              }
              // Si el usuario es solicitante, solo mostrar el módulo de requerimientos
              if (role === 'solicitante' && item.href !== '/requerimientos') {
                return false
              }
              // Si el usuario es auditor, solo mostrar inventario, lotes y kardex
              if (role === 'auditor' && !['/inventario', '/lotes', '/kardex'].includes(item.href)) {
                return false
              }
              return true
            })
            .map((item) => {
              const isActive = pathname === item.href || item.subItems?.some(sub => pathname === sub.href)
              const isSubmenuOpen = openSubmenu === item.title

              if (item.subItems && !isCollapsed) {
                return (
                  <Collapsible
                    key={item.title}
                    open={isSubmenuOpen}
                    onOpenChange={() => toggleSubmenu(item.title)}
                    className="space-y-1"
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-between font-medium relative",
                          isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          {item.title}
                          {item.href === '/requerimientos' && pendingReqCount > 0 && (
                            <span className="bg-amber-500 text-white rounded-full px-2 py-0.5 text-xs font-bold shadow-sm">
                              {pendingReqCount}
                            </span>
                          )}
                        </div>
                        <ChevronDown
                          className={cn("h-4 w-4 transition-transform duration-200", isSubmenuOpen && "rotate-180")}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 pl-9">
                      {item.subItems
                        .filter((sub) => {
                          if (sub.href === '/requerimientos/areas' && role !== 'admin' && role !== 'farmaceutico') {
                            return false
                          }
                          return true
                        })
                        .map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            "block rounded-md px-3 py-2 text-sm transition-colors",
                            pathname === sub.href
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                          )}
                        >
                          {sub.title}
                        </Link>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    setIsOpen(false)
                    if (isCollapsed) setOpenSubmenu(null)
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground relative",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80",
                    isCollapsed && "justify-center",
                  )}
                  title={isCollapsed ? item.title : undefined}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && item.title}
                  {!isCollapsed && item.href === '/requerimientos' && pendingReqCount > 0 && (
                    <span className="ml-auto bg-amber-500 text-white rounded-full px-2 py-0.5 text-xs font-bold shadow-sm">
                      {pendingReqCount}
                    </span>
                  )}
                </Link>
              )
            })}
        </nav>

        {/* User Profile & Logout */}
        <div className="border-t border-sidebar-border p-4 space-y-4 shrink-0">
          {mounted && !isCollapsed && (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent/30">
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold truncate text-white">
                  Usuario: {user?.user_metadata?.full_name}
                </span>
                <span className="text-xs text-white/60 truncate">
                  Rol: {role ? ROLE_LABELS[role] : 'Sin rol'}
                </span>
              </div>
            </div>
          )}

          <Button
            variant="ghost"
            className={cn(
              "w-full gap-3 bg-red-500/10 text-red-100 hover:bg-red-500/20 hover:text-white border border-red-500/20 transition-all",
              isCollapsed ? "justify-center px-2" : "justify-start px-4",
            )}
            onClick={handleLogout}
            title={isCollapsed ? "Cerrar Sesión" : undefined}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && "Cerrar Sesión"}
          </Button>
        </div>
      </aside>

      <div className={cn("hidden lg:block flex-shrink-0 transition-all duration-300", isCollapsed ? "w-16" : "w-64")} />
    </>
  )
}

