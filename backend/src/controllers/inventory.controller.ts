import { Request, Response } from 'express';
import prisma from '../prisma';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { invalidateDashboardCache } from './dashboard.controller';

// Schemas
const createIngresoSchema = z.object({
    productId: z.string().optional(),
    batchId: z.string().optional(),
    productoNombre: z.string().min(1, 'El nombre del producto es requerido'),
    cantidad: z.number().int().positive('La cantidad debe ser un entero positivo'),
    lote: z.string().min(1, 'El código de lote es requerido'),
    fechaExpiracion: z.string(), // ISO Date string o fecha parseable
    motivo: z.string().optional(),
    proveedor: z.string().optional(),
    usuario: z.string().optional(), // ignorado: el servidor usa el nombre de la sesión verificada
    fecha: z.string().optional(),
});

const createSalidaSchema = z.object({
    productId: z.string().optional(),
    batchId: z.string().optional(),
    productoNombre: z.string().min(1, 'El nombre del producto es requerido'),
    cantidad: z.number().int().positive('La cantidad debe ser un entero positivo'),
    lote: z.string().min(1, 'El código de lote es requerido'),
    fechaExpiracion: z.string().optional(),
    motivo: z.string().optional(),
    departamento: z.string().optional(),
    solicitante: z.string().optional(),
    observaciones: z.string().optional(),
    usuario: z.string().optional(), // ignorado: el servidor usa el nombre de la sesión verificada
    fecha: z.string().optional(),
});

const createIngresosBulkSchema = z.object({
    items: z.array(createIngresoSchema).min(1, 'Debe enviar al menos un item para registrar ingresos'),
});

const createSalidasBulkSchema = z.object({
    items: z.array(createSalidaSchema).min(1, 'Debe enviar al menos un item para registrar salidas'),
});

// Helper de validación de fecha de movimiento
const validateMovementDate = (fechaStr?: string): { valid: boolean; date: Date; error?: string } => {
    if (!fechaStr) return { valid: true, date: new Date() };

    const chosen = new Date(fechaStr);
    if (isNaN(chosen.getTime())) {
        return { valid: false, date: new Date(), error: 'La fecha proporcionada no es válida.' };
    }

    const now = new Date();
    const chosenDateOnly = new Date(chosen.getFullYear(), chosen.getMonth(), chosen.getDate());
    const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffTime = chosenDateOnly.getTime() - todayOnly.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 3) {
        return { valid: false, date: chosen, error: 'La fecha del movimiento no puede ser mayor a 3 días en el futuro.' };
    }

    return { valid: true, date: chosen };
};

// Helper para buscar producto de forma segura (por ID o por Nombre)
const findActiveProduct = async (tx: any, productId?: string, productoNombre?: string) => {
    if (productId) {
        const product = await tx.product.findFirst({
            where: { id: productId, deletedAt: null },
        });
        if (product) return product;
    }

    if (productoNombre && productoNombre.trim() !== '') {
        const product = await tx.product.findFirst({
            where: {
                nombre: { equals: productoNombre.trim(), mode: 'insensitive' },
                deletedAt: null,
            },
        });
        if (product) return product;
    }

    return null;
};

// Helper para buscar lote de forma segura (por ID o por Código)
const findActiveBatch = async (tx: any, batchId?: string, loteCode?: string, productId?: string) => {
    if (batchId) {
        const batch = await tx.batch.findFirst({
            where: { id: batchId, deletedAt: null },
        });
        if (batch) return batch;
    }

    if (loteCode && loteCode.trim() !== '' && productId) {
        const batch = await tx.batch.findFirst({
            where: {
                codigo: { equals: loteCode.trim(), mode: 'insensitive' },
                productId,
                deletedAt: null,
            },
        });
        if (batch) return batch;
    }

    return null;
};

