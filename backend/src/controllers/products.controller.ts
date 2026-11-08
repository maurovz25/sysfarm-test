import { Request, Response } from 'express';
import prisma from '../prisma';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { invalidateDashboardCache } from './dashboard.controller';

// Schema para crear un producto
const createProductSchema = z.object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
    codigoBarras: z.string().trim().nullable().optional(),
    descripcion: z.string().trim().nullable().optional(),
    tipo: z.string().nullable().optional(),
    registroSanitario: z.string().trim().nullable().optional(),
    presentacion: z.string().nullable().optional(),
    unidadBase: z.string().nullable().optional(),
    stockMinimo: z.number().int().nonnegative().default(0),
    // Campos opcionales para crear o actualizar lotes
    laboratorio: z.string().trim().nullable().optional(),
    cantidadPorPresentacion: z.number().int().positive().nullable().optional(),
    precioCostoPresentacion: z.number().nonnegative().nullable().optional(),
    precioVentaPresentacion: z.number().nonnegative().nullable().optional(),
    // Datos de lote inicial (opcionales)
    lote: z.string().trim().nullable().optional(),
    fechaExpiracion: z.string().trim().nullable().optional(),
    stockUnidad: z.number().int().nonnegative().nullable().optional(),
    usuario: z.string().trim().nullable().optional(),
});

