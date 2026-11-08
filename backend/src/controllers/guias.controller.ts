import { Request, Response } from 'express';
import prisma from '../prisma';
import { z } from 'zod';

const createOrUpdateGuiaSchema = z.object({
    guiaId: z.string().optional().nullable(),
    movementId: z.string().min(1, 'El ID del movimiento es requerido'),
    medicoAnestesiologo: z.string().min(1, 'El nombre del médico anestesiólogo es requerido'),
    cmpMedico: z.string().optional().nullable(),
    paciente: z.string().min(1, 'El nombre del paciente es requerido'),
    dniPaciente: z.string().optional().nullable(),
    direccionPaciente: z.string().optional().nullable(),
    distritoPaciente: z.string().optional().nullable(),
    numeroReceta: z.string().min(1, 'El número de referencia de receta es requerido'),
    cantidad: z.number().int().positive('La cantidad debe ser mayor a 0').optional().default(1),
    usuarioEmisor: z.string().optional().nullable(),
});

export const createOrUpdateGuia = async (req: Request, res: Response) => {
    try {
        const data = createOrUpdateGuiaSchema.parse(req.body);

        // 1. Verificar existencia y validez del movimiento
        const movement = await prisma.movement.findUnique({
            where: { id: data.movementId },
            include: {
                product: true,
                batch: true,
                guiasSalida: true,
            },
        });

        if (!movement) {
            return res.status(404).json({ error: 'El movimiento no fue encontrado.' });
        }

        if (movement.tipo !== 'Salida') {
            return res.status(400).json({ error: 'Solo se pueden emitir guías de salida para movimientos de tipo Salida.' });
        }

        const guiasExistentes = movement.guiasSalida || [];
        const cantidadSolicitada = data.cantidad || 1;

        // 2. Si se proporciona guiaId, actualizar la guía existente
        if (data.guiaId) {
            const guiaActual = guiasExistentes.find(g => g.id === data.guiaId);
            if (!guiaActual) {
                return res.status(404).json({ error: 'La guía especificada no existe para este movimiento.' });
            }

            const sumaOtrasGuias = guiasExistentes
                .filter(g => g.id !== data.guiaId)
                .reduce((sum, g) => sum + g.cantidad, 0);

            if (sumaOtrasGuias + cantidadSolicitada > movement.cantidad) {
                const disponible = movement.cantidad - sumaOtrasGuias;
                return res.status(400).json({
                    error: `La cantidad solicitada (${cantidadSolicitada}) excede las unidades disponibles para este movimiento. Máximo permitido: ${disponible}.`
                });
            }

            const updatedGuia = await prisma.guiaSalida.update({
                where: { id: data.guiaId },
                data: {
                    medicoAnestesiologo: data.medicoAnestesiologo.trim(),
                    cmpMedico: data.cmpMedico?.trim() || null,
                    paciente: data.paciente.trim(),
                    dniPaciente: data.dniPaciente?.trim() || null,
                    direccionPaciente: data.direccionPaciente?.trim() || null,
                    distritoPaciente: data.distritoPaciente?.trim() || null,
                    numeroReceta: data.numeroReceta.trim(),
                    cantidad: cantidadSolicitada,
                    usuarioEmisor: data.usuarioEmisor || guiaActual.usuarioEmisor,
                },
                include: {
                    movement: {
                        include: {
                            product: true,
                            batch: true,
                        },
                    },
                },
            });

            return res.json({
                message: `Guía ${updatedGuia.codigo} actualizada exitosamente`,
                guia: updatedGuia,
            });
        }

        // 3. Crear una nueva guía si aún hay saldo pendiente
        const sumaExistente = guiasExistentes.reduce((sum, g) => sum + g.cantidad, 0);
        const pendiente = movement.cantidad - sumaExistente;

        if (pendiente <= 0) {
            return res.status(400).json({
                error: `Este movimiento ya tiene cubiertas sus ${movement.cantidad} unidades en ${guiasExistentes.length} guía(s) emitida(s).`
            });
        }

        if (cantidadSolicitada > pendiente) {
            return res.status(400).json({
                error: `La cantidad solicitada (${cantidadSolicitada}) excede el saldo pendiente (${pendiente} unidad/es) para este movimiento.`
            });
        }

        const newGuia = await prisma.$transaction(async (tx) => {
            const lastGuia = await tx.guiaSalida.findFirst({
                orderBy: { correlativo: 'desc' },
            });

            const nextCorrelativo = (lastGuia?.correlativo || 0) + 1;
            const codigo = `GS-${nextCorrelativo}`;

            return tx.guiaSalida.create({
                data: {
                    codigo,
                    correlativo: nextCorrelativo,
                    medicoAnestesiologo: data.medicoAnestesiologo.trim(),
                    cmpMedico: data.cmpMedico?.trim() || null,
                    paciente: data.paciente.trim(),
                    dniPaciente: data.dniPaciente?.trim() || null,
                    direccionPaciente: data.direccionPaciente?.trim() || null,
                    distritoPaciente: data.distritoPaciente?.trim() || null,
                    numeroReceta: data.numeroReceta.trim(),
                    fechaSalida: movement.fecha,
                    fechaEmision: new Date(),
                    medicamentoNombre: movement.product.nombre,
                    loteCodigo: movement.batch?.codigo || null,
                    fechaVencimiento: movement.batch?.fechaExpiracion || null,
                    cantidad: cantidadSolicitada,
                    unidadMedida: movement.product.presentacion || movement.product.unidadBase || 'Unidad',
                    usuarioEmisor: data.usuarioEmisor || movement.usuario || 'Farmacéutico',
                    movementId: movement.id,
                },
                include: {
                    movement: {
                        include: {
                            product: true,
                            batch: true,
                        },
                    },
                },
            });
        });

        res.status(201).json({
            message: `Guía ${newGuia.codigo} emitida exitosamente (${cantidadSolicitada} unidad/es)`,
            guia: newGuia,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0]?.message || error.errors });
        }
        console.error('Error al crear o actualizar guía de salida:', error);
        res.status(500).json({ error: 'Error interno al procesar la guía de salida' });
    }
};

