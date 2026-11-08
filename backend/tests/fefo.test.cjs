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

const { planFefoAllocation, InsufficientFefoStockError } = require("../src/utils/fefo.ts");
const batch = (id, expiry, stock, deletedAt = null) => ({
  id, fechaExpiracion: expiry, stockActual: stock, deletedAt,
});

test("FEFO orders by earliest expiry and uses id as a stable tie-breaker", () => {
  const lots = [
    batch("b", "2027-04-01", 5),
    batch("z", "2027-03-01", 5),
    batch("a", "2027-03-01", 5),
  ];
  assert.deepEqual(planFefoAllocation(lots, 4).map(x => [x.batch.id, x.quantity]), [["a", 4]]);
});

test("FEFO splits a request over lots in expiry order", () => {
  const lots = [batch("later", "2027-06-01", 8), batch("first", "2027-02-01", 3)];
  assert.deepEqual(planFefoAllocation(lots, 6).map(x => [x.batch.id, x.quantity]), [["first", 3], ["later", 3]]);
});

test("soft-deleted and zero-stock lots are excluded", () => {
  const lots = [
    batch("deleted", "2027-01-01", 10, new Date("2026-01-01")),
    batch("empty", "2027-02-01", 0),
    batch("active", "2027-03-01", 2),
  ];
  assert.deepEqual(planFefoAllocation(lots, 2).map(x => x.batch.id), ["active"]);
});

test("insufficient stock is rejected before an allocation is returned", () => {
  assert.throws(() => planFefoAllocation([batch("one", "2027-01-01", 2)], 3), error => {
    assert.ok(error instanceof InsufficientFefoStockError);
    assert.equal(error.required, 3);
    assert.equal(error.available, 2);
    return true;
  });
});

test("zero quantity returns no allocations", () => {
  assert.deepEqual(planFefoAllocation([batch("one", "2027-01-01", 2)], 0), []);
});

test("expired positive-stock lots remain eligible, matching the current system policy", () => {
  const expired = batch("expired", "2020-01-01", 1);
  assert.deepEqual(planFefoAllocation([expired], 1).map(x => x.batch.id), ["expired"]);
});
