// Pronóstico de demanda de 7 días y sugerencias de reposición y de riesgo de vencimiento (RF-45, CU-17).
// Port de ml/pronostico.py y ml/ejecutar.py; scripts/paridad-pronostico.cjs comprueba que dan el mismo resultado.

export const H = 7;      // horizonte (días)
export const HIST = 28;  // historia que usan las variables (días)
export const METODOS = ['regresion', 'regresion_relativa_robusta', 'ultima_semana', 'promedio_4_semanas'] as const;
export type Metodo = typeof METODOS[number];

export interface Salida { productId: string; fecha: string; cantidad: number }           // fecha AAAA-MM-DD (Lima)
export interface Lote { id: string; codigo: string; productId: string; vence: string; stock: number } // vence AAAA-MM-DD
export interface Producto { id: string; nombre: string; esMedicamento: boolean }

const DIA = 86400000;
const dia = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export const diasEntre = (a: string, b: string) => Math.round((dia(b) - dia(a)) / DIA);
const suma = (v: number[]) => v.reduce((a, b) => a + b, 0);

export function serieDiaria(salidas: Salida[], productos: string[], inicio: string, fin: string): number[][] {
  const idx = new Map(productos.map((p, i) => [p, i]));
  const n = diasEntre(inicio, fin) + 1;
  const D = productos.map(() => new Array<number>(n).fill(0));
  for (const s of salidas) {
    const i = idx.get(s.productId); const d = diasEntre(inicio, s.fecha);
    if (i !== undefined && d >= 0 && d < n) D[i][d] += s.cantidad;
  }
  return D;
}

/** Variables del origen t para el producto i: [1, últimos 7 días, promedio semanal de 28 días, fracción de días con salida, es medicamento]. */
function variables(fila: number[], t: number, esMed: number): number[] {
  const h = fila.slice(t - HIST, t);
  return [1, suma(h.slice(-7)), suma(h) / 4, h.filter(x => x > 0).length / HIST, esMed];
}

export function ventanas(D: number[][], origenes: number[], esMed: number[]) {
  const X: number[][] = [], y: number[] = [], p: number[] = [];
  for (const t of origenes) D.forEach((fila, i) => { X.push(variables(fila, t, esMed[i])); y.push(suma(fila.slice(t, t + H))); p.push(i); });
  return { X, y, p };
}

/** Resuelve A·x = b por eliminación gaussiana con pivoteo parcial. */
function resolver(A: number[][], b: number[]): number[] {
  const n = b.length; const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) continue; // columna sin información (p. ej., todos medicamentos): coeficiente 0
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => (Math.abs(r[i]) < 1e-12 ? 0 : r[n] / r[i]));
}

/** Mínimos cuadrados (ponderados si se dan pesos) por ecuaciones normales. */
export function ajustarMCO(X: number[][], y: number[], w?: number[]): number[] {
  const k = X[0].length; const A = Array.from({ length: k }, () => new Array<number>(k).fill(0)); const b = new Array<number>(k).fill(0);
  X.forEach((x, r) => { const wr = w ? w[r] : 1; for (let i = 0; i < k; i++) { b[i] += wr * x[i] * y[r]; for (let j = 0; j < k; j++) A[i][j] += wr * x[i] * x[j]; } });
  return resolver(A, b);
}

const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
export const predecir = (beta: number[], x: number[]) => Math.max(0, dot(beta, x));

/** Mínimas desviaciones absolutas por mínimos cuadrados reponderados (como ajustar_lad). */
export function ajustarLAD(X: number[][], y: number[], iteraciones = 100): number[] {
  let b = ajustarMCO(X, y);
  for (let it = 0; it < iteraciones; it++) b = ajustarMCO(X, y, X.map((x, r) => 1 / Math.max(Math.abs(y[r] - dot(b, x)), 1e-3)));
  return b;
}

/** Regresión robusta sobre la demanda relativa (y/s ~ X/s, s = x2 + 1). Su predicción es X·β, igual que la lineal. */
export function ajustarRelativo(X: number[][], y: number[]): number[] {
  const s = X.map(x => x[2] + 1);
  return ajustarLAD(X.map((x, r) => x.map(v => v / s[r])), y.map((v, r) => v / s[r]));
}

interface Modelos { regresion: number[]; regresion_relativa_robusta: number[] }
function pronostico(m: Metodo, mod: Modelos, x: number[]): number {
  if (m === 'ultima_semana') return x[1];
  if (m === 'promedio_4_semanas') return x[2];
  return predecir(mod[m], x);
}
const ajustar = (X: number[][], y: number[]): Modelos => ({ regresion: ajustarMCO(X, y), regresion_relativa_robusta: ajustarRelativo(X, y) });

export interface Metricas { MAE: number; WAPE: number | null; RMSE: number }
/** Validación con origen móvil: en cada origen de prueba se entrena solo con ventanas cuyo objetivo ya terminó. */
export function evaluar(D: number[][], esMed: number[], prueba: number[], origenMin: number): Record<Metodo, Metricas> {
  const err = Object.fromEntries(METODOS.map(m => [m, [] as number[]])) as Record<Metodo, number[]>; const reales: number[] = [];
  for (const t of prueba) {
    const ent: number[] = []; for (let o = origenMin; o <= t - H; o++) ent.push(o);
    const { X, y } = ventanas(D, ent, esMed); const mod = ajustar(X, y);
    const v = ventanas(D, [t], esMed);
    v.X.forEach((x, r) => { reales.push(v.y[r]); for (const m of METODOS) err[m].push(pronostico(m, mod, x) - v.y[r]); });
  }
  const tot = suma(reales);
  return Object.fromEntries(METODOS.map(m => [m, {
    MAE: suma(err[m].map(Math.abs)) / err[m].length, WAPE: tot ? suma(err[m].map(Math.abs)) / tot : null,
    RMSE: Math.sqrt(suma(err[m].map(e => e * e)) / err[m].length),
  }])) as Record<Metodo, Metricas>;
}