export const getMovements = async (req: Request, res: Response) => {
    try {
        const { tipo, productId, limit, includeGuias, mes, anio } = req.query;

        const where: any = {};
        if (tipo) where.tipo = String(tipo);
        if (productId) where.productId = String(productId);

        if (mes && anio) {
            const m = Number(mes);
            const a = Number(anio);
            const startOfMonth = new Date(a, m - 1, 1);
            const endOfMonth = new Date(a, m, 0, 23, 59, 59, 999);
            where.fecha = {
                gte: startOfMonth,
                lte: endOfMonth,
            };
        }

        const take = limit ? Number(limit) : undefined;
        const shouldIncludeGuias = includeGuias === 'true';

        const movements = await prisma.movement.findMany({
            where,
            include: {
                product: {
                    select: {
                        id: true,
                        nombre: true,
                        codigoBarras: true,
                        tipo: true,
                        presentacion: true,
                        unidadBase: true,
                    }
                },
                batch: {
                    select: {
                        id: true,
                        codigo: true,
                        fechaExpiracion: true,
                        stockActual: true,
                        precioCostoPresentacion: true,
                        precioVentaPresentacion: true,
                        cantidadPorPresentacion: true,
                    }
                },
                ...(shouldIncludeGuias ? { guiasSalida: true } : {}),
            },
            orderBy: {
                fecha: 'desc',
            },
            ...(take ? { take } : {}),
        });

        const mappedMovements = movements.map((m: any) => {
            const batch = m.batch ? {
                ...m.batch,
                precioCostoUnidad: (m.batch.cantidadPorPresentacion || 1) > 0 ? (m.batch.precioCostoPresentacion / (m.batch.cantidadPorPresentacion || 1)) : 0,
                precioVentaUnidad: (m.batch.cantidadPorPresentacion || 1) > 0 ? (m.batch.precioVentaPresentacion / (m.batch.cantidadPorPresentacion || 1)) : 0,
            } : null;
            return {
                ...m,
                batch,
            };
        });

        res.json(mappedMovements);
    } catch (error) {
        console.error('Error al obtener movimientos:', error);
        res.status(500).json({ error: 'Error al obtener movimientos' });
    }
};

export const getMonthlyMovementStats = async (req: Request, res: Response) => {
    try {
        const { tipo } = req.query;
        const hoy = new Date();
        const startOfMonth = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const endOfMonth = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);

        const where: any = {
            fecha: {
                gte: startOfMonth,
                lte: endOfMonth,
            },
        };
        if (tipo) where.tipo = String(tipo);

        const [conteo, sumaCantidad] = await Promise.all([
            prisma.movement.count({ where }),
            prisma.movement.aggregate({
                where,
                _sum: {
                    cantidad: true,
                },
            }),
        ]);

        res.json({
            movimientosEsteMes: conteo,
            totalUnidadesMes: sumaCantidad._sum.cantidad || 0,
        });
    } catch (error) {
        console.error('Error al obtener estadísticas mensuales de movimientos:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas de movimientos' });
    }
};


export const createIngreso = async (req: Request, res: Response) => {
    try {
        const data = createIngresoSchema.parse(req.body);

        const dateValidation = validateMovementDate(data.fecha);
        if (!dateValidation.valid) {
            return res.status(400).json({ error: dateValidation.error });
        }

        const expDate = new Date(data.fechaExpiracion);
        if (isNaN(expDate.getTime())) {
            return res.status(400).json({ error: 'Fecha de expiración inválida.' });
        }

        // 1. Buscar Producto
        const product = await findActiveProduct(prisma, data.productId, data.productoNombre);
        if (!product) {
            return res.status(404).json({ error: `El producto '${data.productoNombre}' no existe o fue eliminado.` });
        }

        // 2. Buscar o Crear Lote
        let batch = await findActiveBatch(prisma, data.batchId, data.lote, product.id);

        if (batch) {
            // Actualizar stock del lote existente
            batch = await prisma.batch.update({
                where: { id: batch.id },
                data: {
                    stockActual: { increment: data.cantidad },
                },
            });
        } else {
            // Crear nuevo lote
            batch = await prisma.batch.create({
                data: {
                    codigo: data.lote.trim(),
                    fechaExpiracion: expDate,
                    stockActual: data.cantidad,
                    productId: product.id,
                },
            });
        }

        // 3. Crear Movimiento
        const movement = await prisma.movement.create({
            data: {
                tipo: 'Ingreso',
                cantidad: data.cantidad,
                motivo: data.motivo || 'Ingreso',
                fecha: dateValidation.date,
                usuario: (req as any).user.full_name,
                proveedor: data.proveedor || null,
                productId: product.id,
                batchId: batch.id,
            },
        });

        invalidateDashboardCache();
        res.status(201).json(movement);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0]?.message || error.errors });
        }
        console.error('Error processing Ingreso:', error);
        res.status(500).json({ error: 'Error al procesar el ingreso' });
    }
};

