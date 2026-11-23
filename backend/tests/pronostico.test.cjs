const assert = require("node:assert/strict");
const test = require("node:test");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => {
  const source = require("node:fs").readFileSync(filename, "utf8");
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename }).outputText, filename);
};
const p = require("../src/utils/pronostico.ts");

test("Reposición: demanda en L + R más seguridad menos stock, y 0 si sobra stock", () => {
  // 2/día × 10 días = 20; seguridad 1.65 × 7 × √(10/7) = 13.80; 20 + 13.80 − 5 = 28.8 → 29
  assert.equal(p.reposicion(14, 7, 5), 29);
  assert.equal(p.reposicion(14, 7, 500), 0);
});

test("Riesgo de vencimiento en orden FEFO, con lote vencido todo en riesgo", () => {
  const L = (id, vence, stock) => ({ id, codigo: id, productId: "x", vence, stock });
  const r = Object.fromEntries(p.riesgoVencimiento([L("B", "2026-12-13", 100), L("A", "2026-11-13", 40), L("V", "2026-10-01", 6)], 1, "2026-10-14")
    .map(x => [x.lote.id, [x.consumible, x.enRiesgo]]));
  assert.deepEqual(r, { V: [0, 6], A: [30, 10], B: [30, 70] });
});

test("Ventanas sin fuga: variables con días anteriores al origen y objetivo con los 7 siguientes", () => {
  const D = [Array.from({ length: 40 }, (_, i) => i)];
  const { X, y } = p.ventanas(D, [28], [1]);
  assert.equal(X[0][1], 21 + 22 + 23 + 24 + 25 + 26 + 27);
  assert.equal(X[0][2], (27 * 28 / 2) / 4);
  assert.equal(y[0], 28 + 29 + 30 + 31 + 32 + 33 + 34);
});

test("MCO recupera coeficientes y LAD ignora picos", () => {
  const X = Array.from({ length: 21 }, (_, i) => [1, i]); const y = X.map(([, i]) => 2 + 3 * i);
  const b = p.ajustarMCO(X, y); assert.ok(Math.abs(b[0] - 2) < 1e-9 && Math.abs(b[1] - 3) < 1e-9);
  const y2 = [...y]; y2[5] += 500; y2[15] += 500;
  const l = p.ajustarLAD(X, y2); assert.ok(Math.abs(l[0] - 2) < 1e-2 && Math.abs(l[1] - 3) < 1e-2);
});

test("La predicción nunca es negativa", () => {
  assert.equal(p.predecir([-5, 1], [1, 0]), 0);
});

test("Sugerencias de punta a punta: elige un método, sugiere reponer al producto sin stock y no al que le sobra", () => {
  const salidas = [];
  for (let d = 0; d < 70; d++) {
    const f = new Date(Date.UTC(2026, 7, 26 + d)).toISOString().slice(0, 10);
    salidas.push({ productId: "A", fecha: f, cantidad: 2 }, { productId: "B", fecha: f, cantidad: 1 });
  }
  const lotes = [{ id: "a1", codigo: "A1", productId: "A", vence: "2027-01-01", stock: 0 },
                 { id: "b1", codigo: "B1", productId: "B", vence: "2026-11-20", stock: 500 }];
  const prods = [{ id: "A", nombre: "A", esMedicamento: true }, { id: "B", nombre: "B", esMedicamento: false }];
  const s = p.calcularSugerencias(salidas, lotes, prods, "2026-08-26", "2026-11-03");
  assert.ok(p.METODOS.includes(s.modeloElegido));
  const a = s.reposicion.find(r => r.productId === "A"), b = s.reposicion.find(r => r.productId === "B");
  assert.ok(a.sugerido >= 20, `A debería reponerse (sugerido ${a.sugerido})`);
  assert.equal(b.sugerido, 0);
  const rb = s.riesgo.find(r => r.loteId === "b1");           // 17 días × 1/día = 17 consumibles de 500
  assert.equal(rb.consumible, 17); assert.equal(rb.enRiesgo, 483);
});
