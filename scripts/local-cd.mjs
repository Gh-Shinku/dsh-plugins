/** Build, verify, and install this checkout's archives into the native Desktop profile. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { resolveProfileDir } from "@deepseek-ai/dsh-app-boot";
import spawn from "cross-spawn";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { values } = parseArgs({
  options: {
    prepare: { type: "boolean", default: false },
    dsh: { type: "string", default: "dsh" },
    registry: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});
if (values.help) {
  console.log(`Usage: pnpm cd:local [--prepare] [--dsh <desktop-bundled CLI>] [--registry <url>]
Fully quit Desktop first. Builds and checks both plugins, then installs local archives into
the existing desktop profile. DSH_HOME is respected. --prepare builds archives without installing.
No git operations, npm publication, app shutdown, or app restart are performed.`);
  process.exit(0);
}

function run(command, args, capture = false) {
  const result = spawn.sync(command, args, {
    cwd: root,
    env: process.env,
    stdio: capture ? "pipe" : "inherit",
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr ?? result.status}`);
  return result.stdout?.trim();
}
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const sha256 = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
const plugins = await Promise.all(
  ["dsh-mcp-manager", "dsh-desktop-notifications"].map(async (directory) => ({
    directory,
    manifest: await json(join(root, "packages", directory, "package.json")),
  })),
);
const profile = resolveProfileDir("desktop");
let before;
if (!values.prepare) {
  before = await json(join(profile, "package.json")).catch((error) => {
    throw new Error(`Open Desktop once to initialize its profile, then fully quit it. ${error.message}`);
  });
  const version = run(values.dsh, ["--version"], true);
  for (const { manifest } of plugins)
    assert.equal(version, manifest.engines.dsh, `Desktop CLI must match ${manifest.name}'s declared dsh version`);
  console.log(`Installing into Desktop profile: ${profile}\nCLI: ${values.dsh} (${version})`);
}

run("pnpm", ["check"]);
run("pnpm", ["pack:check"]);
const delivery = join(root, ".artifacts", "local-cd", new Date().toISOString().replaceAll(/[:.]/g, "-"));
await mkdir(delivery, { recursive: true });
const receipt = { profile, status: "prepared", plugins: [] };
for (const { directory, manifest } of plugins) {
  const filename = `${manifest.name.replace(/^@/, "").replace("/", "-")}-${manifest.version}.tgz`;
  const archive = join(delivery, filename);
  await cp(join(root, ".artifacts", filename), archive, { errorOnExist: true, force: false });
  receipt.plugins.push({
    directory,
    name: manifest.name,
    version: manifest.version,
    archive,
    sha256: await sha256(archive),
  });
}
const receiptPath = join(delivery, "delivery.json");
const save = () => writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
await save();
console.log(`Verified archives and SHA-256 receipt: ${receiptPath}`);
if (values.prepare) process.exit(0);

// The official CLI owns profile locking, compatibility validation, and bundle registration.
// Keep a private recovery snapshot; never restore over the profile automatically after a failed install.
const backup = join(delivery, "profile-backup");
await mkdir(backup, { mode: 0o700 });
for (const name of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "cordis.patch.yml"])
  try {
    await cp(join(profile, name), join(backup, name));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
receipt.backup = backup;
receipt.status = "installing";
await save();
try {
  // Unique archive paths ensure unchanged package versions still receive this build's bytes.
  run(values.dsh, [
    "plugin",
    "--profile",
    "desktop",
    "add",
    "--ignore-scripts",
    "--save-exact",
    ...(values.registry ? [`--registry=${values.registry}`] : []),
    ...receipt.plugins.map((plugin) => plugin.archive),
  ]);
  const after = await json(join(profile, "package.json"));
  for (const plugin of receipt.plugins) {
    const installed = join(profile, "node_modules", plugin.name);
    const manifest = await json(join(installed, "package.json"));
    assert.equal(manifest.version, plugin.version, `Installed version mismatch for ${plugin.name}`);
    assert(after.dsh?.profile?.bundles?.includes(plugin.name), `Bundle not enabled: ${plugin.name}`);
    const packed = join(
      root,
      ".artifacts",
      plugin.directory === "dsh-mcp-manager" ? "packed-smoke" : "packed-notifications",
      "package",
    );
    for (const file of [
      "cordis.patch.yml",
      ...(await readdir(join(packed, "lib"), { recursive: true, withFileTypes: true }))
        .filter((entry) => entry.isFile())
        .map((entry) => join("lib", entry.parentPath.slice(join(packed, "lib").length), entry.name)),
    ]) {
      assert.equal(
        await sha256(join(installed, file)),
        await sha256(join(packed, file)),
        `Installed bytes differ: ${plugin.name}/${file}`,
      );
    }
    plugin.verified = true;
  }
  const names = new Set(receipt.plugins.map((plugin) => plugin.name));
  for (const [name, spec] of Object.entries(before.dependencies ?? {}))
    if (!names.has(name)) assert.equal(after.dependencies?.[name], spec, `Unrelated dependency changed: ${name}`);
  for (const bundle of before.dsh?.profile?.bundles ?? [])
    assert(after.dsh.profile.bundles.includes(bundle), `Existing bundle removed: ${bundle}`);
  receipt.status = "installed";
  await save();
  console.log(
    "Both plugins installed and verified. Reopen Desktop and test MCP selection and background notifications.",
  );
} catch (error) {
  receipt.status = "failed";
  receipt.error = error.message;
  await save();
  console.error(`Installation did not finish verification. Recovery snapshot: ${backup}; receipt: ${receiptPath}`);
  throw error;
}
