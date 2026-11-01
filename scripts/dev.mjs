import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import spawn from "cross-spawn";

await mkdir(".artifacts", { recursive: true });
const patch = resolve(".artifacts/dev.cordis.yml");
const env = { ...process.env, DSH_HOME: resolve(".artifacts/dsh-home") };
let installed = false;
try {
  installed =
    JSON.parse(await readFile(`${env.DSH_HOME}/profiles/web/package.json`, "utf8")).dependencies?.[
      "@shinku-ever/dsh-mcp-manager"
    ] !== undefined;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (!installed) {
  const result = spawn.sync(
    "dsh",
    ["plugin", "--profile", "web", "add", "--ignore-scripts", resolve("packages/dsh-mcp-manager")],
    { env, stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error("Could not install the development package into the isolated profile");
}
const args = process.argv.slice(2);
let content = "[]\n";
if (args.includes("--fixtures")) {
  content = "- insert:\n";
  for (const server of ["alpha", "beta"])
    content += `    - id: fixture-${server}\n      name: '@deepseek-ai/dsh-mcp-client'\n      config:\n        serverName: ${server}\n        transport: stdio\n        command: ${JSON.stringify(process.execPath)}\n        args: ${JSON.stringify([resolve("packages/dsh-mcp-manager/test/fixtures/server.mjs"), server])}\n`;
}
await writeFile(patch, content);
const child = spawn("dsh", ["web", "--patch", patch, "--no-open", ...args.filter((a) => a !== "--fixtures")], {
  stdio: "inherit",
  env,
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
