import { spawnSync } from "node:child_process";
import { build } from "tsdown";
import { decorators } from "./decorators.mjs";
import { reflection } from "./reflection.mjs";

const pkg = "packages/dsh-mcp-manager";
const tsc = (face) => {
  const result = spawnSync(
    process.execPath,
    ["node_modules/typescript/bin/tsc", "-p", `${pkg}/tsconfig.${face}.json`],
    { stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error(`${face} declarations failed`);
};
tsc("host");
await build({
  entry: { index: `${pkg}/src/index.ts`, contracts: `${pkg}/src/contracts.ts` },
  outDir: `${pkg}/lib`,
  platform: "node",
  format: "esm",
  clean: false,
  dts: false,
  sourcemap: false,
  outputOptions: { entryFileNames: "[name].js" },
  deps: { neverBundle: [/^@deepseek-ai\//, "zod"] },
  plugins: [decorators()],
});
await reflection();
tsc("client");
await build({
  entry: { client: `${pkg}/src/client/index.ts` },
  outDir: `${pkg}/lib`,
  platform: "browser",
  format: "cjs",
  clean: false,
  dts: false,
  sourcemap: false,
  deps: {
    neverBundle: ["react", "react/jsx-runtime", "react-dom", "zod", "@deepseek-ai/dsh-client-ui-primitives"],
    alwaysBundle: [/./],
  },
  inputOptions: { platform: "browser" },
  define: { "process.env.NODE_ENV": '"production"' },
  outputOptions: {
    entryFileNames: "[name].js",
    banner: 'window.__ModuleLoader__.load({ id: "@shinku-ever/dsh-mcp-manager", factory: (require) => {',
    intro: "var module = { exports: {} }; var exports = module.exports;",
    footer: "return module.exports; } });",
  },
});