export const getProducts = async (req: Request, res: Response) => {
    try {
        const { search, tipo, limit } = req.query;

        const whereConditions: Prisma.Sql[] = [Prisma.sql`p."deletedAt" IS NULL`];

        if (tipo) {
            whereConditions.push(Prisma.sql`p.tipo = ${String(tipo)}::"TipoProducto"`);
        }

        if (search && String(search).trim() !== '') {
            const term = `%${String(search).trim()}%`;
            whereConditions.push(Prisma.sql`(
                p.nombre ILIKE ${term} OR 
                p."codigoBarras" ILIKE ${term} OR 
                p."registroSanitario" ILIKE ${term}
            )`);
        }

        const whereSql = Prisma.join(whereConditions, ' AND ');
        const limitSql = limit ? Prisma.sql`LIMIT ${Math.min(Number(limit), 2000)}` : Prisma.empty;

        const productsWithStock = await prisma.$queryRaw<any[]>`
            SELECT 
                p.id,
                p.nombre,
                p."codigoBarras",
                p.descripcion,
                p.tipo,
                p."registroSanitario",
                p.presentacion,
                p."unidadBase",
                p."stockMinimo",
                p."createdAt",
                p."updatedAt",
                COALESCE(SUM(b."stockActual"), 0)::INTEGER as "stockUnidad",
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'id', b.id,
                            'codigo', b.codigo,
                            'fechaExpiracion', b."fechaExpiracion",
                            'stockActual', b."stockActual",
                            'cantidadPorPresentacion', b."cantidadPorPresentacion",
                            'precioCostoPresentacion', b."precioCostoPresentacion",
                            'precioVentaPresentacion', b."precioVentaPresentacion",
                            'laboratorio', b.laboratorio,
                            'precioCostoUnidad', CASE WHEN COALESCE(b."cantidadPorPresentacion", 1) > 0 THEN (b."precioCostoPresentacion" / b."cantidadPorPresentacion") ELSE 0 END,
                            'precioVentaUnidad', CASE WHEN COALESCE(b."cantidadPorPresentacion", 1) > 0 THEN (b."precioVentaPresentacion" / b."cantidadPorPresentacion") ELSE 0 END
                        )
                    ) FILTER (WHERE b.id IS NOT NULL),
                    '[]'::JSON
                ) as batches
            FROM "Product" p
            LEFT JOIN "Batch" b ON b."productId" = p.id AND b."deletedAt" IS NULL
            WHERE ${whereSql}
            GROUP BY p.id
            ORDER BY p.nombre ASC
            ${limitSql};
        `;

        res.json(productsWithStock);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
};


export const createProduct = async (req: Request, res: Response) => {
    try {
        const data = createProductSchema.parse(req.body);
        
        let mappedTipo: 'MEDICAMENTO' | 'DISPOSITIVO_MEDICO' = 'MEDICAMENTO';
        if (data.tipo?.toUpperCase().includes('DISPOSITIVO') || data.tipo === 'Insumo') {
            mappedTipo = 'DISPOSITIVO_MEDICO';
        }

        const cleanBarcode = data.codigoBarras && data.codigoBarras.trim() !== '' ? data.codigoBarras.trim() : null;
        const cleanDesc = data.descripcion && data.descripcion.trim() !== '' ? data.descripcion.trim() : null;
        const cleanSanitario = data.registroSanitario && data.registroSanitario.trim() !== '' ? data.registroSanitario.trim() : null;
        const cleanLab = data.laboratorio && data.laboratorio.trim() !== '' ? data.laboratorio.trim() : null;

        const cleanLote = data.lote && data.lote.trim() !== '' ? data.lote.trim() : null;
        const cleanFechaExp = data.fechaExpiracion && data.fechaExpiracion.trim() !== '' ? data.fechaExpiracion.trim() : null;
        const stockInicial = typeof data.stockUnidad === 'number' && !isNaN(data.stockUnidad) ? data.stockUnidad : 0;

        // Validaciones estrictas de coherencia de lote sin valores inventados
        if (stockInicial > 0 && (!cleanLote || !cleanFechaExp)) {
            return res.status(400).json({
                error: 'Para registrar stock inicial es obligatorio proporcionar el código de lote y su fecha de expiración.'
            });
        }

        if (cleanLote && !cleanFechaExp) {
            return res.status(400).json({
                error: 'La fecha de expiración es obligatoria para registrar el lote.'
            });
        }

        if (cleanFechaExp && !cleanLote) {
            return res.status(400).json({
                error: 'El código de lote es obligatorio si se indica una fecha de expiración.'
            });
        }

        let parsedExpDate: Date | null = null;
        if (cleanFechaExp) {
            parsedExpDate = new Date(cleanFechaExp);
            if (isNaN(parsedExpDate.getTime())) {
                return res.status(400).json({ error: 'La fecha de expiración no tiene un formato de fecha válido.' });
            }
        }

        const cantXPres = typeof data.cantidadPorPresentacion === 'number' && data.cantidadPorPresentacion > 0
            ? data.cantidadPorPresentacion
            : 1;
        const costoPres = typeof data.precioCostoPresentacion === 'number' && data.precioCostoPresentacion >= 0
            ? data.precioCostoPresentacion
            : 0;
        const ventaPres = typeof data.precioVentaPresentacion === 'number' && data.precioVentaPresentacion >= 0
            ? data.precioVentaPresentacion
            : 0;

        // Transacción atómica en PostgreSQL
        const product = await prisma.$transaction(async (tx) => {
            const newProduct = await tx.product.create({
                data: {
                    nombre: data.nombre.trim(),
                    codigoBarras: cleanBarcode,
                    descripcion: cleanDesc,
                    tipo: mappedTipo,
                    registroSanitario: cleanSanitario,
                    presentacion: data.presentacion ?? null,
                    unidadBase: data.unidadBase ?? null,
                    stockMinimo: typeof data.stockMinimo === 'number' ? data.stockMinimo : 0,
                },
            });

            // Si el usuario ingresó código de lote y fecha de vencimiento reales, registramos el lote exacto
            if (cleanLote && parsedExpDate) {
                const newBatch = await tx.batch.create({
                    data: {
                        codigo: cleanLote,
                        fechaExpiracion: parsedExpDate,
                        stockActual: stockInicial,
                        cantidadPorPresentacion: cantXPres,
                        precioCostoPresentacion: costoPres,
                        precioVentaPresentacion: ventaPres,
                        laboratorio: cleanLab,
                        productId: newProduct.id,
                    },
                });

                // Si se asignó stock inicial, registrar movimiento en Kardex para consistencia contable
                if (stockInicial > 0) {
                    await tx.movement.create({
                        data: {
                            tipo: 'Ingreso',
                            cantidad: stockInicial,
                            motivo: 'Carga Inicial de Lote',
                            usuario: (req as any).user.full_name,
                            productId: newProduct.id,
                            batchId: newBatch.id,
                        },
                    });
                }
            }

            return newProduct;
        });

        invalidateDashboardCache();
        res.status(201).json(product);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        if ((error as any).code === 'P2002') {
            return res.status(400).json({ error: 'El código de barras ya está registrado en otro producto' });
        }
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Error al crear el producto' });
    }
};

export const updateProduct = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data = createProductSchema.partial().parse(req.body);

        // 1. Obtener producto actual para auditoría
        const oldProduct = await prisma.product.findUnique({
            where: { id }
        });

        if (!oldProduct) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        // 2. Ejecutar actualización
        const updateData: any = {};
        if (data.nombre !== undefined) updateData.nombre = data.nombre;
        if (data.codigoBarras !== undefined) {
            updateData.codigoBarras = data.codigoBarras && data.codigoBarras.trim() !== '' ? data.codigoBarras.trim() : null;
        }
        if (data.descripcion !== undefined) {
            updateData.descripcion = data.descripcion && data.descripcion.trim() !== '' ? data.descripcion.trim() : null;
        }
        if (data.registroSanitario !== undefined) {
            updateData.registroSanitario = data.registroSanitario && data.registroSanitario.trim() !== '' ? data.registroSanitario.trim() : null;
        }
        if (data.presentacion !== undefined && data.presentacion !== null) updateData.presentacion = data.presentacion;
        if (data.unidadBase !== undefined && data.unidadBase !== null) updateData.unidadBase = data.unidadBase;
        if (data.stockMinimo !== undefined && data.stockMinimo !== null) updateData.stockMinimo = data.stockMinimo;

        if (data.tipo !== undefined && data.tipo !== null) {
            let mappedTipo: 'MEDICAMENTO' | 'DISPOSITIVO_MEDICO' = 'MEDICAMENTO';
            if (data.tipo.toUpperCase().includes('DISPOSITIVO') || data.tipo === 'Insumo') {
                mappedTipo = 'DISPOSITIVO_MEDICO';
            }
            updateData.tipo = mappedTipo;
        }

        const product = await prisma.product.update({
            where: { id },
            data: updateData,
        });

        // 2b. Actualizar campos de lote asociados (cantidadPorPresentacion, precios, laboratorio)
        const batchUpdateData: any = {};
        if (data.cantidadPorPresentacion !== undefined && data.cantidadPorPresentacion !== null) {
            batchUpdateData.cantidadPorPresentacion = data.cantidadPorPresentacion;
        }
        if (data.precioCostoPresentacion !== undefined && data.precioCostoPresentacion !== null) {
            batchUpdateData.precioCostoPresentacion = data.precioCostoPresentacion;
        }
        if (data.precioVentaPresentacion !== undefined && data.precioVentaPresentacion !== null) {
            batchUpdateData.precioVentaPresentacion = data.precioVentaPresentacion;
        }
        if (data.laboratorio !== undefined) {
            batchUpdateData.laboratorio = data.laboratorio && data.laboratorio.trim() !== '' ? data.laboratorio.trim() : null;
        }

        if (Object.keys(batchUpdateData).length > 0) {
            await prisma.batch.updateMany({
                where: {
                    productId: id,
                    deletedAt: null
                },
                data: batchUpdateData
            });
        }

        // 3. Registrar auditoría de cambios (solo campos que realmente fueron modificados)
        const changes = [];
        const dataObj = data as Record<string, any>;
        for (const key in dataObj) {
            if (dataObj[key] === undefined) continue;

            // Verificar si el campo pertenece al modelo de producto
            if (key in oldProduct) {
                const oldValue = (oldProduct as any)[key];
                let newValue = dataObj[key];

                // Normalizar tipo para evitar falsos positivos por formato ("Dispositivo Médico" vs "DISPOSITIVO_MEDICO")
                if (key === 'tipo' && typeof newValue === 'string') {
                    if (newValue.toUpperCase().includes('DISPOSITIVO') || newValue === 'Insumo') {
                        newValue = 'DISPOSITIVO_MEDICO';
                    } else {
                        newValue = 'MEDICAMENTO';
                    }
                }

                const strOld = (oldValue !== null && oldValue !== undefined) ? String(oldValue).trim() : "";
                const strNew = (newValue !== null && newValue !== undefined) ? String(newValue).trim() : "";

                // Registrar auditoría solo si el valor cambió realmente
                if (strOld !== strNew) {
                    changes.push({
                        productId: id,
                        productName: product.nombre,
                        campoEditado: key,
                        valorAnterior: strOld || "vacio",
                        valorNuevo: strNew || "vacio",
                        usuario: (req as any).user.full_name
                    });
                }
            }
        }

        if (changes.length > 0) {
            await prisma.productAudit.createMany({
                data: changes
            });
        }

        res.json(product);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        if ((error as any).code === 'P2002') {
            return res.status(400).json({ error: 'El código de barras ya está registrado en otro producto' });
        }
        if ((error as any).code === 'P2025') {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Error al actualizar el producto' });
    }
};

