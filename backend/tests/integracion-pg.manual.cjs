// Prueba de integración contra la base de PRUEBAS (Supabase de pruebas), nunca contra producción.
// Comprueba con PostgreSQL real: (1) R-01, dos despachos simultáneos del mismo requerimiento; (2) la guarda de saldo
// con dos descuentos simultáneos del mismo lote; (3) GET /api/sugerencias con 70 días de salidas sintéticas;
// (4) la propuesta de conciliación del kárdex (04_experimento/indicadores/conciliacion_propuesta.sql).
// Uso: node tests/integracion-pg.manual.cjs <archivo env con DATABASE_URL y DIRECT_URL de pruebas> <conciliacion_propuesta.sql> <ref del proyecto de pruebas>
// Guarda: se detiene si la conexión no es al proyecto de Supabase de pruebas indicado (producción es autoalojada).
// Solo escribe filas SMOKE INT, que borra al terminar; la comprobación de la conciliación se revierte (rollback).
const fs = require("node:fs"), assert = require("node:assert/strict"), ts = require("typescript");
require.extensions[".ts"] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, f);
const [envFile, sqlFile, refPruebas] = process.argv.slice(2);
for (const l of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*(DATABASE_URL|DIRECT_URL)\s*=\s*"?([^"]+)"?\s*$/); if (m) process.env[m[1]] = m[2];
}
// Se usa la conexión de sesión (DIRECT_URL): las transacciones interactivas concurrentes no dependen del pooler de transacciones
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
assert.ok(process.env.DATABASE_URL, "falta DATABASE_URL");
if (!refPruebas || !new URL(process.env.DATABASE_URL).username.endsWith("." + refPruebas) || !new URL(process.env.DATABASE_URL).hostname.endsWith(".pooler.supabase.com")) {
  console.error("GUARDA: la conexión no es al proyecto de Supabase de pruebas indicado. No se hizo nada."); process.exit(2);
}
const prisma = require("../src/prisma.ts").default;
const { reservarRequerimiento, descontarLote, RequerimientoYaAtendidoError, StockCambiadoError } = require("../src/utils/despacho.ts");
const { getSugerencias } = require("../src/controllers/sugerencias.controller.ts");

const ID = (n) => `5a0e1111-0000-4000-8000-${String(n).padStart(12, "0")}`;
const P = { A: ID(1), B: ID(2), C: ID(3) }, L = { a1: ID(11), b1: ID(12), c1: ID(13), c2: ID(14), c3: ID(15) }, REQ = ID(21);
const DIA = 86400000, hoyLima = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const fechaLima = (offset) => new Date(Date.parse(hoyLima) + offset * DIA + 15 * 3600000); // 10:00 en Lima
const resultados = {};

async function limpiar() {
  const prods = Object.values(P), lotes = Object.values(L);
  await prisma.movement.deleteMany({ where: { productId: { in: prods } } });
  await prisma.requerimiento.deleteMany({ where: { id: REQ } });
  await prisma.batch.deleteMany({ where: { id: { in: lotes } } });
  await prisma.product.deleteMany({ where: { id: { in: prods } } });
}

