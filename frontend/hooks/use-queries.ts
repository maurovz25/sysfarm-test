import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Query keys centralizados para invalidación fina
export const QUERY_KEYS = {
    dashboardSummary: ['dashboard', 'summary'] as const,
    products: ['products'] as const,
    productAudit: ['products', 'audit'] as const,
    movements: (tipo?: string, includeGuias = false) => ['movements', tipo || 'all', includeGuias ? 'with-guias' : 'no-guias'] as const,
    requerimientos: (estado?: string) => ['requerimientos', estado || 'all'] as const,
    requerimientoById: (id: string) => ['requerimientos', id] as const,
    guias: ['guias'] as const,
    movementGuias: (mId: string) => ['guias', 'movement', mId] as const,
    areas: (incluirInactivas = false) => ['areas', incluirInactivas] as const,
    plantillas: ['plantillas'] as const,
    batches: ['batches'] as const,
    batchAdjustments: ['batches', 'adjustments'] as const,
    users: ['users'] as const,
}

// 0. Dashboard Summary
export function useDashboardSummary() {
    return useQuery({
        queryKey: QUERY_KEYS.dashboardSummary,
        queryFn: async () => {
            return await api.get('/dashboard/summary')
        },
        staleTime: 1000 * 60 * 2, // 2 minutos de datos frescos
    })
}

// 1. Productos
export function useProducts() {
    return useQuery({
        queryKey: QUERY_KEYS.products,
        queryFn: async () => {
            return await api.get('/products')
        },
        staleTime: 1000 * 60 * 5, // 5 minutos de datos frescos
    })
}

export function useProductAudit() {
    return useQuery({
        queryKey: QUERY_KEYS.productAudit,
        queryFn: async () => {
            return await api.get('/products/audit')
        },
        staleTime: 1000 * 60 * 2,
    })
}

// 2. Inventario y Movimientos
export function useMovements(
    tipo?: string, 
    includeGuias = false, 
    options?: { productId?: string; limit?: number; mes?: number; anio?: number }
) {
    const { productId, limit, mes, anio } = options || {}
    return useQuery({
        queryKey: ['movements', tipo || 'all', includeGuias ? 'with-guias' : 'no-guias', productId || 'all', limit || 'all', mes || '', anio || ''],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (tipo) params.append('tipo', tipo)
            if (includeGuias) params.append('includeGuias', 'true')
            if (productId) params.append('productId', productId)
            if (limit) params.append('limit', String(limit))
            if (mes) params.append('mes', String(mes))
            if (anio) params.append('anio', String(anio))
            const qs = params.toString()
            const endpoint = qs ? `/inventory?${qs}` : '/inventory'
            return await api.get(endpoint)
        },
        staleTime: 1000 * 60 * 2,
    })
}

export function useMonthlyMovementStats(tipo?: string) {
    return useQuery({
        queryKey: ['movements', 'stats', 'monthly', tipo || 'all'],
        queryFn: async () => {
            const endpoint = tipo ? `/inventory/stats/monthly?tipo=${tipo}` : '/inventory/stats/monthly'
            return await api.get(endpoint)
        },
        staleTime: 1000 * 60 * 2,
    })
}

// 3. Requerimientos
export function useRequerimientos(estado?: string) {
    return useQuery({
        queryKey: QUERY_KEYS.requerimientos(estado),
        queryFn: async () => {
            const endpoint = estado ? `/requerimientos?estado=${estado}` : '/requerimientos'
            return await api.get(endpoint)
        },
        staleTime: 1000 * 60 * 2,
    })
}

export function usePendingRequerimientosCount() {
    return useQuery({
        queryKey: ['requerimientos', 'count', 'pending'],
        queryFn: async () => {
            const res = await api.get('/requerimientos/count/pending')
            return res?.pendingCount ?? 0
        },
        staleTime: 1000 * 60 * 2,
    })
}

// 4. Guías de Salida
export function useGuiasSalida() {
    return useQuery({
        queryKey: QUERY_KEYS.guias,
        queryFn: async () => {
            return await api.get('/guias')
        },
        staleTime: 1000 * 60 * 3,
    })
}

export function useMovementGuias(mId: string | null) {
    return useQuery({
        queryKey: QUERY_KEYS.movementGuias(mId || ''),
        queryFn: async () => {
            if (!mId) return null
            return await api.get(`/guias/movimiento/${mId}`)
        },
        enabled: !!mId,
        staleTime: 1000 * 60 * 5,
    })
}

// 5. Áreas y Plantillas
export function useAreas(incluirInactivas = false) {
    return useQuery({
        queryKey: QUERY_KEYS.areas(incluirInactivas),
        queryFn: async () => {
            const endpoint = incluirInactivas ? '/areas?incluirInactivas=true' : '/areas'
            return await api.get(endpoint)
        },
        staleTime: 1000 * 60 * 10, // Las áreas cambian muy poco
    })
}

export function usePlantillas() {
    return useQuery({
        queryKey: QUERY_KEYS.plantillas,
        queryFn: async () => {
            return await api.get('/plantillas')
        },
        staleTime: 1000 * 60 * 5,
    })
}

// 6. Lotes y Ajustes
export function useBatches() {
    return useQuery({
        queryKey: QUERY_KEYS.batches,
        queryFn: async () => {
            return await api.get('/batches')
        },
        staleTime: 1000 * 60 * 3,
    })
}

export function useBatchAdjustments() {
    return useQuery({
        queryKey: QUERY_KEYS.batchAdjustments,
        queryFn: async () => {
            return await api.get('/batches/adjustments/history')
        },
        staleTime: 1000 * 60 * 3,
    })
}

// 7. Usuarios
export interface AppUser {
    id: string
    email: string
    full_name: string | null
    role: string | null // null = cuenta sin rol asignado
    created_at: string
    last_sign_in_at: string | null
    is_online: boolean
    last_seen_at: string | null
}

// `live`: refresca cada 30 s mientras la pestaña está visible (para el estado Conectado)
export function useUsers(options?: { live?: boolean }) {
    const live = options?.live ?? false
    return useQuery<AppUser[]>({
        queryKey: QUERY_KEYS.users,
        queryFn: async () => {
            return await api.get('/users')
        },
        staleTime: live ? 0 : 1000 * 60 * 10,
        refetchInterval: live ? 30_000 : false,
        refetchIntervalInBackground: false,
    })
}

// Hook de ayuda para invalidación post-mutaciones (crear/editar/eliminar)
export function useInvalidateData() {
    const queryClient = useQueryClient()
    return {
        invalidateProducts: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products }),
        invalidateMovements: () => queryClient.invalidateQueries({ queryKey: ['movements'] }),
        invalidateRequerimientos: () => queryClient.invalidateQueries({ queryKey: ['requerimientos'] }),
        invalidateGuias: () => queryClient.invalidateQueries({ queryKey: ['guias'] }),
        invalidateAreas: () => queryClient.invalidateQueries({ queryKey: ['areas'] }),
        invalidatePlantillas: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.plantillas }),
        invalidateBatches: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.batches }),
        invalidateUsers: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users }),
        invalidateAll: () => queryClient.invalidateQueries(),
    }
}