export const getProductAuditHistory = async (req: Request, res: Response) => {
    try {
        const audits = await prisma.productAudit.findMany({
            orderBy: {
                fecha: 'desc'
            },
            take: 50 // Últimos 50 cambios
        });
        res.json(audits);
    } catch (error) {
        console.error('Error fetching product audit history:', error);
        res.status(500).json({ error: 'Error al obtener el historial de auditoría' });
    }
};


const updateBatchSchema = z.object({
    lote: z.string().nullable().optional(), // Maps to 'codigo'
    fechaExpiracion: z.string().nullable().optional(), // ISO Date string
    stockUnidad: z.number().int().nonnegative().nullable().optional(), // Maps to 'stockActual'
    precioCostoPresentacion: z.number().nonnegative().nullable().optional(),
    precioVentaPresentacion: z.number().nonnegative().nullable().optional(),
});

export const updateBatch = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { 
            lote, 
            fechaExpiracion, 
            stockUnidad,
            precioCostoPresentacion,
            precioVentaPresentacion,
        } = updateBatchSchema.parse(req.body);

        const data: any = {};
        if (lote !== undefined && lote !== null && lote.trim() !== '') {
            data.codigo = lote.trim();
        }
        if (fechaExpiracion !== undefined && fechaExpiracion !== null && fechaExpiracion.trim() !== '') {
            const parsedDate = new Date(fechaExpiracion);
            if (!isNaN(parsedDate.getTime())) {
                data.fechaExpiracion = parsedDate;
            }
        }
        if (stockUnidad !== undefined && stockUnidad !== null) data.stockActual = stockUnidad;
        if (precioCostoPresentacion !== undefined && precioCostoPresentacion !== null) data.precioCostoPresentacion = precioCostoPresentacion;
        if (precioVentaPresentacion !== undefined && precioVentaPresentacion !== null) data.precioVentaPresentacion = precioVentaPresentacion;

        if (Object.keys(data).length === 0) {
            return res.json({ message: "No se proporcionaron cambios" });
        }

        const batch = await prisma.batch.update({
            where: { id },
            data,
        });

        res.json(batch);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        if ((error as any).code === 'P2002') {
            return res.status(400).json({ error: 'Ya existe un lote con ese código' });
        }
        if ((error as any).code === 'P2025') {
            return res.status(404).json({ error: 'Lote no encontrado' });
        }
        console.error("Error updating batch:", error);
        res.status(500).json({ error: 'Error al actualizar el lote' });
    }
};

export const deleteBatch = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Obtener el lote
        const batch = await prisma.batch.findUnique({
            where: { id }
        });

        if (!batch) {
            return res.status(404).json({ error: 'Lote no encontrado' });
        }

        // Verificar que no esté ya eliminado
        if (batch.deletedAt) {
            return res.status(400).json({ error: 'El lote ya fue eliminado anteriormente' });
        }

        // Verificar que el stock sea 0
        if (batch.stockActual > 0) {
            return res.status(400).json({
                error: `No se puede eliminar el lote porque tiene stock actual de ${batch.stockActual} unidades. Debe reducir el stock a 0 primero mediante salidas.`
            });
        }

        // Soft delete: marcar como eliminado
        await prisma.batch.update({
            where: { id },
            data: {
                deletedAt: new Date()
            }
        });

        res.json({ message: 'Lote eliminado exitosamente. El historial se mantiene en el kardex.' });
    } catch (error) {
        if ((error as any).code === 'P2025') {
            return res.status(404).json({ error: 'Lote no encontrado' });
        }
        console.error('Error deleting batch:', error);
        res.status(500).json({ error: 'Error al eliminar el lote' });
    }
};