export const createIngresosBulk = async (req: Request, res: Response) => {
    try {
        const { items } = createIngresosBulkSchema.parse(req.body);

        // FASE 1: Validación previa exhaustiva y resolución de lotes fuera de la transacción
        const preparedItems: any[] = [];
        const pendingNewBatches = new Map<string, { id: string; codigo: string; fechaExpiracion: Date; productId: string; initialStock: number }>();
        const batchIncrements = new Map<string, number>();

        for (let i = 0; i < items.length; i++) {
            const data = items[i];
            const rowNum = i + 1;

            const dateValidation = validateMovementDate(data.fecha);
            if (!dateValidation.valid) {
                return res.status(400).json({ error: `Fila ${rowNum} (${data.productoNombre}): ${dateValidation.error}` });
            }

            const expDate = new Date(data.fechaExpiracion);
            if (isNaN(expDate.getTime())) {
                return res.status(400).json({ error: `Fila ${rowNum} (${data.productoNombre}): Fecha de expiración inválida.` });
            }

            const product = await findActiveProduct(prisma, data.productId, data.productoNombre);
            if (!product) {
                return res.status(404).json({ error: `Fila ${rowNum}: No se encontró el producto '${data.productoNombre}' en el inventario activo.` });
            }

            // Pre-resolución de lote existente o nuevo
            const batch = await findActiveBatch(prisma, data.batchId, data.lote, product.id);
            let resolvedBatchId: string;
            const loteKey = `${product.id}:${data.lote.trim().toUpperCase()}`;

            if (batch) {
                resolvedBatchId = batch.id;
                batchIncrements.set(resolvedBatchId, (batchIncrements.get(resolvedBatchId) || 0) + data.cantidad);
            } else if (pendingNewBatches.has(loteKey)) {
                // Si la misma lista trae repetido el nuevo lote, acumulamos el stock inicial
                const existingPending = pendingNewBatches.get(loteKey)!;
                existingPending.initialStock += data.cantidad;
                resolvedBatchId = existingPending.id;
            } else {
                resolvedBatchId = randomUUID();
                pendingNewBatches.set(loteKey, {
                    id: resolvedBatchId,
                    codigo: data.lote.trim(),
                    fechaExpiracion: expDate,
                    productId: product.id,
                    initialStock: data.cantidad,
                });
            }

            preparedItems.push({
                data,
                product,
                batchId: resolvedBatchId,
                date: dateValidation.date,
            });
        }

        // FASE 2: Ejecución atómica en transacción ultra-optimizada
        const results = await prisma.$transaction(async (tx) => {
            // 1. Inserción masiva de lotes nuevos (si existen) en 1 sola consulta
            if (pendingNewBatches.size > 0) {
                const batchesToInsert = Array.from(pendingNewBatches.values()).map(b => ({
                    id: b.id,
                    codigo: b.codigo,
                    fechaExpiracion: b.fechaExpiracion,
                    stockActual: b.initialStock,
                    productId: b.productId,
                }));
                await tx.batch.createMany({
                    data: batchesToInsert,
                });
            }

            // 2. Actualización de stock de lotes existentes agrupados por lote único
            for (const [batchId, increment] of batchIncrements.entries()) {
                await tx.batch.update({
                    where: { id: batchId },
                    data: {
                        stockActual: { increment },
                    },
                });
            }

            // 3. Inserción masiva de todos los movimientos de inventario en 1 sola consulta
            const movementsData = preparedItems.map(item => ({
                id: randomUUID(),
                tipo: 'Ingreso',
                cantidad: item.data.cantidad,
                motivo: item.data.motivo || 'Ingreso',
                fecha: item.date,
                usuario: (req as any).user.full_name,
                proveedor: item.data.proveedor || null,
                productId: item.product.id,
                batchId: item.batchId,
            }));

            await tx.movement.createMany({
                data: movementsData,
            });

            return movementsData;
        }, {
            maxWait: 60000,
            timeout: 180000,
        });

        invalidateDashboardCache();
        res.status(201).json({ message: `${results.length} ingreso(s) registrado(s) exitosamente`, movements: results });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0]?.message || error.errors });
        }
        console.error('Error in createIngresosBulk:', error);
        res.status(500).json({ 
            error: error?.message ? `Error al procesar los ingresos en lote: ${error.message}` : 'Error interno al procesar los ingresos en lote' 
        });
    }
};

