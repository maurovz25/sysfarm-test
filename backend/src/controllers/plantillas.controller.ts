import { Request, Response } from 'express';
import prisma from '../prisma';

// GET /plantillas — Lista todas las plantillas con sus ítems y datos del producto
export const getPlantillas = async (req: Request, res: Response) => {
    try {
        const { areaId } = req.query;
        const whereClause: any = {};
        if (areaId) {
            whereClause.OR = [
                { areaId: String(areaId) },
                { areaId: null },
            ];
        }

        const plantillas = await prisma.plantillaRequerimiento.findMany({
            where: whereClause,
            include: {
                area: {
                    select: { id: true, nombre: true },
                },
                items: {
                    orderBy: { orden: 'asc' },
                    include: {
                        product: {
                            select: {
                                id: true,
                                nombre: true,
                                presentacion: true,
                                unidadBase: true,
                                deletedAt: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
        res.json(plantillas);
    } catch (error) {
        console.error('Error fetching plantillas:', error);
        res.status(500).json({ error: 'Error al obtener las plantillas' });
    }
};

// GET /plantillas/:id — Detalle de una plantilla
export const getPlantillaById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const plantilla = await prisma.plantillaRequerimiento.findUnique({
            where: { id },
            include: {
                area: {
                    select: { id: true, nombre: true },
                },
                items: {
                    orderBy: { orden: 'asc' },
                    include: {
                        product: {
                            select: {
                                id: true,
                                nombre: true,
                                presentacion: true,
                                unidadBase: true,
                                deletedAt: true,
                            },
                        },
                    },
                },
            },
        });
        if (!plantilla) {
            return res.status(404).json({ error: 'Plantilla no encontrada' });
        }
        res.json(plantilla);
    } catch (error) {
        console.error('Error fetching plantilla:', error);
        res.status(500).json({ error: 'Error al obtener la plantilla' });
    }
};

// POST /plantillas — Crear plantilla { nombre, descripcion?, areaId?, productIds: string[] }
export const createPlantilla = async (req: Request, res: Response) => {
    try {
        const { nombre, descripcion, areaId, productIds } = req.body;

        if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
            return res.status(400).json({ error: 'El nombre de la plantilla es obligatorio' });
        }
        if (!Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ error: 'La plantilla debe incluir al menos un producto' });
        }

        // Verificar que todos los productIds existan y no estén eliminados
        const products = await prisma.product.findMany({
            where: { id: { in: productIds }, deletedAt: null },
            select: { id: true },
        });
        if (products.length !== productIds.length) {
            return res.status(400).json({ error: 'Uno o más productos no existen o han sido eliminados del inventario' });
        }

        const plantilla = await prisma.plantillaRequerimiento.create({
            data: {
                nombre: nombre.trim(),
                descripcion: descripcion?.trim() || null,
                areaId: areaId || null,
                items: {
                    create: productIds.map((productId: string, index: number) => ({
                        productId,
                        orden: index,
                    })),
                },
            },
            include: {
                area: {
                    select: { id: true, nombre: true },
                },
                items: {
                    orderBy: { orden: 'asc' },
                    include: {
                        product: {
                            select: { id: true, nombre: true, presentacion: true, unidadBase: true, deletedAt: true },
                        },
                    },
                },
            },
        });

        res.status(201).json(plantilla);
    } catch (error) {
        console.error('Error creating plantilla:', error);
        res.status(500).json({ error: 'Error al crear la plantilla' });
    }
};

// PUT /plantillas/:id — Editar plantilla { nombre?, descripcion?, areaId?, productIds? }
export const updatePlantilla = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, areaId, productIds } = req.body;

        const existing = await prisma.plantillaRequerimiento.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Plantilla no encontrada' });
        }

        const updateData: any = {};
        if (nombre !== undefined) {
            if (typeof nombre !== 'string' || nombre.trim() === '') {
                return res.status(400).json({ error: 'El nombre no puede estar vacío' });
            }
            updateData.nombre = nombre.trim();
        }
        if (descripcion !== undefined) {
            updateData.descripcion = descripcion?.trim() || null;
        }
        if (areaId !== undefined) {
            updateData.areaId = areaId || null;
        }

        // Si se manda nueva lista de productos, reemplazar todos los ítems
        if (Array.isArray(productIds)) {
            if (productIds.length === 0) {
                return res.status(400).json({ error: 'La plantilla debe incluir al menos un producto' });
            }
            // Verificar existencia
            const products = await prisma.product.findMany({
                where: { id: { in: productIds }, deletedAt: null },
                select: { id: true },
            });
            if (products.length !== productIds.length) {
                return res.status(400).json({ error: 'Uno o más productos no existen o han sido eliminados del inventario' });
            }

            // Eliminar ítems existentes y crear nuevos en transacción
            await prisma.$transaction([
                prisma.plantillaRequerimientoItem.deleteMany({ where: { plantillaId: id } }),
                prisma.plantillaRequerimientoItem.createMany({
                    data: productIds.map((productId: string, index: number) => ({
                        plantillaId: id,
                        productId,
                        orden: index,
                    })),
                }),
            ]);
        }

        const plantilla = await prisma.plantillaRequerimiento.update({
            where: { id },
            data: updateData,
            include: {
                area: {
                    select: { id: true, nombre: true },
                },
                items: {
                    orderBy: { orden: 'asc' },
                    include: {
                        product: {
                            select: { id: true, nombre: true, presentacion: true, unidadBase: true, deletedAt: true },
                        },
                    },
                },
            },
        });

        res.json(plantilla);
    } catch (error) {
        console.error('Error updating plantilla:', error);
        res.status(500).json({ error: 'Error al actualizar la plantilla' });
    }
};

// DELETE /plantillas/:id — Eliminar plantilla (cascade en items por schema)
export const deletePlantilla = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const existing = await prisma.plantillaRequerimiento.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Plantilla no encontrada' });
        }
        await prisma.plantillaRequerimiento.delete({ where: { id } });
        res.json({ message: `Plantilla "${existing.nombre}" eliminada exitosamente` });
    } catch (error) {
        console.error('Error deleting plantilla:', error);
        res.status(500).json({ error: 'Error al eliminar la plantilla' });
    }
};