export const deleteProduct = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const product = await prisma.product.findUnique({
            where: { id }
        });

        if (!product || product.deletedAt) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const now = new Date();

        // Soft delete: marcar producto y sus lotes asociados como eliminados
        await prisma.$transaction([
            prisma.batch.updateMany({
                where: { productId: id, deletedAt: null },
                data: { deletedAt: now }
            }),
            prisma.product.update({
                where: { id },
                data: { deletedAt: now }
            })
        ]);

        res.json({ message: 'Producto eliminado exitosamente. El historial de movimientos y kardex se mantiene trazable.' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Error al eliminar el producto' });
    }
};

// Helper to sanitize GTIN strings from Excel (handling scientific notation and floating points)
const sanitizeGtin = (gtinRaw: any): string | null => {
    if (gtinRaw === null || gtinRaw === undefined || String(gtinRaw).trim() === '') return null;

    let sVal = String(gtinRaw).trim();

    // Convert scientific notation like 7.89123E+12 or 7.89123e+12
    if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(sVal)) {
        try {
            const num = Number(gtinRaw);
            if (!isNaN(num)) {
                sVal = BigInt(Math.round(num)).toString();
            }
        } catch (_) {
            // Keep original string if conversion fails
        }
    }

    // Remove trailing .0 from floating representation e.g. 789123456789.0
    if (sVal.endsWith('.0')) {
        sVal = sVal.slice(0, -2);
    }

    if (/^\d+\.0+$/.test(sVal)) {
        sVal = sVal.split('.')[0];
    }

    return sVal !== '' ? sVal : null;
};

// Helper for strict date parsing and checking against current date
const parseExcelDateStrict = (value: any): { date: Date | null; error?: string } => {
    if (value === null || value === undefined || String(value).trim() === '') {
        return { date: null, error: 'Fecha de expiración vacía o no especificada.' };
    }

    let parsedDate: Date | null = null;

    if (value instanceof Date) {
        if (!isNaN(value.getTime())) {
            parsedDate = new Date(value);
            parsedDate.setUTCHours(12, 0, 0, 0);
        }
    } else if (typeof value === 'number') {
        // Excel serial date number
        const date = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(date.getTime())) {
            date.setUTCHours(12, 0, 0, 0);
            parsedDate = date;
        }
    } else {
        const sVal = String(value).trim();

        // ISO format YYYY-MM-DD
        if (sVal.includes('-')) {
            const parts = sVal.split('T')[0].split('-');
            if (parts.length === 3) {
                const year = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                const day = parseInt(parts[2], 10);
                const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
                if (!isNaN(date.getTime())) {
                    parsedDate = date;
                }
            }
        } else if (sVal.includes('/')) {
            // Slash format DD/MM/YYYY or D/M/YYYY
            const parts = sVal.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                let yearStr = parts[2].trim();
                if (yearStr.length > 4) yearStr = yearStr.slice(-4);
                let year = parseInt(yearStr, 10);
                if (year < 100) year += 2000;
                const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
                if (!isNaN(date.getTime())) {
                    parsedDate = date;
                }
            }
        }
    }

    if (!parsedDate) {
        return { date: null, error: `Formato de fecha no reconocible ("${value}"). Debe ser AAAA-MM-DD o DD/MM/AAAA.` };
    }

    // Check that date is not prior to today (00:00:00 UTC)
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);

    if (parsedDate < hoy) {
        const isoFormatted = parsedDate.toISOString().split('T')[0];
        return { date: null, error: `La fecha de expiración (${isoFormatted}) es anterior a la fecha actual. No se permiten lotes caducados.` };
    }

    return { date: parsedDate };
};

const PRESENTACIONES_PERMITIDAS = [
    "Caja", "Blister", "Frasco", "Botella", "Sobre", "Ampolla",
    "Unidad", "Tubo", "Bolsa", "Pote", "Lata", "Pack"
];

const UNIDADES_BASE_PERMITIDAS = [
    "Unidad", "Tableta", "Cápsula", "Ampolla", "Frasco",
    "Mililitro", "Gramo", "Sobre", "Comprimido"
];

const normalizePresentacion = (raw: any): { value: string | null; error?: string } => {
    if (!raw || String(raw).trim() === '') return { value: "Caja" };
    const s = String(raw).trim();
    const sUpper = s.toUpperCase();

    const match = PRESENTACIONES_PERMITIDAS.find(p => p.toUpperCase() === sUpper);
    if (match) return { value: match };

    if (sUpper.includes('CAJA')) return { value: "Caja" };
    if (sUpper.includes('BLISTER')) return { value: "Blister" };
    if (sUpper.includes('FRASCO')) return { value: "Frasco" };
    if (sUpper.includes('BOTELLA')) return { value: "Botella" };
    if (sUpper.includes('SOBRE')) return { value: "Sobre" };
    if (sUpper.includes('AMPOLLA')) return { value: "Ampolla" };
    if (sUpper.includes('UNID') || sUpper.includes('UND')) return { value: "Unidad" };
    if (sUpper.includes('TUBO')) return { value: "Tubo" };
    if (sUpper.includes('BOLSA')) return { value: "Bolsa" };
    if (sUpper.includes('POTE')) return { value: "Pote" };
    if (sUpper.includes('LATA')) return { value: "Lata" };
    if (sUpper.includes('PACK')) return { value: "Pack" };

    return {
        value: null,
        error: `Presentación "${raw}" no válida. Las presentaciones permitidas son: ${PRESENTACIONES_PERMITIDAS.join(', ')}`
    };
};

