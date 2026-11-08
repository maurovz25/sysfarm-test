import { supabase } from '@/lib/supabase'

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '')
const API_URL = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`

const getUrl = (endpoint: string) => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return `${API_URL}${cleanEndpoint}`
}

let cachedAccessToken: string | null = null

// Escuchar cambios de autenticación para mantener el token actualizado en memoria
supabase.auth.onAuthStateChange((_event, session) => {
    cachedAccessToken = session?.access_token || null
})

async function getHeaders(forceRefresh = false) {
    if (forceRefresh || !cachedAccessToken) {
        const { data: { session } } = await supabase.auth.getSession()
        cachedAccessToken = session?.access_token || null
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }

    if (cachedAccessToken) {
        headers['Authorization'] = `Bearer ${cachedAccessToken}`
    }

    return headers
}

async function requestWithAuth(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<any> {
    const headers = await getHeaders(retryCount > 0)
    const finalOptions: RequestInit = {
        ...options,
        headers: {
            ...headers,
            ...(options.headers as Record<string, string> || {}),
        },
    }

    const res = await fetch(getUrl(endpoint), finalOptions)

    // Si recibimos 401 y aún no hemos reintentado, intentar refrescar el token
    if (res.status === 401 && retryCount === 0) {
        try {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
            if (!refreshError && refreshData.session?.access_token) {
                cachedAccessToken = refreshData.session.access_token
                return await requestWithAuth(endpoint, options, 1)
            }
        } catch (e) {
            console.warn("Fallo al refrescar sesión automáticamente:", e)
        }

        // Si el refresco falló, la sesión expiró definitivamente
        cachedAccessToken = null
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            window.location.href = '/login'
        }
    }

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `API Error: ${res.statusText}`)
    }

    return res.json()
}

export const api = {
    get: async (endpoint: string) => {
        return requestWithAuth(endpoint, { method: 'GET' })
    },

    post: async (endpoint: string, body: any) => {
        return requestWithAuth(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
        })
    },

    put: async (endpoint: string, body: any) => {
        return requestWithAuth(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body),
        })
    },

    delete: async (endpoint: string) => {
        return requestWithAuth(endpoint, { method: 'DELETE' })
    },

    stream: async (endpoint: string, body: any, onChunk: (text: string) => void) => {
        const headers = await getHeaders()
        const res = await fetch(getUrl(endpoint), {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
            },
            body: JSON.stringify({ ...body, stream: true }),
        })

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}))
            throw new Error(errorData.error || `API Error: ${res.statusText}`)
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error("No se pudo iniciar el flujo de respuesta")

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
            const { value, done } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed.startsWith('data:')) continue
                const jsonStr = trimmed.replace(/^data:\s*/, '')
                if (jsonStr === '[DONE]') continue
                try {
                    const parsed = JSON.parse(jsonStr)
                    if (parsed.text) {
                        onChunk(parsed.text)
                    }
                    if (parsed.error) {
                        throw new Error(parsed.error)
                    }
                } catch {
                    // Ignorar errores parciales de buffer
                }
            }
        }
    },
}
