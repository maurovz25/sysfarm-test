'use client'

import { useEffect } from 'react'
import { api } from '@/lib/api'

const HEARTBEAT_INTERVAL_MS = 60_000
const IDLE_LIMIT_MS = 5 * 60_000
const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'scroll', 'wheel'] as const

// Avisa al backend que el usuario sigue activo. Solo envía si la pestaña está visible
// y hubo interacción reciente; un usuario inactivo no genera tráfico.
export function usePresenceHeartbeat(enabled: boolean) {
    useEffect(() => {
        if (!enabled) return

        let lastInteraction = Date.now()

        const send = () => {
            if (document.visibilityState !== 'visible') return
            if (Date.now() - lastInteraction > IDLE_LIMIT_MS) return
            api.post('/presence/heartbeat', {}).catch(() => {
                // La presencia es informativa: un fallo no debe molestar al usuario
            })
        }

        const onInteraction = () => {
            const now = Date.now()
            const wasIdle = now - lastInteraction > IDLE_LIMIT_MS
            lastInteraction = now
            if (wasIdle) send()
        }

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') send()
        }

        send()
        const timer = setInterval(send, HEARTBEAT_INTERVAL_MS)
        // capture: los scrolls de contenedores internos (main) no burbujean hasta window
        INTERACTION_EVENTS.forEach((eventName) =>
            window.addEventListener(eventName, onInteraction, { passive: true, capture: true })
        )
        document.addEventListener('visibilitychange', onVisibilityChange)

        return () => {
            clearInterval(timer)
            INTERACTION_EVENTS.forEach((eventName) =>
                window.removeEventListener(eventName, onInteraction, { capture: true })
            )
            document.removeEventListener('visibilitychange', onVisibilityChange)
        }
    }, [enabled])
}
