const assert = require("node:assert/strict");
const test = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = require("node:fs").readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  module._compile(compiled, filename);
};

const { reservarRequerimiento, descontarLote, RequerimientoYaAtendidoError, StockCambiadoError } = require("../src/utils/despacho.ts");

// Base en memoria que aplica updateMany con la misma semántica condicional que PostgreSQL (una fila, sin solapamiento)
function fakeTx(req, lotes) {
  return {
    requerimiento: { updateMany: async ({ where, data }) => {
      if (req.id !== where.id || req.estado !== where.estado) return { count: 0 };
      Object.assign(req, data); return { count: 1 };
    } },
    batch: { updateMany: async ({ where, data }) => {
      const l = lotes[where.id];
      if (!l || l.stockActual < where.stockActual.gte) return { count: 0 };
      l.stockActual -= data.stockActual.decrement; return { count: 1 };
    } },
  };
}

test("R-01: solo el primer despacho reserva el requerimiento; el segundo recibe RequerimientoYaAtendidoError", async () => {
  const req = { id: "r1", estado: "PENDIENTE" };
  const tx = fakeTx(req, {});
  await reservarRequerimiento(tx, "r1", "farmaceutico");
  assert.equal(req.estado, "DESPACHADO");
  assert.equal(req.atendidoPor, "farmaceutico");
  await assert.rejects(reservarRequerimiento(tx, "r1", "otro"), RequerimientoYaAtendidoError);
  assert.equal(req.atendidoPor, "farmaceutico");
});

test("Un requerimiento rechazado no se puede despachar", async () => {
  const tx = fakeTx({ id: "r2", estado: "RECHAZADO" }, {});
  await assert.rejects(reservarRequerimiento(tx, "r2", "x"), RequerimientoYaAtendidoError);
});

test("El descuento del lote nunca deja saldo negativo", async () => {
  const lotes = { L1: { stockActual: 5 } };
  const tx = fakeTx({}, lotes);
  await descontarLote(tx, "L1", 4);
  assert.equal(lotes.L1.stockActual, 1);
  await assert.rejects(descontarLote(tx, "L1", 4), StockCambiadoError);
  assert.equal(lotes.L1.stockActual, 1);
});
