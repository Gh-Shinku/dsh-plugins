import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import spawn from "cross-spawn";

const artifacts = resolve(".artifacts");
await mkdir(artifacts, { recursive: true });
const run = (command, args, cwd = process.cwd()) => {
  const result = spawn.sync(command, args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
};
const sourceManifest = JSON.parse(await readFile("packages/dsh-mcp-manager/package.json", "utf8"));
run("pnpm", ["--filter", sourceManifest.name, "pack", "--pack-destination", artifacts]);
const archive = resolve(
  artifacts,
  `${sourceManifest.name.replace(/^@/, "").replace("/", "-")}-${sourceManifest.version}.tgz`,
);
const files = run("tar", ["-tzf", archive]).trim().split(/\r?\n/);
for (const required of [
  "lib/index.js",
  "lib/client.js",
  "lib/typert.host.js",
  "lib/typert.remote-client.js",
  "lib/types/index.d.ts",
  "cordis.patch.yml",
  "LICENSE",
  "README.md",
])
  assert(files.includes(`package/${required}`), `Missing ${required}`);
assert(!files.some((f) => f.startsWith("package/src/") || f.startsWith("package/test/")));
const directory = resolve(artifacts, "packed-smoke");
assert.equal(relative(artifacts, directory), "packed-smoke");
await rm(directory, { recursive: true, force: true });
await mkdir(directory, { recursive: true });
run("tar", ["-xzf", archive, "-C", directory]);
const packageRoot = resolve(directory, "package");
const manifest = JSON.parse(await readFile(`${packageRoot}/package.json`, "utf8"));
assert.equal(manifest.dsh.bundle.patch, "./cordis.patch.yml");
assert.equal(manifest.engines.dsh, "0.2.1-rc.5");
for (const file of ["index.js", "typert.host.js", "typert.remote-client.js"]) {
  run(process.execPath, ["--check", `${packageRoot}/lib/${file}`]);
  const source = await readFile(`${packageRoot}/lib/${file}`, "utf8");
  for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
    const specifier = match[1];
    if (specifier.startsWith(".") || specifier.startsWith("node:")) continue;
    const name = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
    assert(manifest.dependencies?.[name] || manifest.peerDependencies?.[name], `Undeclared runtime dependency ${name}`);
  }
}
const host = await import(pathToFileURL(`${packageRoot}/lib/index.js`).href);
assert.equal(typeof host.default, "function");
const reflection = await import(pathToFileURL(`${packageRoot}/lib/typert.host.js`).href);
assert.equal(reflection.TYPERT.invocations.length, 6);
const remote = await import(pathToFileURL(`${packageRoot}/lib/typert.remote-client.js`).href);
assert.equal(Object.keys(remote.default.methods).length, 6);
const require = createRequire(import.meta.url);
let browserExports;
const platformRequests = new Set();
runInNewContext(await readFile(`${packageRoot}/lib/client.js`, "utf8"), {
  window: {
    __ModuleLoader__: {
      load({ id, factory }) {
        assert.equal(id, "@shinku-ever/dsh-mcp-manager");
        browserExports = factory((specifier) => {
          platformRequests.add(specifier);
          // Node has no CSS module loader. Component rendering is tested with the
          // real primitives under Vitest; this smoke checks the browser factory's external edges.
          return specifier === "@deepseek-ai/dsh-client-ui-primitives" ? {} : require(specifier);
        });
      },
    },
  },
  console,
  setTimeout,
  clearTimeout,
});
assert.equal(typeof browserExports.apply, "function");
assert(platformRequests.has("@deepseek-ai/dsh-client-ui-primitives"));
assert(manifest.dsh.client.inject.includes("@deepseek-ai/dsh-client-ui-commands"));
assert.equal(manifest.peerDependencies["@deepseek-ai/dsh-client-ui-commands"], "0.2.1-rc.5");
assert(browserExports.inject.includes("commandUi"));
const browserSource = await readFile(`${packageRoot}/lib/client.js`, "utf8");
const primitiveBinding = browserSource.match(
  /(?:const|let|var)\s+(\w+)\s*=\s*require\("@deepseek-ai\/dsh-client-ui-primitives"\)/,
)?.[1];
assert(primitiveBinding, "Native primitives must resolve through the browser module table");
for (const component of ["Modal", "Menu", "Button", "Input", "Checkbox"])
  assert(browserSource.includes(`${primitiveBinding}.${component}`), `Missing native ${component} usage`);
