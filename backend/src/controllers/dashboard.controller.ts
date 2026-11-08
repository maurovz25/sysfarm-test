import { Request, Response } from 'express';
import prisma from '../prisma';

interface CachedSummary {
    data: any;
    expiresAt: number;
    isRefreshing?: boolean;
}

let cachedSummary: CachedSummary | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutos de frescura en memoria

// Computa el resumen del dashboard directamente en PostgreSQL mediante CTE unificada
export const computeDashboardSummary = async () => {
    const result = await prisma.$queryRaw<Array<{
        totalValue: number | string | null;
        vencidosCount: number;
        proximosCount: number;
        expiryAlerts: any[];
        lowStockCount: number;
        stockAlerts: any[];
        topProducts: any[];
        movimientosHoy: number;
        recentMovements: any[];
    }>>`
        WITH 
        -- 1. Valor total valorizado de lotes activos con stock > 0
        total_val AS (
            SELECT COALESCE(SUM(b."stockActual" * (b."precioCostoPresentacion" / NULLIF(b."cantidadPorPresentacion", 0))), 0)::NUMERIC as "totalValue"
            FROM "Batch" b
            WHERE b."deletedAt" IS NULL AND b."stockActual" > 0
        ),

        -- 2. Alertas de vencimiento con stock físico real (> 0) en los próximos 90 días (TODAS)
        expiry_all AS (
            SELECT 
                b.id,
                p.id as "productId",
                p.nombre as name,
                b.codigo as lote,
                COALESCE(b.laboratorio, 'N/A') as laboratorio,
                b."fechaExpiracion" as fecha,
                b."stockActual" as stock,
                CAST(CEIL(EXTRACT(EPOCH FROM (b."fechaExpiracion" - NOW())) / 86400) AS INTEGER) as dias,
                CASE 
                    WHEN b."fechaExpiracion" <= NOW() THEN 'vencido'
                    ELSE 'proximo'
                END as status
            FROM "Batch" b
            JOIN "Product" p ON p.id = b."productId"
            WHERE b."deletedAt" IS NULL 
              AND p."deletedAt" IS NULL
              AND b."stockActual" > 0
              AND b."fechaExpiracion" <= NOW() + INTERVAL '90 days'
            ORDER BY b."fechaExpiracion" ASC
        ),
        expiry_counts AS (
            SELECT 
                COUNT(*) FILTER (WHERE status = 'vencido')::INTEGER as "vencidosCount",
                COUNT(*) FILTER (WHERE status = 'proximo')::INTEGER as "proximosCount"
            FROM expiry_all
        ),
        expiry_list AS (
            SELECT COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', id,
                        'productId', "productId",
                        'name', name,
                        'lote', lote,
                        'laboratorio', laboratorio,
                        'fecha', fecha,
                        'dias', dias,
                        'stock', stock,
                        'status', status
                    )
                ), '[]'::json
            ) as "expiryAlerts"
            FROM expiry_all sub_expiry
        ),

        -- 3. Stock crítico por producto (TODOS los productos con stock <= stockMinimo, sin recortes)
        batch_stock_agg AS (
            SELECT 
                b."productId",
                COALESCE(MAX(b.laboratorio), 'N/A') as laboratorio,
                COALESCE(SUM(b."stockActual"), 0)::INTEGER as stock
            FROM "Batch" b
            WHERE b."deletedAt" IS NULL
            GROUP BY b."productId"
        ),
        stock_all AS (
            SELECT 
                p.id,
                p.nombre as name,
                COALESCE(ba.laboratorio, 'N/A') as laboratorio,
                COALESCE(ba.stock, 0)::INTEGER as stock,
                p."stockMinimo",
                CASE 
                    WHEN COALESCE(ba.stock, 0) = 0 THEN 'agotado'
                    ELSE 'bajo'
                END as status,
                COALESCE(p."unidadBase", 'unidades') as "unidadBase"
            FROM "Product" p
            LEFT JOIN batch_stock_agg ba ON ba."productId" = p.id
            WHERE p."deletedAt" IS NULL AND COALESCE(ba.stock, 0) <= p."stockMinimo"
            ORDER BY 
                CASE WHEN COALESCE(ba.stock, 0) = 0 THEN 0 ELSE 1 END ASC,
                p.nombre ASC
        ),
        stock_counts AS (
            SELECT COUNT(*)::INTEGER as "lowStockCount" FROM stock_all
        ),
        stock_list AS (
            SELECT COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', id,
                        'name', name,
                        'laboratorio', laboratorio,
                        'stock', stock,
                        'stockMinimo', "stockMinimo",
                        'status', status,
                        'unidadBase', "unidadBase"
                    )
                ), '[]'::json
            ) as "stockAlerts"
            FROM stock_all sub_stock
        ),

        -- 4. Top 5 productos con mayor salida en los últimos 30 días (ranking)
        top_prod AS (
            SELECT COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', sub_top.id,
                        'name', sub_top.name,
                        'stockMinimo', sub_top."stockMinimo",
                        'sales', sub_top.sales,
                        'stock', 0,
                        'trend', 'up'
                    )
                ), '[]'::json
            ) as "topProducts"
            FROM (
                SELECT 
                    p.id,
                    p.nombre as name,
                    p."stockMinimo",
                    CAST(SUM(m.cantidad) AS INTEGER) as sales
                FROM "Movement" m
                JOIN "Product" p ON p.id = m."productId"
                WHERE m.tipo = 'Salida' AND p."deletedAt" IS NULL
                GROUP BY p.id, p.nombre, p."stockMinimo"
                ORDER BY sales DESC
                LIMIT 5
            ) sub_top
        ),

        -- 5. Movimientos del día
        mov_today AS (
            SELECT COUNT(*)::INTEGER as "movimientosHoy"
            FROM "Movement"
            WHERE fecha >= CURRENT_DATE
        ),

        -- 6. Últimos 5 movimientos recientes
        mov_recent AS (
            SELECT COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', sub_mov.id,
                        'type', sub_mov.tipo,
                        'product', COALESCE(sub_mov.prod_nombre, 'Desconocido'),
                        'quantity', sub_mov.cantidad,
                        'user', COALESCE(sub_mov.usuario, 'Sistema'),
                        'date', sub_mov.fecha,
                        'unidadBase', COALESCE(sub_mov.prod_unidad, 'unid'),
                        'batchCodigo', COALESCE(sub_mov.batch_codigo, 'N/A')
                    )
                ), '[]'::json
            ) as "recentMovements"
            FROM (
                SELECT 
                    m.id,
                    m.tipo,
                    m.cantidad,
                    m.usuario,
                    m.fecha,
                    p.nombre as prod_nombre,
                    p."unidadBase" as prod_unidad,
                    b.codigo as batch_codigo
                FROM "Movement" m
                LEFT JOIN "Product" p ON p.id = m."productId"
                LEFT JOIN "Batch" b ON b.id = m."batchId"
                ORDER BY m.fecha DESC
                LIMIT 5
            ) sub_mov
        )

        SELECT 
            tv."totalValue",
            ec."vencidosCount",
            ec."proximosCount",
            el."expiryAlerts",
            sc."lowStockCount",
            sl."stockAlerts",
            tp."topProducts",
            mt."movimientosHoy",
            mr."recentMovements"
        FROM total_val tv
        CROSS JOIN expiry_counts ec
        CROSS JOIN expiry_list el
        CROSS JOIN stock_counts sc
        CROSS JOIN stock_list sl
        CROSS JOIN top_prod tp
        CROSS JOIN mov_today mt
        CROSS JOIN mov_recent mr;
    `;

    const row = result[0];

    const summaryPayload = {
        stats: {
            totalValue: Number(row?.totalValue || 0),
            gananciaVentas: 0,
            lowStock: Number(row?.lowStockCount || 0),
            proximosAVencer: Number(row?.proximosCount || 0),
            vencidos: Number(row?.vencidosCount || 0),
            movimientosHoy: Number(row?.movimientosHoy || 0)
        },
        expiryAlerts: row?.expiryAlerts || [],
        stockAlerts: row?.stockAlerts || [],
        topProducts: row?.topProducts || [],
        recentMovements: row?.recentMovements || []
    };

    cachedSummary = {
        data: summaryPayload,
        expiresAt: Date.now() + CACHE_TTL_MS,
        isRefreshing: false
    };

    return summaryPayload;
};

