import { Request, Response } from 'express';
import prisma from '../prisma';
import { invalidateDashboardCache } from './dashboard.controller';

// Listar todos los lotes activos
export const getBatches = async (req: Request, res: Response) => {
    try {
        const batches = await prisma.batch.findMany({
            where: {
                deletedAt: null // Solo lotes activos
            },
            include: {
                product: {
                    select: {
                        id: true,
                        nombre: true,
                        tipo: true,
                        presentacion: true,
                        unidadBase: true,
                        codigoBarras: true,
                        descripcion: true,
                        registroSanitario: true,
                        stockMinimo: true,
                    }
                }
            },
            orderBy: [
                { product: { nombre: 'asc' } },
                { codigo: 'asc' }
            ]
        });

        const mappedBatches = batches.map((b: any) => {
            const cant = b.cantidadPorPresentacion || 1;
            return {
                ...b,
                precioCostoUnidad: cant > 0 ? (b.precioCostoPresentacion / cant) : 0,
                precioVentaUnidad: cant > 0 ? (b.precioVentaPresentacion / cant) : 0,
            };
        });

        res.json(mappedBatches);

    } catch (error) {
        console.error('Error fetching batches:', error);
        res.status(500).json({ error: 'Error al obtener lotes' });
    }
};

// Obtener un lote específico
export const getBatchById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const batch = await prisma.batch.findUnique({
            where: { id },
            include: {
                product: true,
                movements: {
                    orderBy: { fecha: 'desc' },
                    take: 10 // Últimos 10 movimientos
                }
            }
        });

        if (!batch) {
            return res.status(404).json({ error: 'Lote no encontrado' });
        }

        const cant = batch.cantidadPorPresentacion || 1;
        const mappedBatch = {
            ...batch,
            precioCostoUnidad: cant > 0 ? (batch.precioCostoPresentacion / cant) : 0,
            precioVentaUnidad: cant > 0 ? (batch.precioVentaPresentacion / cant) : 0,
        };

        res.json(mappedBatch);
    } catch (error) {
        console.error('Error fetching batch:', error);
        res.status(500).json({ error: 'Error al obtener lote' });
    }
};

// Crear un nuevo lote
export const createBatch = async (req: Request, res: Response) => {
    try {
        const {
            productId, codigo, fechaExpiracion, stockActual,
            precioCostoPresentacion, precioVentaPresentacion, precioCostoUnidad, precioVentaUnidad,
            laboratorio, usuario
        } = req.body;

        if (!productId || !codigo || !fechaExpiracion) {
            return res.status(400).json({ error: 'Faltan campos obligatorios (productId, codigo, fechaExpiracion)' });
        }

        let batch;
        if (stockActual && stockActual > 0) {
            const result = await prisma.$transaction(async (tx) => {
                const b = await tx.batch.create({
                    data: {
                        productId,
                        codigo,
                        fechaExpiracion: new Date(fechaExpiracion),
                        stockActual: stockActual,
                        precioCostoPresentacion: precioCostoPresentacion || 0,
                        precioVentaPresentacion: precioVentaPresentacion || 0,
                        laboratorio: laboratorio || null,
                    },
                    include: {
                        product: true
                    }
                });

                await tx.movement.create({
                    data: {
                        tipo: 'Ingreso',
                        cantidad: stockActual,
                        motivo: 'Carga Inicial de Lote',
                        usuario: (req as any).user.full_name,
                        productId: productId,
                        batchId: b.id
                    }
                });

                return b;
            });
            batch = result;
        } else {
            batch = await prisma.batch.create({
                data: {
                    productId,
                    codigo,
                    fechaExpiracion: new Date(fechaExpiracion),
                    stockActual: 0,
                    precioCostoPresentacion: precioCostoPresentacion || 0,
                    precioVentaPresentacion: precioVentaPresentacion || 0,
                    laboratorio: laboratorio || null,
                },
                include: {
                    product: true
                }
            });
        }

        invalidateDashboardCache();
        res.status(201).json(batch);
    } catch (error) {
        console.error('Error creating batch:', error);
        res.status(500).json({ error: 'Error al crear el lote' });
    }
};

