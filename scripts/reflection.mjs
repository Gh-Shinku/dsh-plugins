/** The released analyzer recognizes Remote symbols only in registered source packages.
 * Analyze an isolated mirror containing the published protocol declarations; never edit dependencies.
 */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { WorkspaceTypertGenerator, writeWorkspaceArtifacts } from "@deepseek-ai/dsh-typert-generator";
import ts from "typescript";

export async function reflection() {
  const root = resolve(".artifacts/reflection");
  const pkg = "packages/dsh-mcp-manager";
  if (!root.endsWith(".artifacts/reflection") && !root.endsWith(".artifacts\\reflection"))
    throw new Error("Unexpected mirror path");
  await rm(root, { recursive: true, force: true });
  await mkdir(`${root}/${pkg}`, { recursive: true });
  await mkdir(`${root}/${pkg}/src`, { recursive: true });
  await cp(`${pkg}/src/contracts.ts`, `${root}/${pkg}/src/contracts.ts`);
  // Project exactly the authored decorated signatures into an implementation-free
  // service. Body imports otherwise pull unrelated framework declaration merges
  // into the pre-release analyzer's source-only graph.
  const source = ts.createSourceFile(
    "manager.ts",
    await readFile(`${pkg}/src/manager.ts`, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const service = source.statements.find((s) => ts.isClassDeclaration(s) && s.name?.text === "McpManager");
  if (!service) throw new Error("McpManager declaration missing");
  const methods = service.members
    .filter((m) => ts.isMethodDeclaration(m) && (ts.getDecorators(m) ?? []).length > 0)
    .map((m) => `${source.text.slice(m.getFullStart(), m.body.pos)} { throw new Error('reflection only'); }`)
    .join("\n");
  await writeFile(
    `${root}/${pkg}/src/index.ts`,
    `import { Service, type Context } from '@deepseek-ai/cordis';\nimport { Remote, bindTypertRemote } from '@deepseek-ai/dsh-typert-protocol';\nimport type { McpServerView, ProfileDocument, ProfileSnapshot, SelectionView, SessionSelection } from './contracts.ts';\nexport type * from './contracts.ts';\ntype SessionId = string;\nexport class McpManager extends Service { readonly typertRemote = bindTypertRemote(this, 'shinkuMcpManager'); constructor(ctx:Context) { super(ctx,'shinkuMcpManager'); }\n${methods}\n}\ndeclare module '@deepseek-ai/cordis' { interface Context { shinkuMcpManager: McpManager; } }\n`,
  );
  for (const name of ["package.json", "tsconfig.host.json"]) await cp(`${pkg}/${name}`, `${root}/${pkg}/${name}`);
  const notificationPackage = "packages/dsh-desktop-notifications";
  await mkdir(`${root}/${notificationPackage}/src`, { recursive: true });
  const notificationSource = ts.createSourceFile(
    "index.ts",
    await readFile(`${notificationPackage}/src/index.ts`, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const notificationService = notificationSource.statements.find(
    (s) => ts.isClassDeclaration(s) && s.name?.text === "DesktopNotifications",
  );
  if (!notificationService) throw new Error("DesktopNotifications declaration missing");
  const notificationMethods = notificationService.members
    .filter((m) => ts.isMethodDeclaration(m) && (ts.getDecorators(m) ?? []).length > 0)
    .map(
      (m) => `${notificationSource.text.slice(m.getFullStart(), m.body.pos)} { throw new Error('reflection only'); }`,
    )
    .join("\n");
  await writeFile(
    `${root}/${notificationPackage}/src/index.ts`,
    `import { Service, type Context } from '@deepseek-ai/cordis';
import { Remote, bindTypertRemote } from '@deepseek-ai/dsh-typert-protocol';
export class DesktopNotifications extends Service { readonly typertRemote = bindTypertRemote(this, 'shinkuDesktopNotifications'); constructor(ctx: Context) { super(ctx, 'shinkuDesktopNotifications'); }
${notificationMethods}
}
declare module '@deepseek-ai/cordis' { interface Context { shinkuDesktopNotifications: DesktopNotifications; } }
`,
  );
  for (const name of ["package.json", "tsconfig.host.json"])
    await cp(`${notificationPackage}/${name}`, `${root}/${notificationPackage}/${name}`);
  const base = JSON.parse(await readFile("tsconfig.json", "utf8"));
  base.compilerOptions.paths = { "@deepseek-ai/dsh-typert-protocol": ["./packages/protocol/index.d.ts"] };
  await writeFile(`${root}/tsconfig.json`, JSON.stringify(base));
  await cp("node_modules/@deepseek-ai/dsh-typert-protocol/lib/types", `${root}/packages/protocol`, { recursive: true });
  await writeFile(
    `${root}/packages/protocol/package.json`,
    JSON.stringify({ name: "@deepseek-ai/dsh-typert-protocol", type: "module", exports: { ".": "./index.d.ts" } }),
  );
  await writeFile(
    `${root}/packages/protocol/tsconfig.json`,
    JSON.stringify({ extends: "../../tsconfig.json", include: ["**/*.d.ts"] }),
  );
  await writeFile(
    `${root}/tsconfig.host.json`,
    JSON.stringify({
      extends: "./tsconfig.json",
      files: [],
      references: [
        { path: `${pkg}/tsconfig.host.json` },
        { path: `${notificationPackage}/tsconfig.host.json` },
        { path: "packages/protocol" },
      ],
    }),
  );
  const artifacts = new WorkspaceTypertGenerator(root).generate(
    ["@shinku-ever/dsh-mcp-manager", "@shinku-ever/dsh-desktop-notifications"],
    ["host"],
  );
  await writeWorkspaceArtifacts(root, artifacts);
  await cp(`${root}/${pkg}/lib`, `${pkg}/lib`, { recursive: true });
  await cp(`${root}/${notificationPackage}/lib`, `${notificationPackage}/lib`, { recursive: true });
}