export function reposicion(pred7: number, sigma7: number, stock: number, L = 3, R = 7, z = 1.65): number {
  const objetivo = (pred7 / H) * (L + R) + z * sigma7 * Math.sqrt((L + R) / H);
  return Math.max(0, Math.ceil(objetivo - stock));
}

/** Por lote, en orden FEFO (vencimiento e identificador): unidades consumibles antes de vencer y unidades en riesgo. */
export function riesgoVencimiento(lotes: Lote[], demandaDiaria: number, hoy: string) {
  let consumido = 0;
  return [...lotes].sort((a, b) => (a.vence === b.vence ? (a.id < b.id ? -1 : 1) : a.vence < b.vence ? -1 : 1)).map(l => {
    const capacidad = demandaDiaria * Math.max(0, diasEntre(hoy, l.vence));
    const consumible = Math.floor(Math.min(l.stock, Math.max(0, capacidad - consumido)));
    consumido += consumible;
    return { lote: l, consumible, enRiesgo: l.stock - consumible };
  });
}

export interface Sugerencias {
  inicio: string; fin: string; modeloElegido: Metodo; metricas: Record<Metodo, Metricas>;
  reposicion: { productId: string; nombre: string; pronostico7d: number; sigma7d: number; stock: number; sugerido: number }[];
  riesgo: { productId: string; nombre: string; loteId: string; codigo: string; vence: string; stock: number; consumible: number; enRiesgo: number }[];
}

/** Calcula las sugerencias al día `fin` (último día completo) con las salidas de `inicio` a `fin`. */
export function calcularSugerencias(salidas: Salida[], lotes: Lote[], productos: Producto[], inicio: string, fin: string, ventanaAlerta = 90): Sugerencias {
  const prod = new Map(productos.map(p => [p.id, p]));
  const conLote = new Set(lotes.map(l => l.productId));
  const ids = [...new Set(salidas.filter(s => s.fecha >= inicio && s.fecha <= fin && conLote.has(s.productId) && prod.has(s.productId)).map(s => s.productId))].sort();
  const esMed = ids.map(p => (prod.get(p)!.esMedicamento ? 1 : 0));
  const D = serieDiaria(salidas, ids, inicio, fin); const dias = D[0]?.length ?? 0;
  const oMin = HIST, oMax = dias - H;
  if (ids.length === 0 || oMax - 6 < oMin + H) throw new Error('Historia insuficiente para pronosticar');
  const prueba = Array.from({ length: 7 }, (_, k) => oMax - 6 + k);
  const metricas = evaluar(D, esMed, prueba, oMin);
  const elegido = METODOS.reduce((a, m) => (metricas[m].MAE < metricas[a].MAE ? m : a), METODOS[0]);

  // Modelo final con todos los orígenes; residuos del método elegido para el stock de seguridad de cada producto
  const todos: number[] = []; for (let o = oMin; o <= oMax; o++) todos.push(o);
  const { X, y, p } = ventanas(D, todos, esMed); const mod = ajustar(X, y);
  const sse = new Array<number>(ids.length).fill(0), cnt = new Array<number>(ids.length).fill(0);
  X.forEach((x, r) => { const e = y[r] - pronostico(elegido, mod, x); sse[p[r]] += e * e; cnt[p[r]]++; });
  const pred = new Map<string, number>(), sigma = new Map<string, number>();
  D.forEach((fila, i) => { pred.set(ids[i], pronostico(elegido, mod, variables(fila, dias, esMed[i]))); sigma.set(ids[i], Math.sqrt(sse[i] / cnt[i])); });

  const lotesProd = new Map<string, Lote[]>();
  for (const l of lotes) if (l.stock > 0) lotesProd.set(l.productId, [...(lotesProd.get(l.productId) ?? []), l]);
  const rep: Sugerencias['reposicion'] = []; const rie: Sugerencias['riesgo'] = [];
  // Productos con salidas (aunque hoy no tengan stock) y productos con stock (aunque no tengan salidas)
  for (const pid of new Set([...ids, ...lotesProd.keys()])) {
    const ls = lotesProd.get(pid) ?? [];
    const pr = pred.get(pid) ?? 0, sg = sigma.get(pid) ?? 0, stock = suma(ls.map(l => l.stock));
    const nombre = prod.get(pid)?.nombre ?? '';
    rep.push({ productId: pid, nombre, pronostico7d: pr, sigma7d: sg, stock, sugerido: reposicion(pr, sg, stock) });
    for (const r of riesgoVencimiento(ls, pr / H, fin)) {
      if (diasEntre(fin, r.lote.vence) > ventanaAlerta) continue; // mismo umbral de la alerta de vencimiento del dashboard
      rie.push({ productId: pid, nombre, loteId: r.lote.id, codigo: r.lote.codigo, vence: r.lote.vence, stock: r.lote.stock, consumible: r.consumible, enRiesgo: r.enRiesgo });
    }
  }
  rep.sort((a, b) => b.sugerido - a.sugerido); rie.sort((a, b) => b.enRiesgo - a.enRiesgo);
  return { inicio, fin, modeloElegido: elegido, metricas, reposicion: rep, riesgo: rie };
}
