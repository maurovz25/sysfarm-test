import { Request, Response } from 'express';
import prisma from '../prisma';
import { z } from 'zod';
import { invalidateDashboardCache } from './dashboard.controller';
import { InsufficientFefoStockError, planFefoAllocation } from '../utils/fefo';

const createRequerimientoItemSchema = z.object({
  productId: z.string(),
  cantidadSolicitada: z.number().int().positive(),
  tipoUnidad: z.string().optional().default('unidad'),
  observacion: z.string().optional(),
});

const createRequerimientoSchema = z.object({
  solicitante: z.string(),
  departamento: z.string(),
  observaciones: z.string().optional(),
  items: z.array(createRequerimientoItemSchema).min(1),
});

const updateRequerimientoItemSchema = z.object({
  productId: z.string(),
  cantidadSolicitada: z.number().int().positive(),
  tipoUnidad: z.string().optional().default('unidad'),
  observacion: z.string().optional(),
});

const updateRequerimientoSchema = z.object({
  observaciones: z.string().optional(),
  items: z.array(updateRequerimientoItemSchema).min(1),
});

const aprobarRequerimientoItemSchema = z.object({
  itemId: z.string().optional(),
  productId: z.string().optional(),
  cantidadSolicitada: z.number().int().min(0).optional(),
  cantidadAprobada: z.number().int().min(0),
});

const aprobarRequerimientoSchema = z.object({
  atendidoPor: z.string().optional(), // ignorado: el servidor usa el nombre de la sesión verificada
  itemsAprobados: z.array(aprobarRequerimientoItemSchema).optional(),
});

const rechazarRequerimientoSchema = z.object({
  atendidoPor: z.string().optional(), // ignorado: el servidor usa el nombre de la sesión verificada
  motivoRechazo: z.string().optional(),
});

// GET /api/requerimientos
export const getRequerimientos = async (req: Request, res: Response): Promise<void> => {
  try {
    const { estado, departamento, solicitante } = req.query;

    const where: any = {};
    if (estado) where.estado = String(estado);
    if (departamento) where.departamento = String(departamento);
    if (solicitante) where.solicitante = String(solicitante);

    const [requerimientos, pendingCount] = await Promise.all([
      prisma.requerimiento.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  nombre: true,
                  presentacion: true,
                  unidadBase: true,
                  codigoBarras: true,
                },
              },
              batch: {
                select: {
                  id: true,
                  codigo: true,
                  fechaExpiracion: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.requerimiento.count({
        where: { estado: 'PENDIENTE' },
      }),
    ]);

    res.json({
      requerimientos,
      pendingCount,
    });
  } catch (error) {
    console.error('Error fetching requerimientos:', error);
    res.status(500).json({ error: 'Error al obtener los requerimientos' });
  }
};

// GET /api/requerimientos/count/pending
export const getPendingRequerimientosCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const pendingCount = await prisma.requerimiento.count({
      where: { estado: 'PENDIENTE' },
    });
    res.json({ pendingCount });
  } catch (error) {
    console.error('Error counting pending requerimientos:', error);
    res.status(500).json({ error: 'Error al contar requerimientos pendientes' });
  }
};

// GET /api/requerimientos/:id
export const getRequerimientoById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const requerimiento = await prisma.requerimiento.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              include: {
                batches: {
                  where: { deletedAt: null },
                  orderBy: { fechaExpiracion: 'asc' },
                },
              },
            },
            batch: true,
          },
        },
      },
    });

    if (!requerimiento) {
      res.status(404).json({ error: 'Requerimiento no encontrado' });
      return;
    }

    res.json(requerimiento);
  } catch (error) {
    console.error('Error fetching requerimiento by id:', error);
    res.status(500).json({ error: 'Error al obtener el requerimiento' });
  }
};