export const createSalida = async (req: Request, res: Response) => {
    try {
        const data = createSalidaSchema.parse(req.body);

        const dateValidation = validateMovementDate(data.fecha);
        if (!dateValidation.valid) {
            return res.status(400).json({ error: dateValidation.error });
        }

        // 1. Buscar Producto
        const product = await findActiveProduct(prisma, data.productId, data.productoNombre);
        if (!product) {
            return res.status(404).json({ error: `El producto '${data.productoNombre}' no existe o fue eliminado.` });
        }

        // 2. Buscar Lote
        if (data.lote === 'SIN-LOTE' || !data.lote?.trim()) {
            return res.status(400).json({ error: `El producto '${product.nombre}' no cuenta con un lote físico asignado para salida.` });
        }

        const batch = await findActiveBatch(prisma, data.batchId, data.lote, product.id);
        if (!batch) {
            return res.status(404).json({ error: `No se encontró el lote '${data.lote}' para el producto '${product.nombre}'.` });
        }

        // 3. Validar Stock
        if (batch.stockActual < data.cantidad) {
            return res.status(400).json({
                error: `Stock insuficiente en el lote '${batch.codigo}' de '${product.nombre}'. Disponible: ${batch.stockActual}, Solicitado: ${data.cantidad}.`
            });
        }

        // 4 y 5. Actualizar Lote y Crear Movimiento en Transacción
        const movement = await prisma.$transaction(async (tx) => {
            await tx.batch.update({
                where: { id: batch.id },
                data: {
                    stockActual: { decrement: data.cantidad },
                },
            });

            return tx.movement.create({
                data: {
                    tipo: 'Salida',
                    cantidad: data.cantidad,
                    motivo: data.motivo || 'Salida',
                    fecha: dateValidation.date,
                    usuario: (req as any).user.full_name,
                    departamento: data.departamento || null,
                    solicitante: data.solicitante || null,
                    productId: product.id,
                    batchId: batch.id,
                },
            });
        }, {
            maxWait: 30000,
            timeout: 60000,
        });

        invalidateDashboardCache();
        res.status(201).json(movement);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0]?.message || error.errors });
        }
        console.error('Error processing Salida:', error);
        res.status(500).json({ error: error?.message ? `Error al procesar la salida: ${error.message}` : 'Error al procesar la salida' });
    }
};

export const createSalidasBulk = async (req: Request, res: Response) => {
    try {
        const { items } = createSalidasBulkSchema.parse(req.body);

        // FASE 1: Validación previa total antes de descontar stock
        const preparedItems: any[] = [];
        const cumulativeRequestedPerBatch = new Map<string, number>();

        for (let i = 0; i < items.length; i++) {
            const data = items[i];
            const rowNum = i + 1;

            const dateValidation = validateMovementDate(data.fecha);
            if (!dateValidation.valid) {
                return res.status(400).json({ error: `Fila ${rowNum} (${data.productoNombre}): ${dateValidation.error}` });
            }

            const product = await findActiveProduct(prisma, data.productId, data.productoNombre);
            if (!product) {
                return res.status(404).json({ error: `Fila ${rowNum}: No se encontró el producto '${data.productoNombre}' en el inventario activo.` });
            }

            if (data.lote === 'SIN-LOTE' || !data.lote?.trim()) {
                return res.status(400).json({ error: `Fila ${rowNum} (${product.nombre}): No se puede registrar salida porque no tiene un lote físico asignado.` });
            }

            const batch = await findActiveBatch(prisma, data.batchId, data.lote, product.id);
            if (!batch) {
                return res.status(404).json({ error: `Fila ${rowNum} (${product.nombre}): No se encontró el lote '${data.lote}'.` });
            }

            const currentAccumulated = (cumulativeRequestedPerBatch.get(batch.id) || 0) + data.cantidad;
            if (batch.stockActual < currentAccumulated) {
                return res.status(400).json({
                    error: `Fila ${rowNum} (${product.nombre}): Stock insuficiente en lote '${batch.codigo}'. Disponible: ${batch.stockActual}, Solicitado acumulado en lista: ${currentAccumulated}.`
                });
            }
            cumulativeRequestedPerBatch.set(batch.id, currentAccumulated);

            preparedItems.push({
                data,
                product,
                batch,
                date: dateValidation.date,
            });
        }

        // FASE 2: Ejecución atómica en transacción ultra-optimizada
        const results = await prisma.$transaction(async (tx) => {
            // 1. Actualización de stock agrupada por lote único
            for (const [batchId, decrement] of cumulativeRequestedPerBatch.entries()) {
                await tx.batch.update({
                    where: { id: batchId },
                    data: {
                        stockActual: { decrement },
                    },
                });
            }

            // 2. Inserción masiva de todos los movimientos de salida en 1 sola consulta
            const movementsData = preparedItems.map(item => ({
                id: randomUUID(),
                tipo: 'Salida',
                cantidad: item.data.cantidad,
                motivo: item.data.motivo || 'Salida',
                fecha: item.date,
                usuario: (req as any).user.full_name,
                departamento: item.data.departamento || null,
                solicitante: item.data.solicitante || null,
                productId: item.product.id,
                batchId: item.batch.id,
            }));

            await tx.movement.createMany({
                data: movementsData,
            });

            return movementsData;
        }, {
            maxWait: 60000,
            timeout: 180000,
        });

        invalidateDashboardCache();
        res.status(201).json({ message: `${results.length} salida(s) registrada(s) exitosamente`, movements: results });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0]?.message || error.errors });
        }
        console.error('Error in createSalidasBulk:', error);
        res.status(500).json({ 
            error: error?.message ? `Error al procesar las salidas en lote: ${error.message}` : 'Error interno al procesar las salidas en lote' 
        });
    }
};