// Invalida la caché de memoria y dispara de inmediato la revalidación reactiva en segundo plano
export const invalidateDashboardCache = () => {
    if (cachedSummary) {
        cachedSummary.expiresAt = 0;
    }
    // Revalidación asíncrona reactiva sin bloquear el hilo principal
    computeDashboardSummary().catch(err => {
        console.error('Aviso: Error en revalidación reactiva de dashboard:', err.message);
    });
};

export const getDashboardSummary = async (req: Request, res: Response) => {
    try {
        const now = Date.now();

        // 1. Si la caché está activa y fresca, respuesta inmediata (< 2 ms)
        if (cachedSummary && cachedSummary.expiresAt > now) {
            return res.json(cachedSummary.data);
        }

        // 2. Si la caché expiró pero hay datos previos (SWR): responder de inmediato con datos stale y refrescar en background
        if (cachedSummary && !cachedSummary.isRefreshing) {
            cachedSummary.isRefreshing = true;
            res.json(cachedSummary.data);
            computeDashboardSummary().catch(err => {
                console.error('Error revalidando dashboard en background:', err.message);
                if (cachedSummary) cachedSummary.isRefreshing = false;
            });
            return;
        }

        // 3. Si no hay datos en memoria (primer arranque sin warm-up completado): computar y responder
        const freshData = await computeDashboardSummary();
        res.json(freshData);
    } catch (error) {
        console.error('Error fetching dashboard summary:', error);
        res.status(500).json({ error: 'Error al obtener el resumen del dashboard' });
    }
};