const normalizeUnidadBase = (raw: any): { value: string | null; error?: string } => {
    if (!raw || String(raw).trim() === '') return { value: "Unidad" };
    const s = String(raw).trim();
    const sUpper = s.toUpperCase();

    const match = UNIDADES_BASE_PERMITIDAS.find(u => u.toUpperCase() === sUpper);
    if (match) return { value: match };

    if (sUpper.includes('UNID') || sUpper.includes('UND') || sUpper === 'U') return { value: "Unidad" };
    if (sUpper.includes('TAB')) return { value: "Tableta" };
    if (sUpper.includes('CAP') || sUpper.includes('CÁP')) return { value: "Cápsula" };
    if (sUpper.includes('AMP')) return { value: "Ampolla" };
    if (sUpper.includes('FRA')) return { value: "Frasco" };
    if (sUpper.includes('ML') || sUpper.includes('MILILITRO')) return { value: "Mililitro" };
    if (sUpper.includes('GR') || sUpper.includes('GRAMO')) return { value: "Gramo" };
    if (sUpper.includes('SOB')) return { value: "Sobre" };
    if (sUpper.includes('COMP')) return { value: "Comprimido" };

    return {
        value: null,
        error: `Unidad base "${raw}" no válida. Las unidades base permitidas son: ${UNIDADES_BASE_PERMITIDAS.join(', ')}`
    };
};

// Helper function to perform comprehensive row-by-row validation
const validateExcelRows = (items: any[]) => {
    const rowErrors: any[] = [];
    const rowWarnings: any[] = [];

    const gtinsSeenInFile = new Map<string, { nombre: string; row: number }>();
    const gtinLotePairsInFile = new Set<string>();

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rowNum = i + 2; // Excel row numbering offset

        // 1. Validar Nombre
        const rawNombre = item.Nombre?.toString()?.trim();
        if (!rawNombre) {
            rowErrors.push({
                row: rowNum,
                field: 'Nombre',
                error: 'El nombre del producto es obligatorio y no puede estar vacío.'
            });
        }

        // 2. Sanitizar y validar GTIN
        const sanitizedGtin = sanitizeGtin(item.GTIN);
        if (sanitizedGtin) {
            if (gtinsSeenInFile.has(sanitizedGtin)) {
                const prev = gtinsSeenInFile.get(sanitizedGtin)!;
                if (prev.nombre.toLowerCase() !== (rawNombre || '').toLowerCase()) {
                    rowErrors.push({
                        row: rowNum,
                        field: 'GTIN',
                        error: `Inconsistencia: El GTIN "${sanitizedGtin}" está asignado al producto "${prev.nombre}" en la fila ${prev.row} y a "${rawNombre}" en la fila ${rowNum}.`
                    });
                }
            } else {
                gtinsSeenInFile.set(sanitizedGtin, { nombre: rawNombre || 'Desconocido', row: rowNum });
            }
        }

        // 3. Validar Presentación
        const presRes = normalizePresentacion(item.Presentacion);
        if (presRes.error) {
            rowErrors.push({
                row: rowNum,
                field: 'Presentacion',
                error: presRes.error
            });
        }

        // 4. Validar Unidad Base
        const ubRes = normalizeUnidadBase(item.Unidad_Base);
        if (ubRes.error) {
            rowErrors.push({
                row: rowNum,
                field: 'Unidad_Base',
                error: ubRes.error
            });
        }

        // 5. Validar datos del Lote Inicial (si se provee)
        if (item.Lote_Inicial !== undefined && item.Lote_Inicial !== null && String(item.Lote_Inicial).trim() !== '') {
            const loteStr = String(item.Lote_Inicial).trim();

            if (sanitizedGtin) {
                const pairKey = `${sanitizedGtin}_${loteStr.toUpperCase()}`;
                if (gtinLotePairsInFile.has(pairKey)) {
                    rowErrors.push({
                        row: rowNum,
                        field: 'Lote_Inicial',
                        error: `El lote "${loteStr}" para el GTIN "${sanitizedGtin}" aparece duplicado múltiples veces dentro del mismo archivo Excel.`
                    });
                } else {
                    gtinLotePairsInFile.add(pairKey);
                }
            }

            // Validar Expiración
            const dateRes = parseExcelDateStrict(item.Expiracion);
            if (dateRes.error) {
                rowErrors.push({
                    row: rowNum,
                    field: 'Expiracion',
                    error: dateRes.error
                });
            }

            // Validar Stock Inicial
            const rawStock = Number(item.Stock_Inicial);
            if (isNaN(rawStock) || rawStock < 0 || !Number.isInteger(rawStock)) {
                rowErrors.push({
                    row: rowNum,
                    field: 'Stock_Inicial',
                    error: `Stock Inicial inválido ("${item.Stock_Inicial}"). Debe ser un número entero mayor o igual a 0.`
                });
            }

            // Validar Cantidad x Presentación
            const rawCantPres = Number(item.Cantidad_x_Pres);
            if (item.Cantidad_x_Pres !== undefined && item.Cantidad_x_Pres !== null && (isNaN(rawCantPres) || rawCantPres < 1)) {
                rowErrors.push({
                    row: rowNum,
                    field: 'Cantidad_x_Pres',
                    error: `Cantidad por presentación inválida ("${item.Cantidad_x_Pres}"). Debe ser un número entero mayor o igual a 1.`
                });
            }

            // Validar Precios por Presentación
            const rawCostPres = Number(item.Precio_Costo_Pres);
            if (item.Precio_Costo_Pres !== undefined && item.Precio_Costo_Pres !== null && (isNaN(rawCostPres) || rawCostPres < 0)) {
                rowErrors.push({
                    row: rowNum,
                    field: 'Precio_Costo_Pres',
                    error: `Precio Costo Presentación inválido ("${item.Precio_Costo_Pres}"). Debe ser un número mayor o igual a 0.`
                });
            }

            const rawSalePres = Number(item.Precio_Venta_Pres);
            if (item.Precio_Venta_Pres !== undefined && item.Precio_Venta_Pres !== null && (isNaN(rawSalePres) || rawSalePres < 0)) {
                rowErrors.push({
                    row: rowNum,
                    field: 'Precio_Venta_Pres',
                    error: `Precio Venta Presentación inválido ("${item.Precio_Venta_Pres}"). Debe ser un número mayor o igual a 0.`
                });
            }

            if (!isNaN(rawCostPres) && !isNaN(rawSalePres) && rawSalePres < rawCostPres && rawSalePres > 0) {
                rowWarnings.push({
                    row: rowNum,
                    field: 'Precio_Venta_Pres',
                    warning: `El precio de venta por presentación (S/ ${rawSalePres.toFixed(2)}) es menor que el precio de costo (S/ ${rawCostPres.toFixed(2)}).`
                });
            }
        }
    }

    return { rowErrors, rowWarnings };
};

