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

const server = require("../src/utils/permissions.ts");
const { UserRole } = require("../src/middlewares/role.middleware.ts");
const { requirePermission } = require("../src/middlewares/permission.middleware.ts");
const web = require("../../frontend/lib/roles.ts");

const ROLES = ["admin", "farmaceutico", "vendedor", "solicitante", "auditor"];

test("server and frontend permission tables are identical", () => {
  assert.deepEqual(server.ROLE_PERMISSIONS, web.ROLE_PERMISSIONS);
});

test("both sides define the same five lowercase roles", () => {
  assert.deepEqual(Object.values(UserRole), ROLES);
  assert.deepEqual(Object.values(web.UserRole), ROLES);
  assert.deepEqual(Object.keys(server.ROLE_PERMISSIONS), ROLES);
});

test("every role declares the same permission keys as boolean values", () => {
  const keys = Object.keys(server.ROLE_PERMISSIONS.admin).sort();
  assert.equal(keys.length, 14);
  for (const role of ROLES) {
    const perms = server.ROLE_PERMISSIONS[role];
    assert.deepEqual(Object.keys(perms).sort(), keys, role);
    for (const key of keys) assert.equal(typeof perms[key], "boolean", `${role}.${key}`);
  }
});

test("resolveRole reads only app_metadata.role", () => {
  assert.equal(server.resolveRole({ role: "farmaceutico" }), "farmaceutico");
  for (const role of ROLES) assert.equal(server.resolveRole({ role }), role);
});

test("resolveRole grants no role for missing, unknown or malformed values", () => {
  for (const meta of [null, undefined, {}, { role: "" }, { role: "ADMIN" }, { role: "root" }, { role: 1 }, { role: ["admin"] }]) {
    assert.equal(server.resolveRole(meta), null, JSON.stringify(meta));
  }
});

test("roleHasAnyPermission needs at least one of the listed permissions", () => {
  assert.equal(server.roleHasAnyPermission("vendedor", ["canCreateSalidas"]), true);
  assert.equal(server.roleHasAnyPermission("vendedor", ["canCreateIngresos"]), false);
  assert.equal(server.roleHasAnyPermission("vendedor", ["canCreateIngresos", "canCreateSalidas"]), true);
  assert.equal(server.roleHasAnyPermission("admin", []), false);
  for (const role of [null, undefined, "", "ADMIN", "root"]) {
    assert.equal(server.roleHasAnyPermission(role, ["canViewInventory"]), false, String(role));
  }
});

test("role matrix keeps the documented separation of duties", () => {
  const P = server.ROLE_PERMISSIONS;
  for (const role of ROLES) assert.equal(P[role].canManageUsers, role === "admin", role);
  assert.equal(P.vendedor.canCreateIngresos, false);
  assert.equal(P.vendedor.canCreateSalidas, true);
  assert.equal(P.farmaceutico.canApproveRequerimientos, true);
  assert.equal(P.solicitante.canApproveRequerimientos, false);
  const writes = ["canEditInventory", "canCreateProducts", "canDeleteProducts", "canDeleteBatches", "canCreateIngresos", "canCreateSalidas", "canBulkUpload", "canApproveRequerimientos", "canManageUsers"];
  for (const key of writes) assert.equal(P.auditor[key], false, `auditor.${key}`);
  const granted = (role) => Object.keys(P[role]).filter((k) => P[role][k]).sort();
  assert.deepEqual(granted("solicitante"), ["canCreateRequerimientos", "canViewRequerimientos"]);
});

function runMiddleware(user, permissions, enforce) {
  const previous = process.env.RBAC_ENFORCE;
  if (enforce === undefined) delete process.env.RBAC_ENFORCE; else process.env.RBAC_ENFORCE = enforce;
  const warn = console.warn;
  const warnings = [];
  console.warn = (msg) => warnings.push(msg);
  const out = { status: null, body: null, next: false };
  const res = { status(code) { out.status = code; return this; }, json(body) { out.body = body; return this; } };
  try {
    requirePermission(...permissions)({ user, method: "POST", originalUrl: "/api/inventory/ingreso" }, res, () => { out.next = true; });
  } finally {
    console.warn = warn;
    if (previous === undefined) delete process.env.RBAC_ENFORCE; else process.env.RBAC_ENFORCE = previous;
  }
  return { ...out, warnings };
}

test("requirePermission answers 401 when there is no authenticated user", () => {
  const r = runMiddleware(undefined, ["canCreateIngresos"], "true");
  assert.equal(r.status, 401);
  assert.equal(r.next, false);
});

test("requirePermission lets a permitted role through in both modes", () => {
  for (const mode of [undefined, "true"]) {
    const r = runMiddleware({ role: "farmaceutico" }, ["canCreateIngresos"], mode);
    assert.equal(r.next, true, String(mode));
    assert.equal(r.status, null);
    assert.equal(r.warnings.length, 0);
  }
});

test("requirePermission only blocks a denied role when RBAC_ENFORCE=true", () => {
  const logged = runMiddleware({ role: "vendedor" }, ["canCreateIngresos"], undefined);
  assert.equal(logged.next, true);
  assert.equal(logged.warnings.length, 1);
  assert.match(logged.warnings[0], /modo registro/);

  const enforced = runMiddleware({ role: "vendedor" }, ["canCreateIngresos"], "true");
  assert.equal(enforced.next, false);
  assert.equal(enforced.status, 403);

  const otherValue = runMiddleware({ role: "auditor" }, ["canCreateIngresos"], "1");
  assert.equal(otherValue.next, true, "only the exact value 'true' enforces");
});

test("frontend never takes the role from user_metadata", () => {
  assert.equal(web.getUserRole({ app_metadata: { role: "auditor" } }), "auditor");
  assert.equal(web.getUserRole({ user_metadata: { role: "admin" } }), null);
  assert.equal(web.getUserRole({ app_metadata: {}, user_metadata: { role: "admin" } }), null);
  assert.equal(web.hasPermission({ user_metadata: { role: "admin" } }, "canManageUsers"), false);
  assert.ok(Object.values(web.NO_PERMISSIONS).every((v) => v === false));
});
