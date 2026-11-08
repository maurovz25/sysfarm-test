// Presencia de usuarios en memoria: guarda la última actividad por usuario.
// No usa base de datos; si el backend se reinicia, cada usuario reaparece en su siguiente ping.

export const ONLINE_WINDOW_MS = 150_000; // 2,5 min: tolera un ping de 60 s con timers estrangulados
const STALE_ENTRY_MS = 60 * 60 * 1000; // 1 h: entradas más viejas se descartan
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

const lastSeen = new Map<string, number>();

export function touch(userId: string, now: number = Date.now()): void {
    lastSeen.set(userId, now);
}

export function clear(userId: string): void {
    lastSeen.delete(userId);
}

export function getLastSeen(userId: string): number | null {
    return lastSeen.get(userId) ?? null;
}

export function isOnline(userId: string, now: number = Date.now()): boolean {
    const seen = lastSeen.get(userId);
    return seen !== undefined && now - seen <= ONLINE_WINDOW_MS;
}

export function pruneStale(now: number = Date.now()): number {
    let removed = 0;
    for (const [userId, seen] of lastSeen.entries()) {
        if (now - seen > STALE_ENTRY_MS) {
            lastSeen.delete(userId);
            removed++;
        }
    }
    return removed;
}

setInterval(() => pruneStale(), CLEANUP_INTERVAL_MS).unref();
