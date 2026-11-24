import { Request, Response } from 'express';
import prisma from '../prisma';
import { calcularSugerencias, Sugerencias } from '../utils/pronostico';

const VENTANA_DIAS = 84;            // 12 semanas: 28 días de historia más los orígenes de entrenamiento y validación
const LIMA_MS = -5 * 3600 * 1000;   // Perú no usa horario de verano
const diaLima = (d: Date) => new Date(d.getTime() + LIMA_MS).toISOString().slice(0, 10);
let cache: { fin: string; hecho: number; datos: Sugerencias } | null = null;

// GET /api/sugerencias — pronóstico de 7 días, sugerencias de reposición y lotes en riesgo de vencimiento (RF-45, CU-17)
export const getSugerencias = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Último día completo con registros: ayer, o el día anterior al último movimiento si los datos terminan antes
    // (p. ej., una copia de la base). Un día parcial o sin registrar contaría como demanda 0 y sesgaría el pronóstico.
    const ultimo = await prisma.movement.findFirst({ orderBy: { fecha: 'desc' }, select: { fecha: true } });
    const ayer = diaLima(new Date(Date.now() - 86400000));
    const antesDelUltimo = ultimo ? new Date(Date.parse(diaLima(ultimo.fecha)) - 86400000).toISOString().slice(0, 10) : ayer;
    const fin = antesDelUltimo < ayer ? antesDelUltimo : ayer;
    if (cache && cache.fin === fin && Date.now() - cache.hecho < 3600000) { res.json(cache.datos); return; }
    const inicioD = new Date(Date.parse(fin) - (VENTANA_DIAS - 1) * 86400000); const inicio = inicioD.toISOString().slice(0, 10);
    const desde = new Date(Date.parse(inicio) - LIMA_MS), hasta = new Date(Date.parse(fin) + 86400000 - LIMA_MS);
    const [movs, batches] = await Promise.all([
      prisma.movement.findMany({ where: { tipo: 'Salida', fecha: { gte: desde, lt: hasta } }, select: { productId: true, cantidad: true, fecha: true } }),
      prisma.batch.findMany({ where: { deletedAt: null }, select: { id: true, codigo: true, productId: true, fechaExpiracion: true, stockActual: true, product: { select: { nombre: true, tipo: true } } } }),
    ]);
    const productos = new Map(batches.map(b => [b.productId, { id: b.productId, nombre: b.product.nombre, esMedicamento: b.product.tipo === 'MEDICAMENTO' }]));
    const datos = calcularSugerencias(
      movs.map(m => ({ productId: m.productId, fecha: diaLima(m.fecha), cantidad: m.cantidad })),
      batches.map(b => ({ id: b.id, codigo: b.codigo, productId: b.productId, vence: b.fechaExpiracion.toISOString().slice(0, 10), stock: b.stockActual })),
      [...productos.values()], inicio, fin);
    cache = { fin, hecho: Date.now(), datos };
    res.json(datos);
  } catch (error: any) {
    console.error('Error calculando sugerencias:', error);
    res.status(error?.message?.startsWith('Historia insuficiente') ? 422 : 500).json({ error: error?.message || 'Error al calcular las sugerencias' });
  }
};
