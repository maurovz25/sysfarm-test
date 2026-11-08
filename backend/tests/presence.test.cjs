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

const presence = require("../src/utils/presence.ts");
const T0 = 1_800_000_000_000;
const HOUR = 60 * 60 * 1000;
// El estado del módulo es compartido: cada prueba usa sus propios identificadores.

test("the online window is 2.5 minutes", () => {
  assert.equal(presence.ONLINE_WINDOW_MS, 150_000);
});

test("an unknown user is offline and has no last-seen time", () => {
  assert.equal(presence.isOnline("p-unknown", T0), false);
  assert.equal(presence.getLastSeen("p-unknown"), null);
});

test("a touched user is online up to the window limit, inclusive", () => {
  presence.touch("p-window", T0);
  assert.equal(presence.isOnline("p-window", T0), true);
  assert.equal(presence.isOnline("p-window", T0 + presence.ONLINE_WINDOW_MS), true);
  assert.equal(presence.isOnline("p-window", T0 + presence.ONLINE_WINDOW_MS + 1), false);
});

test("touch keeps the most recent activity time", () => {
  presence.touch("p-update", T0);
  presence.touch("p-update", T0 + 90_000);
  assert.equal(presence.getLastSeen("p-update"), T0 + 90_000);
  assert.equal(presence.isOnline("p-update", T0 + 90_000 + presence.ONLINE_WINDOW_MS), true);
});

test("clear marks the user offline immediately (logout)", () => {
  presence.touch("p-logout", T0);
  presence.clear("p-logout");
  assert.equal(presence.isOnline("p-logout", T0), false);
  assert.equal(presence.getLastSeen("p-logout"), null);
});

test("pruneStale drops entries older than one hour and keeps the rest", () => {
  presence.touch("p-old", T0);
  presence.touch("p-edge", T0 + 1);
  presence.touch("p-new", T0 + HOUR);
  const removed = presence.pruneStale(T0 + HOUR + 1);
  assert.ok(removed >= 1);
  assert.equal(presence.getLastSeen("p-old"), null);
  assert.equal(presence.getLastSeen("p-edge"), T0 + 1, "exactly one hour old is kept");
  assert.equal(presence.getLastSeen("p-new"), T0 + HOUR);
});

test("users are tracked independently", () => {
  presence.touch("p-a", T0);
  presence.touch("p-b", T0 - presence.ONLINE_WINDOW_MS - 1);
  assert.equal(presence.isOnline("p-a", T0), true);
  assert.equal(presence.isOnline("p-b", T0), false);
});