assert(browserSource.includes('name: "conversation.input.left"'), "Session status indicator must be registered");
assert(!browserSource.includes("shinku-mcp-popover"), "Custom popup must not be bundled");
assert(!browserSource.includes("window.confirm("), "Browser confirmation must not be bundled");
console.log(`Verified ${files.length} packed files, native Host imports, six Remote codecs, and the browser factory.`);

// Independently installable desktop plugin: exercise the actual archive and shell module factory.
const notificationManifest = JSON.parse(await readFile("packages/dsh-desktop-notifications/package.json", "utf8"));
run("pnpm", ["--filter", notificationManifest.name, "pack", "--pack-destination", artifacts]);
const notificationArchive = resolve(
  artifacts,
  `${notificationManifest.name.replace(/^@/, "").replace("/", "-")}-${notificationManifest.version}.tgz`,
);
const notificationFiles = run("tar", ["-tzf", notificationArchive]).trim().split(/\r?\n/);
for (const required of [
  "lib/index.js",
  "lib/client.js",
  "lib/types/index.d.ts",
  "lib/types/client/index.d.ts",
  "cordis.patch.yml",
  "README.md",
  "LICENSE",
])
  assert(notificationFiles.includes(`package/${required}`), `Desktop notifications missing ${required}`);
assert(!notificationFiles.some((file) => /^package\/(src|test)\//.test(file)));
const notificationDirectory = resolve(artifacts, "packed-notifications");
assert.equal(relative(artifacts, notificationDirectory), "packed-notifications");
await rm(notificationDirectory, { recursive: true, force: true });
await mkdir(notificationDirectory, { recursive: true });
run("tar", ["-xzf", notificationArchive, "-C", notificationDirectory]);
const notificationRoot = resolve(notificationDirectory, "package");
const packedNotifications = JSON.parse(await readFile(`${notificationRoot}/package.json`, "utf8"));
assert.equal(packedNotifications.engines.dsh, "0.2.1-rc.5");
assert.equal(packedNotifications.dsh.bundle.patch, "./cordis.patch.yml");
const notificationHost = await import(pathToFileURL(`${notificationRoot}/lib/index.js`).href);
assert.equal(typeof notificationHost.apply, "function");
assert.equal(notificationHost.Config, undefined, "Desktop notifications must not expose a settings schema");
assert(!notificationFiles.some((file) => file.includes("settings")), "Stale notification settings in package");
for (const peer of Object.keys(packedNotifications.peerDependencies).filter((name) =>
  name.startsWith("@deepseek-ai/"),
)) {
  const peerManifest = require(`${peer}/package.json`);
  if (peer !== "@deepseek-ai/cordis") assert.equal(peerManifest.version, packedNotifications.engines.dsh);
}
const notificationSource = await readFile(`${notificationRoot}/lib/client.js`, "utf8");
assert(
  !/require\(["'](?:node:|electron|@deepseek-ai\/dsh-settings["'])/.test(notificationSource),
  "Host import in desktop client",
);
let notificationClient;
runInNewContext(notificationSource, {
  window: {
    __ModuleLoader__: {
      load({ id, factory }) {
        assert.equal(id, packedNotifications.name);
        notificationClient = factory((specifier) => {
          throw new Error(`Unexpected desktop browser external ${specifier}`);
        });
      },
    },
  },
});
assert.equal(typeof notificationClient.apply, "function");
// Browser profiles must be a complete no-op, with no service access or permission request.
notificationClient.apply(
  new Proxy(
    {},
    {
      get() {
        throw new Error("Web profile accessed a desktop service");
      },
    },
  ),
);
console.log(
  `Verified ${notificationFiles.length} desktop notification files, declared Harness peers, settings-free startup, and browser isolation.`,
);