export const validateBulkUpload = async (req: Request, res: Response) => {
    try {
        const items = req.body;
        if (!Array.isArray(items)) {
            return res.status(400).json({ error: 'Se esperaba un arreglo de elementos' });
        }

        const { rowErrors, rowWarnings } = validateExcelRows(items);

        const gtins = items
            .map(i => sanitizeGtin(i.GTIN))
            .filter(Boolean) as string[];

        const uniqueGtinsInFile = new Set(gtins);

        // Buscar productos existentes con todos sus lotes (incluso eliminados para detectar reactivaciones)
        const existingProducts = await prisma.product.findMany({
            where: {
                codigoBarras: {
                    in: Array.from(uniqueGtinsInFile)
                }
            },
            include: {
                batches: true
            }
        });

        const existingProductsMap = new Map<string, any>(
            existingProducts.map((p: any) => [p.codigoBarras, p])
        );

        let newProductsCount = 0;
        let updateProductsCount = 0;

        for (const gtin of uniqueGtinsInFile) {
            if (existingProductsMap.has(gtin)) {
                updateProductsCount++;
            } else {
                newProductsCount++;
            }
        }

        const cambiosStock: any[] = [];
        const cambiosCosto: any[] = [];
        const cambiosPrecioVenta: any[] = [];
        const cambiosExpiracion: any[] = [];
        const cambiosNombre: any[] = [];
        const lotesNuevos: any[] = [];
        const lotesReactivados: any[] = [];
        const productosNuevosList: any[] = [];
        const duplicatesList: any[] = [];
        const seenGtins = new Set<string>();

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const gtinStr = sanitizeGtin(item.GTIN);
            const rawNombre = item.Nombre?.toString()?.trim() || "";

            if (gtinStr) {
                if (seenGtins.has(gtinStr)) {
                    duplicatesList.push({
                        gtin: gtinStr,
                        nombre: rawNombre,
                        lote: item.Lote_Inicial
                    });
                } else {
                    seenGtins.add(gtinStr);
                    if (!existingProductsMap.has(gtinStr)) {
                        productosNuevosList.push({
                            gtin: gtinStr,
                            nombre: rawNombre
                        });
                    }
                }
            }

            const existingProduct = gtinStr ? existingProductsMap.get(gtinStr) : null;

            if (existingProduct) {
                // Comprobar cambio de nombre
                if (rawNombre && existingProduct.nombre.trim() !== rawNombre) {
                    cambiosNombre.push({
                        gtin: gtinStr,
                        lote: item.Lote_Inicial,
                        nombreAnterior: existingProduct.nombre,
                        nombreNuevo: rawNombre
                    });
                }
            }

            if (item.Lote_Inicial !== undefined && item.Lote_Inicial !== null && String(item.Lote_Inicial).trim() !== '') {
                const loteStr = String(item.Lote_Inicial).trim();
                const stockNuevo = Math.max(0, Math.floor(Number(item.Stock_Inicial) || 0));
                const costoNuevo = Math.max(0, Number(item.Precio_Costo_Pres) || 0);
                const ventaNueva = Math.max(0, Number(item.Precio_Venta_Pres) || 0);
                const parsedExp = parseExcelDateStrict(item.Expiracion);

                if (existingProduct) {
                    const existingBatch = existingProduct.batches.find(
                        (b: any) => b.codigo.toUpperCase() === loteStr.toUpperCase()
                    );

                    if (existingBatch) {
                        // 1. Detectar cambio de stock
                        if (existingBatch.stockActual !== stockNuevo) {
                            cambiosStock.push({
                                gtin: gtinStr,
                                nombre: rawNombre || existingProduct.nombre,
                                lote: loteStr,
                                stockAnterior: existingBatch.stockActual,
                                stockNuevo: stockNuevo,
                                diferencia: stockNuevo - existingBatch.stockActual
                            });
                        }

                        // 2. Detectar cambio de costo
                        if (Number(existingBatch.precioCostoPresentacion) !== costoNuevo) {
                            cambiosCosto.push({
                                gtin: gtinStr,
                                nombre: rawNombre || existingProduct.nombre,
                                lote: loteStr,
                                costoAnterior: Number(existingBatch.precioCostoPresentacion),
                                costoNuevo: costoNuevo,
                                diferencia: costoNuevo - Number(existingBatch.precioCostoPresentacion)
                            });
                        }

                        // 3. Detectar cambio de precio de venta
                        if (ventaNueva > 0 && Number(existingBatch.precioVentaPresentacion) !== ventaNueva) {
                            cambiosPrecioVenta.push({
                                gtin: gtinStr,
                                nombre: rawNombre || existingProduct.nombre,
                                lote: loteStr,
                                ventaAnterior: Number(existingBatch.precioVentaPresentacion),
                                ventaNueva: ventaNueva,
                                diferencia: ventaNueva - Number(existingBatch.precioVentaPresentacion)
                            });
                        }

                        // 4. Detectar cambio de fecha de expiración
                        if (parsedExp.date && existingBatch.fechaExpiracion) {
                            const expBD = existingBatch.fechaExpiracion.toISOString().split('T')[0];
                            const expExcel = parsedExp.date.toISOString().split('T')[0];
                            if (expBD !== expExcel) {
                                cambiosExpiracion.push({
                                    gtin: gtinStr,
                                    nombre: rawNombre || existingProduct.nombre,
                                    lote: loteStr,
                                    expAnterior: expBD,
                                    expNuevo: expExcel
                                });
                            }
                        }

                        // 5. Detectar reactivación si estaba eliminado
                        if (existingBatch.deletedAt) {
                            lotesReactivados.push({
                                gtin: gtinStr,
                                nombre: rawNombre || existingProduct.nombre,
                                lote: loteStr,
                                stock: stockNuevo
                            });
                        }

                    } else {
                        // Nuevo lote para producto existente
                        lotesNuevos.push({
                            gtin: gtinStr,
                            nombre: rawNombre || existingProduct.nombre,
                            lote: loteStr,
                            stock: stockNuevo,
                            costo: costoNuevo
                        });
                    }
                } else {
                    // Nuevo lote para nuevo producto
                    lotesNuevos.push({
                        gtin: gtinStr,
                        nombre: rawNombre,
                        lote: loteStr,
                        stock: stockNuevo,
                        costo: costoNuevo
                    });
                }
            }
        }

        res.json({
            totalItems: items.length,
            uniqueProducts: uniqueGtinsInFile.size,
            newProducts: newProductsCount,
            updateProducts: updateProductsCount,
            duplicatesInFile: duplicatesList.length,
            batchCount: lotesNuevos.length,
            duplicatesList,
            rowErrors,
            rowWarnings,
            isValid: rowErrors.length === 0,
            diffSummary: {
                cambiosStock,
                cambiosCosto,
                cambiosPrecioVenta,
                cambiosExpiracion,
                cambiosNombre,
                lotesNuevos,
                lotesReactivados,
                productosNuevosList,
                totales: {
                    stockCount: cambiosStock.length,
                    costCount: cambiosCosto.length,
                    ventaCount: cambiosPrecioVenta.length,
                    expCount: cambiosExpiracion.length,
                    nameCount: cambiosNombre.length,
                    newLotesCount: lotesNuevos.length,
                    reactivadosCount: lotesReactivados.length
                }
            }
        });

    } catch (error) {
        console.error('Error in bulk validation:', error);
        res.status(500).json({ error: 'Error al validar el archivo.' });
    }
};

