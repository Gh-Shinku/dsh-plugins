import { spawnSync } from "node:child_process";
import { build } from "tsdown";
import { decorators } from "./decorators.mjs";
import { reflection } from "./reflection.mjs";

const pkg = "packages/dsh-mcp-manager";
const tsc = (face, directory = pkg) => {
  const result = spawnSync(
    process.execPath,
    ["node_modules/typescript/bin/tsc", "-p", `${directory}/tsconfig.${face}.json`],
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

const notifications = "packages/dsh-desktop-notifications";
tsc("host", notifications);
tsc("client", notifications);
await build({
  entry: { index: `${notifications}/src/index.ts` },
  outDir: `${notifications}/lib`,
  platform: "node",
  format: "esm",
  clean: false,
  dts: false,
  sourcemap: false,
  deps: { neverBundle: [/^@deepseek-ai\//] },
  outputOptions: { entryFileNames: "[name].js" },
});
await build({
  entry: { client: `${notifications}/src/client/index.ts` },
  inputOptions: { platform: "browser" },
  outDir: `${notifications}/lib`,
  platform: "browser",
  format: "cjs",
  clean: false,
  dts: false,
  sourcemap: false,
  deps: { neverBundle: ["react", "react/jsx-runtime", "@deepseek-ai/dsh-client-ui-primitives"], alwaysBundle: [/./] },
  define: { "process.env.NODE_ENV": '"production"' },
  outputOptions: {
    entryFileNames: "[name].js",
    banner: 'window.__ModuleLoader__.load({ id: "@shinku-ever/dsh-desktop-notifications", factory: (require) => {',
    intro: "var module = { exports: {} }; var exports = module.exports;",
    footer: "return module.exports; } });",
  },
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