export const getGuiaByMovementId = async (req: Request, res: Response) => {
    try {
        const { movementId } = req.params;

        const movement = await prisma.movement.findUnique({
            where: { id: movementId },
            include: {
                product: true,
                batch: true,
                guiasSalida: {
                    orderBy: { correlativo: 'asc' },
                },
            },
        });

        if (!movement) {
            return res.status(404).json({ error: 'El movimiento no fue encontrado.' });
        }

        const guias = movement.guiasSalida || [];
        const emitidasCantidad = guias.reduce((sum, g) => sum + g.cantidad, 0);
        const pendienteCantidad = Math.max(0, movement.cantidad - emitidasCantidad);

        res.json({
            movementId: movement.id,
            totalCantidad: movement.cantidad,
            emitidasCantidad,
            pendienteCantidad,
            guias,
        });
    } catch (error) {
        console.error('Error al obtener guías por movimiento:', error);
        res.status(500).json({ error: 'Error al obtener las guías de salida' });
    }
};

export const getGuias = async (req: Request, res: Response) => {
    try {
        const guias = await prisma.guiaSalida.findMany({
            orderBy: { correlativo: 'desc' },
            include: {
                movement: {
                    include: {
                        product: true,
                        batch: true,
                    },
                },
            },
        });

        res.json(guias);
    } catch (error) {
        console.error('Error al listar guías:', error);
        res.status(500).json({ error: 'Error al obtener el listado de guías' });
    }
};

export const getMedicosSugeridos = async (req: Request, res: Response) => {
    try {
        const guias = await prisma.guiaSalida.findMany({
            select: {
                medicoAnestesiologo: true,
                cmpMedico: true,
            },
            distinct: ['medicoAnestesiologo'],
            orderBy: {
                medicoAnestesiologo: 'asc',
            },
        });

        res.json(guias);
    } catch (error) {
        console.error('Error al obtener sugerencias de médicos:', error);
        res.status(500).json({ error: 'Error al obtener sugerencias de médicos' });
    }
};