export const bulkCreateProducts = async (req: Request, res: Response) => {
    try {
        const body = req.body;
        const items = Array.isArray(body) ? body : body.items;

        if (!Array.isArray(items)) {
            return res.status(400).json({ error: 'Se esperaba un arreglo de elementos' });
        }

        // FASE PRE-FLIGHT DE VALIDACIÓN
        const { rowErrors } = validateExcelRows(items);
        if (rowErrors.length > 0) {
            const errorSummary = rowErrors.slice(0, 3).map(e => `Fila ${e.row}: ${e.error}`).join(' | ');
            return res.status(400).json({
                error: `Carga cancelada (Rollback ejecutado): Se encontraron ${rowErrors.length} error(es) en el archivo. ${errorSummary}`,
                rowErrors
            });
        }

        // 1. Group items by GTIN
        const groupedByGTIN: Record<string, any[]> = {};
        for (const item of items) {
            const rawGtin = sanitizeGtin(item.GTIN);
            const gtin = rawGtin || ("NO_GTIN_" + Math.random().toString(36).substring(7));
            if (!groupedByGTIN[gtin]) groupedByGTIN[gtin] = [];
            groupedByGTIN[gtin].push(item);
        }

        // 2. Precargar todos los productos existentes y sus lotes
        const gtinsList = Object.keys(groupedByGTIN).filter(gtin => !gtin.startsWith("NO_GTIN_"));
        const existingProducts = await prisma.product.findMany({
            where: { codigoBarras: { in: gtinsList } },
            include: { batches: { where: { deletedAt: null } } }
        });

        const existingProductsMap = new Map<string, any>(existingProducts.map(p => [p.codigoBarras || "", p]));

        const results = await prisma.$transaction(async (tx: any) => {
            let createdCount = 0;
            let updatedCount = 0;
            let batchCount = 0;

            const newProductsToCreate: any[] = [];
            const noGtinProductRows: any[] = [];

            for (const gtin in groupedByGTIN) {
                const productRows = groupedByGTIN[gtin];
                const firstRow = productRows[0];
                const isRealGTIN = !gtin.startsWith("NO_GTIN_");
                const existingProduct = isRealGTIN ? existingProductsMap.get(gtin) : null;

                if (!existingProduct) {
                    let mappedTipo: 'MEDICAMENTO' | 'DISPOSITIVO_MEDICO' = 'MEDICAMENTO';
                    if (firstRow.Tipo && (firstRow.Tipo.toUpperCase().includes('DISPOSITIVO') || firstRow.Tipo === 'Insumo')) {
                        mappedTipo = 'DISPOSITIVO_MEDICO';
                    }

                    const presNorm = normalizePresentacion(firstRow.Presentacion).value || "Caja";
                    const ubNorm = normalizeUnidadBase(firstRow.Unidad_Base).value || "Unidad";

                    const productData = {
                        codigoBarras: isRealGTIN ? gtin : null,
                        nombre: firstRow.Nombre.trim(),
                        tipo: mappedTipo,
                        registroSanitario: firstRow.RS?.toString()?.trim() || null,
                        presentacion: presNorm,
                        unidadBase: ubNorm,
                        stockMinimo: Math.max(0, Math.floor(Number(firstRow.Stock_Min) || 0)),
                    };

                    if (isRealGTIN) {
                        newProductsToCreate.push(productData);
                    } else {
                        noGtinProductRows.push({ gtin, productData, productRows });
                    }
                } else {
                    updatedCount++;
                }
            }

            if (newProductsToCreate.length > 0) {
                await tx.product.createMany({
                    data: newProductsToCreate,
                    skipDuplicates: true
                });
                createdCount += newProductsToCreate.length;
            }

            const noGtinProductsMap = new Map<string, any>();
            for (const item of noGtinProductRows) {
                const p = await tx.product.create({ data: item.productData });
                noGtinProductsMap.set(item.gtin, p);
                createdCount++;
            }

            const allProductsList = await tx.product.findMany({
                where: { codigoBarras: { in: gtinsList } },
                include: { batches: { where: { deletedAt: null } } }
            });

            const fullProductMap = new Map<string, any>(allProductsList.map((p: any) => [p.codigoBarras || "", p]));

            const batchesToCreate: any[] = [];
            const auditsToCreate: any[] = [];

            for (const gtin in groupedByGTIN) {
                const productRows = groupedByGTIN[gtin];
                const isRealGTIN = !gtin.startsWith("NO_GTIN_");
                const product = isRealGTIN ? fullProductMap.get(gtin) : noGtinProductsMap.get(gtin);

                if (!product) continue;

                const existingProduct = existingProductsMap.get(gtin);

                for (const row of productRows) {
                    if (row.Lote_Inicial !== undefined && row.Lote_Inicial !== null && String(row.Lote_Inicial).trim() !== '') {
                        const loteCodigoStr = String(row.Lote_Inicial).trim();

                        const existingBatch = existingProduct?.batches.find(
                            (b: any) => b.codigo.toUpperCase() === loteCodigoStr.toUpperCase()
                        );

                        const rowCantXPres = Math.max(1, Math.floor(Number(row.Cantidad_x_Pres) || 1));
                        const rowPCostoPres = Math.max(0, Number(row.Precio_Costo_Pres) || 0);
                        const rowPVentaPres = Math.max(0, Number(row.Precio_Venta_Pres) || 0);
                        const rowStock = Math.max(0, Math.floor(Number(row.Stock_Inicial) || 0));

                        const dateParseRes = parseExcelDateStrict(row.Expiracion);
                        if (!dateParseRes.date) {
                            throw new Error(`Fecha inválida en el lote ${loteCodigoStr}: ${dateParseRes.error}`);
                        }

                        if (existingBatch) {
                            // Actualizar lote existente (Upsert)
                            await tx.batch.update({
                                where: { id: existingBatch.id },
                                data: {
                                    stockActual: rowStock,
                                    precioCostoPresentacion: rowPCostoPres,
                                    precioVentaPresentacion: rowPVentaPres,
                                    fechaExpiracion: dateParseRes.date,
                                    cantidadPorPresentacion: rowCantXPres,
                                    deletedAt: null, // Reactivar si estaba eliminado
                                    ...(row.Laboratorio ? { laboratorio: row.Laboratorio.toString().trim() } : {})
                                }
                            });

                            auditsToCreate.push({
                                productId: product.id,
                                productName: product.nombre,
                                campoEditado: "Carga Masiva (Actualización Lote)",
                                valorAnterior: `Lote: ${existingBatch.codigo}, Stock: ${existingBatch.stockActual}, Costo: S/ ${existingBatch.precioCostoPresentacion}`,
                                valorNuevo: `Lote: ${loteCodigoStr}, Stock: ${rowStock}, Costo: S/ ${rowPCostoPres}`,
                                usuario: "Admin"
                            });
                            batchCount++;
                        } else {
                            // Crear nuevo lote
                            batchesToCreate.push({
                                codigo: loteCodigoStr,
                                fechaExpiracion: dateParseRes.date,
                                stockActual: rowStock,
                                productId: product.id,
                                cantidadPorPresentacion: rowCantXPres,
                                precioCostoPresentacion: rowPCostoPres,
                                precioVentaPresentacion: rowPVentaPres,
                                laboratorio: row.Laboratorio?.toString()?.trim() || productRows[0].Laboratorio?.toString()?.trim() || null,
                            });
                            batchCount++;

                            auditsToCreate.push({
                                productId: product.id,
                                productName: product.nombre,
                                campoEditado: "Carga Masiva (Nuevo Lote)",
                                valorAnterior: "Nuevo",
                                valorNuevo: `Lote: ${loteCodigoStr}, Stock: ${rowStock}`,
                                usuario: "Admin"
                            });
                        }
                    }
                }
            }

            if (batchesToCreate.length > 0) {
                await tx.batch.createMany({
                    data: batchesToCreate
                });
            }

            if (auditsToCreate.length > 0) {
                await tx.productAudit.createMany({
                    data: auditsToCreate
                });
            }

            return { createdCount, updatedCount, batchCount };
        }, {
            timeout: 60000
        });

        res.json({
            message: 'Carga masiva completada exitosamente',
            ...results
        });

    } catch (error: any) {
        console.error('Error in bulk creation:', error);
        const errorMessage = error.message || 'Error en el procesamiento masivo. Verifique el formato de los datos.';
        res.status(400).json({ error: `Carga cancelada (Rollback ejecutado): ${errorMessage}` });
    }
};