(async () => {
  await limpiar();
  try {
    await prisma.product.createMany({ data: [
      { id: P.A, nombre: "SMOKE INT Producto A", tipo: "MEDICAMENTO" },
      { id: P.B, nombre: "SMOKE INT Producto B", tipo: "DISPOSITIVO_MEDICO" },
      { id: P.C, nombre: "SMOKE INT Producto C", tipo: "MEDICAMENTO" }] });

    // (1) R-01 con dos transacciones simultáneas
    await prisma.batch.create({ data: { id: L.a1, codigo: "SMK-INT-A1", productId: P.A, fechaExpiracion: fechaLima(400), stockActual: 5 } });
    await prisma.requerimiento.create({ data: { id: REQ, codigo: "SMK-INT-REQ", solicitante: "SMOKE", departamento: "SMOKE" } });
    const r1 = await Promise.allSettled([1, 2].map(i => prisma.$transaction(tx => reservarRequerimiento(tx, REQ, `despacho ${i}`))));
    const ok1 = r1.filter(r => r.status === "fulfilled").length, rech1 = r1.filter(r => r.status === "rejected" && r.reason instanceof RequerimientoYaAtendidoError).length;
    const req = await prisma.requerimiento.findUnique({ where: { id: REQ } });
    assert.equal(ok1, 1); assert.equal(rech1, 1); assert.equal(req.estado, "DESPACHADO");
    resultados.R01 = { exitosos: ok1, rechazados_409: rech1, estado_final: req.estado };

    // (2) Guarda de saldo: dos descuentos simultáneos de 4 sobre un lote de 5
    const r2 = await Promise.allSettled([1, 2].map(() => prisma.$transaction(tx => descontarLote(tx, L.a1, 4))));
    const lote = await prisma.batch.findUnique({ where: { id: L.a1 } });
    assert.equal(r2.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(r2.filter(r => r.status === "rejected" && r.reason instanceof StockCambiadoError).length, 1);
    assert.equal(lote.stockActual, 1);
    resultados.guarda_saldo = { exitosos: 1, rechazados: 1, saldo_final: lote.stockActual };
    await prisma.batch.update({ where: { id: L.a1 }, data: { stockActual: 0 } });

    // (3) Sugerencias con 70 días de salidas hasta ayer (A: 2 por día, sin stock; B: 1 por día, 500 en un lote que vence en 17 días)
    await prisma.batch.create({ data: { id: L.b1, codigo: "SMK-INT-B1", productId: P.B, fechaExpiracion: new Date(Date.parse(hoyLima) + 16 * DIA + 12 * 3600000), stockActual: 500 } });
    const sal = [];
    for (let k = 1; k <= 70; k++) sal.push({ tipo: "Salida", cantidad: 2, productId: P.A, batchId: L.a1, fecha: fechaLima(-k) }, { tipo: "Salida", cantidad: 1, productId: P.B, batchId: L.b1, fecha: fechaLima(-k) });
    await prisma.movement.createMany({ data: sal });
    const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { this.body = d; } };
    const t0 = Date.now(); await getSugerencias({}, res); const ms = Date.now() - t0;
    assert.equal(res.code, 200, JSON.stringify(res.body));
    const a = res.body.reposicion.find(r => r.productId === P.A), b = res.body.reposicion.find(r => r.productId === P.B);
    const rb = res.body.riesgo.find(r => r.loteId === L.b1);
    assert.ok(a.sugerido >= 20, `A: ${a.sugerido}`); assert.equal(b.sugerido, 0); assert.ok(rb.enRiesgo > 0);
    resultados.sugerencias = { http: res.code, ms, metodo: res.body.modeloElegido, ventana: [res.body.inicio, res.body.fin],
      sugerido_A: a.sugerido, sugerido_B: b.sugerido, lote_B: { saldo: rb.stock, consumible: rb.consumible, en_riesgo: rb.enRiesgo } };

    // (4) Conciliación: C1 sin movimientos (saldo 10), C2 ingreso de 5 con saldo 8, C3 ingreso 5 y salida 2 con saldo 3
    await prisma.batch.createMany({ data: [
      { id: L.c1, codigo: "SMK-INT-C1", productId: P.C, fechaExpiracion: fechaLima(500), stockActual: 10, createdAt: fechaLima(-90) },
      { id: L.c2, codigo: "SMK-INT-C2", productId: P.C, fechaExpiracion: fechaLima(500), stockActual: 8, createdAt: fechaLima(-90) },
      { id: L.c3, codigo: "SMK-INT-C3", productId: P.C, fechaExpiracion: fechaLima(500), stockActual: 3, createdAt: fechaLima(-90) }] });
    await prisma.movement.createMany({ data: [
      { tipo: "Ingreso", cantidad: 5, productId: P.C, batchId: L.c2, fecha: fechaLima(-30) },
      { tipo: "Ingreso", cantidad: 5, productId: P.C, batchId: L.c3, fecha: fechaLima(-30) },
      { tipo: "Salida", cantidad: 2, productId: P.C, batchId: L.c3, fecha: fechaLima(-20) }] });
    const sql = fs.readFileSync(sqlFile, "utf8");
    const insert = sql.slice(sql.indexOf("-- Paso 2")).match(/with neto as[\s\S]*?from neto where "stockActual" > neto;/)[0];
    const ROLLBACK = new Error("rollback intencional");
    try {
      await prisma.$transaction(async (tx) => {
        const insertados = await tx.$executeRawUnsafe(insert);
        const neto = async (id) => (await tx.movement.findMany({ where: { batchId: id } })).reduce((s, m) => s + (m.tipo === "Salida" ? -m.cantidad : m.cantidad), 0);
        const aj = await tx.movement.findMany({ where: { productId: P.C, tipo: "Ajuste" } });
        assert.deepEqual(Object.fromEntries(aj.map(m => [m.batchId, m.cantidad])), { [L.c1]: 10, [L.c2]: 3 });
        for (const id of [L.c1, L.c2, L.c3]) assert.equal(await neto(id), (await tx.batch.findUnique({ where: { id } })).stockActual);
        assert.equal((await tx.movement.findFirst({ where: { batchId: L.c2 }, orderBy: { fecha: "asc" } })).tipo, "Ajuste");
        resultados.conciliacion_filas_en_toda_la_base = insertados;
        throw ROLLBACK;
      }, { timeout: 60000 });
    } catch (e) { if (e !== ROLLBACK) throw e; }
    assert.equal(await prisma.movement.count({ where: { productId: P.C, tipo: "Ajuste" } }), 0);
    resultados.conciliacion = { ajustes_C: { C1: 10, C2: 3, C3: 0 }, kardex_igual_a_saldo: true, ajuste_antes_del_primer_movimiento: true, revertida: true };
    console.log(JSON.stringify({ fecha: new Date().toISOString(), base: "pruebas", resultados }, null, 1));
  } finally {
    await limpiar(); await prisma.$disconnect();
  }
})().catch(e => { console.error("FALLÓ:", e.message); process.exit(1); });
