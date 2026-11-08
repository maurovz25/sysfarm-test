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

const { extractPlan, findDisallowedAccess, SqlGuardError, ALLOWED_TABLES } = require("../src/utils/sql-guard.ts");

// Planes con la forma de EXPLAIN (FORMAT JSON, VERBOSE) de PostgreSQL.
const scan = (relation, schema = "public", output = []) => ({
  "Node Type": "Seq Scan", "Relation Name": relation, "Schema": schema, "Alias": relation, "Output": output,
});
const plan = (root) => [{ Plan: root }];

test("extractPlan accepts the plan already parsed or as JSON text", () => {
  const parsed = plan(scan("Product"));
  assert.deepEqual(extractPlan([{ "QUERY PLAN": parsed }]), parsed);
  assert.deepEqual(extractPlan([{ "QUERY PLAN": JSON.stringify(parsed) }]), parsed);
  assert.equal(extractPlan([]), undefined);
  assert.equal(extractPlan(null), undefined);
});

test("a query over application tables is allowed", () => {
  const root = {
    "Node Type": "Hash Join", "Output": ['"Product".nombre', "sum(\"Batch\".\"stockActual\")"],
    Plans: [scan("Product"), { "Node Type": "Hash", Plans: [scan("Batch")] }],
  };
  assert.deepEqual(findDisallowedAccess(plan(root)), []);
});

test("every whitelisted table is accepted", () => {
  assert.equal(ALLOWED_TABLES.length, 11);
  for (const t of ALLOWED_TABLES) assert.deepEqual(findDisallowedAccess(plan(scan(t))), [], t);
});

test("the whitelist matches the models of the Prisma schema", () => {
  const schema = require("node:fs").readFileSync(require("node:path").join(__dirname, "../prisma/schema.prisma"), "utf8");
  const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]).sort();
  assert.deepEqual([...ALLOWED_TABLES].sort(), models);
});

test("tables outside the public schema are rejected", () => {
  assert.deepEqual(findDisallowedAccess(plan(scan("users", "auth"))), ["auth.users"]);
  assert.deepEqual(findDisallowedAccess(plan(scan("pg_authid", "pg_catalog"))), ["pg_catalog.pg_authid"]);
});

test("public tables that are not on the whitelist are rejected", () => {
  assert.deepEqual(findDisallowedAccess(plan(scan("_prisma_migrations"))), ["public._prisma_migrations"]);
});

test("a relation without schema information is treated as not allowed", () => {
  const node = { "Node Type": "Seq Scan", "Relation Name": "Product" };
  assert.deepEqual(findDisallowedAccess(plan(node)), ["?.Product"]);
});

test("access hidden inside CTEs and subplans is found", () => {
  const root = {
    "Node Type": "Nested Loop",
    Plans: [
      scan("Product"),
      { "Node Type": "CTE Scan", "Subplan Name": "CTE x", Plans: [{ "Node Type": "Subquery Scan", Plans: [scan("users", "auth")] }] },
    ],
  };
  assert.deepEqual(findDisallowedAccess(plan(root)), ["auth.users"]);
});

test("only harmless set-returning functions may be scanned", () => {
  const fs = (name) => ({ "Node Type": "Function Scan", "Function Name": name, "Schema": "pg_catalog" });
  assert.deepEqual(findDisallowedAccess(plan(fs("generate_series"))), []);
  assert.deepEqual(findDisallowedAccess(plan(fs("pg_ls_dir"))), ["función pg_ls_dir()"]);
});

test("dangerous function calls are detected in any expression, whatever the case", () => {
  for (const [expr, fn] of [
    ["pg_sleep('5'::double precision)", "pg_sleep"],
    ["PG_READ_FILE('/etc/passwd'::text)", "pg_read_file"],
    ["set_config('role'::text, 'postgres'::text, false)", "set_config"],
    ["query_to_xml('select 1'::text, true, true, ''::text)", "query_to_xml"],
    ["nextval ('seq'::regclass)", "nextval"],
  ]) {
    assert.deepEqual(findDisallowedAccess(plan(scan("Product", "public", [expr]))), [`función ${fn}()`], expr);
  }
});

test("function names that only contain a dangerous name as a substring are not flagged", () => {
  assert.deepEqual(findDisallowedAccess(plan(scan("Product", "public", ["my_pg_sleep_count(1)", '"Product".nombre']))), []);
});

test("each violation is reported once and SqlGuardError lists them", () => {
  const root = { "Node Type": "Append", Plans: [scan("users", "auth"), scan("users", "auth"), scan("Product")] };
  const violations = findDisallowedAccess(plan(root));
  assert.deepEqual(violations, ["auth.users"]);
  const err = new SqlGuardError(violations);
  assert.equal(err.name, "SqlGuardError");
  assert.ok(err instanceof Error);
  assert.match(err.message, /auth\.users/);
});
