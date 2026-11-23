// Comprueba que src/utils/pronostico.ts reproduce ml/ejecutar.py con la misma exportación.
// Uso (manual, necesita la exportación real; no forma parte de pnpm test): node tests/paridad-pronostico.manual.cjs <carpeta con lotes.csv, movimientos.csv y nombres.csv> <resultados.json de Python> <inicio> <fin>
const fs = require("node:fs"), path = require("node:path"), ts = require("typescript");
require.extensions[".ts"] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, f);
const { calcularSugerencias } = require("../src/utils/pronostico.ts");
const [dir, resPy, inicio, fin] = process.argv.slice(2);
const csv = (f) => { const [h, ...rs] = fs.readFileSync(path.join(dir, f), "utf8").trim().split(/\r?\n/); const k = h.split(","); return rs.map(r => { const v = r.split(","); return Object.fromEntries(k.map((x, i) => [x, v[i]])); }); };
const lot = csv("lotes.csv").filter(l => l.eliminado === "false");
const tipo = new Map(lot.map(l => [l.producto_id, l.tipo]));
const nombres = new Map(csv("nombres.csv").map(r => [r.producto_id, r.nombre]));
const salidas = csv("movimientos.csv").filter(m => m.tipo === "Salida").map(m => ({ productId: m.producto_id, fecha: m.fecha, cantidad: Math.trunc(+m.cantidad) }));
const lotes = lot.map(l => ({ id: l.lote_id, codigo: "", productId: l.producto_id, vence: l.fecha_expiracion, stock: Math.trunc(+l.stock_actual) }));
const productos = [...tipo].map(([id, t]) => ({ id, nombre: nombres.get(id) || "", esMedicamento: t === "MEDICAMENTO" }));
const t0 = Date.now(); const s = calcularSugerencias(salidas, lotes, productos, inicio, fin); const ms = Date.now() - t0;
const py = JSON.parse(fs.readFileSync(resPy, "utf8"));
const ts_ = { elegido: s.modeloElegido, mae: Object.fromEntries(Object.entries(s.metricas).map(([k, v]) => [k, +v.MAE.toFixed(4)])),
  productos_con_sugerencia: s.reposicion.filter(r => r.sugerido > 0).length, unidades: s.reposicion.reduce((a, r) => a + r.sugerido, 0),
  lotes_riesgo: s.riesgo.filter(r => r.enRiesgo > 0).length, unidades_riesgo: s.riesgo.reduce((a, r) => a + r.enRiesgo, 0) };
const pyv = { elegido: py.modelo_elegido, mae: Object.fromEntries(Object.entries(py.metricas_prueba).map(([k, v]) => [k, +v.MAE.toFixed(4)])),
  productos_con_sugerencia: py.reposicion.productos_con_sugerencia, unidades: py.reposicion.unidades_sugeridas,
  lotes_riesgo: py.riesgo.lotes_con_riesgo, unidades_riesgo: py.riesgo.unidades_en_riesgo };
console.log(JSON.stringify({ ms, typescript: ts_, python: pyv }, null, 1));
const caso = s.reposicion.find(r => r.productId === py.caso.producto_id);
console.log("caso", caso && { pron: caso.pronostico7d, sigma: +caso.sigma7d.toFixed(2), sug: caso.sugerido }, "python", { pron: py.caso.pronostico_7d, sigma: +py.caso.sigma_7d.toFixed(2), sug: py.caso.sugerido });