// POST /api/requerimientos
export const createRequerimiento = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createRequerimientoSchema.parse(req.body);

    const maxRetries = 3;
    let requerimiento = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        requerimiento = await prisma.$transaction(async (tx) => {
          // Obtener los requerimientos recientes para encontrar el correlativo numérico más alto
          const recentReqs = await tx.requerimiento.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { codigo: true },
          });

          let maxNumber = 0;
          for (const item of recentReqs) {
            const match = item.codigo.match(/^REQ-(\d+)$/);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxNumber) {
                maxNumber = num;
              }
            }
          }

          const count = await tx.requerimiento.count();
          if (count > maxNumber) {
            maxNumber = count;
          }

          const nextNumber = maxNumber + 1 + attempt;
          const codigo = `REQ-${nextNumber.toString().padStart(5, '0')}`;

          return tx.requerimiento.create({
            data: {
              codigo,
              solicitante: data.solicitante,
              departamento: data.departamento,
              observaciones: data.observaciones,
              estado: 'PENDIENTE',
              items: {
                create: data.items.map((item) => ({
                  productId: item.productId,
                  cantidadSolicitada: item.cantidadSolicitada,
                  tipoUnidad: item.tipoUnidad || 'unidad',
                  observacion: item.observacion,
                })),
              },
            },
            include: {
              items: {
                include: {
                  product: true,
                },
              },
            },
          });
        });

        break; // Éxito, salir del bucle de reintentos
      } catch (err: any) {
        if (err?.code === 'P2002' && attempt < maxRetries - 1) {
          // Colisión de clave única por concurrencia exacta, reintentar en el siguiente ciclo
          continue;
        }
        throw err;
      }
    }

    res.status(201).json(requerimiento);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
      return;
    }
    console.error('Error creating requerimiento:', error);
    res.status(500).json({ error: 'Error al crear el requerimiento' });
  }
};

// PUT /api/requerimientos/:id
export const updateRequerimiento = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = updateRequerimientoSchema.parse(req.body);

    const requerimiento = await prisma.requerimiento.findUnique({
      where: { id },
    });

    if (!requerimiento) {
      res.status(404).json({ error: 'Requerimiento no encontrado' });
      return;
    }

    if (requerimiento.estado !== 'PENDIENTE') {
      res.status(400).json({ error: `No se puede editar un requerimiento en estado ${requerimiento.estado}` });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Actualizar observaciones
      await tx.requerimiento.update({
        where: { id },
        data: {
          observaciones: data.observaciones,
        },
      });

      // Reemplazar items
      await tx.requerimientoItem.deleteMany({
        where: { requerimientoId: id },
      });

      await tx.requerimientoItem.createMany({
        data: data.items.map((item) => ({
          requerimientoId: id,
          productId: item.productId,
          cantidadSolicitada: item.cantidadSolicitada,
          tipoUnidad: item.tipoUnidad || 'unidad',
          observacion: item.observacion,
        })),
      });

      return tx.requerimiento.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: {
                include: {
                  batches: {
                    where: { deletedAt: null },
                    orderBy: { fechaExpiracion: 'asc' },
                  },
                },
              },
              batch: true,
            },
          },
        },
      });
    });

    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
      return;
    }
    console.error('Error updating requerimiento:', error);
    res.status(500).json({ error: 'Error al actualizar el requerimiento' });
  }
};