// Actualizar un lote existente
export const updateBatch = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { codigo, fechaExpiracion, stockActual, motivo, usuario } = req.body;

        // 1. Obtener estado actual del lote para comparar stock
        const currentBatch = await prisma.batch.findUnique({
            where: { id }
        });

        if (!currentBatch) {
            return res.status(404).json({ error: 'Lote no encontrado' });
        }

        const updates: any = {};
        if (codigo !== undefined && codigo !== null && String(codigo).trim() !== '') {
            updates.codigo = String(codigo).trim();
        }
        if (fechaExpiracion !== undefined && fechaExpiracion !== null && String(fechaExpiracion).trim() !== '') {
            const parsedDate = new Date(fechaExpiracion);
            if (!isNaN(parsedDate.getTime())) {
                updates.fechaExpiracion = parsedDate;
            }
        }
        if (req.body.precioCostoPresentacion !== undefined && req.body.precioCostoPresentacion !== null) {
            updates.precioCostoPresentacion = Number(req.body.precioCostoPresentacion) || 0;
        }
        if (req.body.precioVentaPresentacion !== undefined && req.body.precioVentaPresentacion !== null) {
            updates.precioVentaPresentacion = Number(req.body.precioVentaPresentacion) || 0;
        }
        if (req.body.laboratorio !== undefined) {
            updates.laboratorio = req.body.laboratorio && String(req.body.laboratorio).trim() !== '' ? String(req.body.laboratorio).trim() : null;
        }

        // 2. Si hay cambio de stock, validar motivo y crear movimiento
        if (stockActual !== undefined && stockActual !== null && Number(stockActual) !== currentBatch.stockActual) {
            const numStock = Number(stockActual);
            if (isNaN(numStock) || numStock < 0) {
                return res.status(400).json({ error: 'El stock debe ser un número entero no negativo' });
            }
            if (!motivo || String(motivo).trim() === '') {
                return res.status(400).json({ error: 'Se requiere un motivo para ajustar el stock manualmente' });
            }

            const diferencia = numStock - currentBatch.stockActual;

            // Transacción: Actualizar lote y crear movimiento
            const result = await prisma.$transaction([
                prisma.batch.update({
                    where: { id },
                    data: { ...updates, stockActual: numStock },
                    include: { product: true }
                }),
                prisma.movement.create({
                    data: {
                        tipo: 'Ajuste',
                        cantidad: diferencia,
                        motivo: String(motivo).trim(),
                        usuario: (req as any).user.full_name,
                        productId: currentBatch.productId,
                        batchId: currentBatch.id
                    }
                })
            ]);

            invalidateDashboardCache();
            return res.json(result[0]);
        }

        // 3. Si no hay cambio de stock, actualización normal
        const batch = await prisma.batch.update({
            where: { id },
            data: updates,
            include: {
                product: true
            }
        });

        invalidateDashboardCache();
        res.json(batch);
    } catch (error) {
        if ((error as any).code === 'P2002') {
            return res.status(400).json({ error: 'Ya existe un lote con ese código' });
        }
        if ((error as any).code === 'P2025') {
            return res.status(404).json({ error: 'Lote no encontrado' });
        }
        console.error('Error updating batch:', error);
        res.status(500).json({ error: 'Error al actualizar el lote' });
    }
};

// Obtener historial de ajustes
export const getAdjustmentHistory = async (req: Request, res: Response) => {
    try {
        const { limit } = req.query;
        const take = limit ? Number(limit) : undefined;

        const adjustments = await prisma.movement.findMany({
            where: {
                tipo: 'Ajuste'
            },
            include: {
                product: true,
                batch: true
            },
            orderBy: {
                fecha: 'desc'
            },
            ...(take ? { take } : {}),
        });

        res.json(adjustments);
    } catch (error) {
        console.error('Error fetching adjustment history:', error);
        res.status(500).json({ error: 'Error al obtener historial de ajustes' });
    }
};
