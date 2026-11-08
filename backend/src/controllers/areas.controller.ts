import { Request, Response } from 'express';
import prisma from '../prisma';

// GET /api/areas — Lista todas las áreas activas
export const getAreas = async (req: Request, res: Response) => {
    try {
        const { incluirInactivas } = req.query;
        const where: any = {};
        
        if (incluirInactivas !== 'true') {
            where.activo = true;
        }

        const areas = await prisma.area.findMany({
            where,
            orderBy: { nombre: 'asc' },
        });

        res.json(areas);
    } catch (error) {
        console.error('Error fetching areas:', error);
        res.status(500).json({ error: 'Error al obtener las áreas clínicas' });
    }
};

// GET /api/areas/:id — Detalle de una área
export const getAreaById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const area = await prisma.area.findUnique({ where: { id } });
        if (!area) {
            return res.status(404).json({ error: 'Área no encontrada' });
        }
        res.json(area);
    } catch (error) {
        console.error('Error fetching area:', error);
        res.status(500).json({ error: 'Error al obtener el área' });
    }
};

// POST /api/areas — Crear una nueva área
export const createArea = async (req: Request, res: Response) => {
    try {
        const { nombre, descripcion } = req.body;

        if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
            return res.status(400).json({ error: 'El nombre del área es obligatorio' });
        }

        const existing = await prisma.area.findFirst({
            where: { nombre: { equals: nombre.trim(), mode: 'insensitive' } },
        });

        if (existing) {
            return res.status(400).json({ error: `El área "${nombre}" ya existe` });
        }

        const area = await prisma.area.create({
            data: {
                nombre: nombre.trim(),
                descripcion: descripcion?.trim() || null,
                activo: true,
            },
        });

        res.status(201).json(area);
    } catch (error) {
        console.error('Error creating area:', error);
        res.status(500).json({ error: 'Error al crear el área' });
    }
};

// PUT /api/areas/:id — Actualizar un área
export const updateArea = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, activo } = req.body;

        const existing = await prisma.area.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Área no encontrada' });
        }

        const updateData: any = {};
        if (nombre !== undefined) {
            if (typeof nombre !== 'string' || nombre.trim() === '') {
                return res.status(400).json({ error: 'El nombre del área no puede estar vacío' });
            }
            updateData.nombre = nombre.trim();
        }
        if (descripcion !== undefined) {
            updateData.descripcion = descripcion?.trim() || null;
        }
        if (activo !== undefined) {
            updateData.activo = Boolean(activo);
        }

        const area = await prisma.area.update({
            where: { id },
            data: updateData,
        });

        res.json(area);
    } catch (error) {
        console.error('Error updating area:', error);
        res.status(500).json({ error: 'Error al actualizar el área' });
    }
};

// DELETE /api/areas/:id — Desactivar/Eliminar área
export const deleteArea = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const existing = await prisma.area.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Área no encontrada' });
        }

        // Desactivación lógica (soft) para mantener integridad referencial en movimientos e historial
        const area = await prisma.area.update({
            where: { id },
            data: { activo: false },
        });

        res.json({ message: `Área "${existing.nombre}" desactivada exitosamente`, area });
    } catch (error) {
        console.error('Error deleting area:', error);
        res.status(500).json({ error: 'Error al desactivar el área' });
    }
};