// POST /api/requerimientos/:id/despachar (Aprobar con FEFO)
export const aprobarYDespacharRequerimiento = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = aprobarRequerimientoSchema.parse(req.body);

    const requerimiento = await prisma.requerimiento.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!requerimiento) {
      res.status(404).json({ error: 'Requerimiento no encontrado' });
      return;
    }

    if (requerimiento.estado !== 'PENDIENTE') {
      res.status(400).json({ error: `El requerimiento ya se encuentra en estado ${requerimiento.estado}` });
      return;
    }

    // Mapa de ajustes de cantidad de items si fue enviado
    const aprobadosMap = new Map<string, number>();
    if (data.itemsAprobados) {
      data.itemsAprobados.forEach((item) => {
        if (item.itemId) {
          aprobadosMap.set(item.itemId, item.cantidadAprobada);
        }
      });
    }

    // Ejecutar transacción Prisma para despacho FEFO
    const result = await prisma.$transaction(async (tx) => {
      const itemsToProcess = [...requerimiento.items];

      // Procesar si hay ítems nuevos agregados en el despacho (tienen productId pero no itemId existente)
      if (data.itemsAprobados) {
        for (const itemAprobado of data.itemsAprobados) {
          if (!itemAprobado.itemId && itemAprobado.productId) {
            const newItem = await tx.requerimientoItem.create({
              data: {
                requerimientoId: id,
                productId: itemAprobado.productId,
                cantidadSolicitada: itemAprobado.cantidadSolicitada || itemAprobado.cantidadAprobada,
                cantidadAprobada: itemAprobado.cantidadAprobada,
                tipoUnidad: 'unidad',
              },
              include: {
                product: true,
              },
            });
            itemsToProcess.push(newItem);
            aprobadosMap.set(newItem.id, itemAprobado.cantidadAprobada);
          }
        }
      }

      for (const item of itemsToProcess) {
        const qtyToFulfill = aprobadosMap.has(item.id)
          ? aprobadosMap.get(item.id)!
          : item.cantidadSolicitada;

        // Actualizar la cantidad aprobada en el item
        await tx.requerimientoItem.update({
          where: { id: item.id },
          data: { cantidadAprobada: qtyToFulfill },
        });

        if (qtyToFulfill <= 0) continue; // Si la cantidad aprobada fue ajustada a 0, omitir salida

        // Buscar lotes del producto con stock, ordenados por fechaExpiracion ASC (FEFO)
        const batches = await tx.batch.findMany({
          where: {
            productId: item.productId,
            deletedAt: null,
            stockActual: { gt: 0 },
          },
          orderBy: [
            { fechaExpiracion: 'asc' },
            { id: 'asc' },
          ],
        });

        let allocations;
        try {
          allocations = planFefoAllocation(batches, qtyToFulfill);
        } catch (error) {
          if (error instanceof InsufficientFefoStockError) {
            throw new Error(
              `Stock insuficiente para "${item.product.nombre}". Requerido: ${qtyToFulfill}, Disponible: ${error.available}`
            );
          }
          throw error;
        }

        for (const { batch, quantity: amountFromBatch } of allocations) {
          // Descontar del lote
          await tx.batch.update({
            where: { id: batch.id },
            data: {
              stockActual: { decrement: amountFromBatch },
            },
          });

          // Registrar Movimiento de Salida en inventario/kardex
          await tx.movement.create({
            data: {
              tipo: 'Salida',
              cantidad: amountFromBatch,
              motivo: `Requerimiento ${requerimiento.codigo} (${requerimiento.departamento})`,
              usuario: (req as any).user.full_name,
              departamento: requerimiento.departamento,
              productId: item.productId,
              batchId: batch.id,
              fecha: new Date(),
            },
          });
        }
      }

      // Actualizar estado del requerimiento
      const updatedReq = await tx.requerimiento.update({
        where: { id },
        data: {
          estado: 'DESPACHADO',
          atendidoPor: (req as any).user.full_name,
          fechaAtencion: new Date(),
        },
        include: {
          items: {
            include: {
              product: true,
              batch: true,
            },
          },
        },
      });

      return updatedReq;
    }, {
      maxWait: 60000,
      timeout: 180000,
    });

    invalidateDashboardCache();
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
      return;
    }
    console.error('Error despachando requerimiento:', error);
    res.status(400).json({ error: error.message || 'Error al procesar el despacho del requerimiento' });
  }
};

// POST /api/requerimientos/:id/rechazar
export const rechazarRequerimiento = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = rechazarRequerimientoSchema.parse(req.body);

    const requerimiento = await prisma.requerimiento.findUnique({
      where: { id },
    });

    if (!requerimiento) {
      res.status(404).json({ error: 'Requerimiento no encontrado' });
      return;
    }

    if (requerimiento.estado !== 'PENDIENTE') {
      res.status(400).json({ error: `El requerimiento ya se encuentra en estado ${requerimiento.estado}` });
      return;
    }

    const updated = await prisma.requerimiento.update({
      where: { id },
      data: {
        estado: 'RECHAZADO',
        atendidoPor: (req as any).user.full_name,
        motivoRechazo: data.motivoRechazo || 'Rechazado por administración',
        fechaAtencion: new Date(),
      },
    });

    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
      return;
    }
    console.error('Error rechazando requerimiento:', error);
    res.status(500).json({ error: 'Error al rechazar el requerimiento' });
  }
};
