import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import YAML from "yaml";
import { main, publishPrepared, releaseItem, verifyPublished } from "./release.mjs";
import { preview as previewFromHistory } from "./release-preview.mjs";

const mcp = "packages/dsh-mcp-manager";
const desktop = "packages/dsh-desktop-notifications";
// Fixture expectations must not change when the real repository is released.
const preview = (commits) => previewFromHistory(commits, { [mcp]: "0.0.1", [desktop]: "0.0.1" });
const commit = (message, files) => ({ sha: "a".repeat(40), message, files });

test("root-only feature tooling never creates plugin release proposals", async () => {
  assert.deepEqual(await preview([commit("feat: add local CD", ["scripts/local-cd.mjs", "package.json"])]), []);
});

test("real strategy routes package commits, aggregates bumps and writes versions/changelogs", async () => {
  const proposals = await preview([
    commit("fix: restore selection", [`${mcp}/src/manager.ts`]),
    commit("feat: add server search", [`${mcp}/src/client/index.ts`]),
    commit("fix: restore task notification", [`${desktop}/src/client/index.ts`]),
  ]);
  assert.deepEqual(
    proposals.map((item) => [item.path, item.version]),
    [
      [mcp, "0.1.0"],
      [desktop, "0.0.2"],
    ],
  );
  for (const item of proposals) {
    const packageUpdate = item.updates.find((update) => update.path === `${item.path}/package.json`);
    assert.equal(JSON.parse(packageUpdate.content).version, item.version);
    assert(item.updates.some((update) => update.path === `${item.path}/CHANGELOG.md`));
  }
  assert(proposals[0].notes.includes("add server search"));
  assert(!proposals[0].notes.includes("restore task notification"));
});

test("pre-1.0 breaking changes bump minor and package documentation alone does not release", async () => {
  const proposals = await preview([
    commit("feat!: change tool selection format", [`${mcp}/src/contracts.ts`]),
    commit("docs: clarify notifications", [`${desktop}/README.md`]),
  ]);
  assert.deepEqual(
    proposals.map((item) => [item.path, item.version]),
    [[mcp, "0.1.0"]],
  );
});

test("only a matching component tag at the workflow SHA selects a package", () => {
  const manifest = { name: "@shinku-ever/dsh-mcp-manager", version: "0.1.0", publishConfig: { access: "public" } };
  const config = { component: "dsh-mcp-manager" };
  const versions = { [mcp]: "0.1.0" };
  const release = { id: 123, tag_name: "dsh-mcp-manager-v0.1.0", draft: true };
  assert.equal(releaseItem(mcp, config, manifest, versions, undefined, "new", "new"), undefined);
  assert.equal(releaseItem(mcp, config, manifest, versions, release, "old", "new"), undefined);
  assert.equal(releaseItem(mcp, config, manifest, versions, release, "new", "new").releaseId, 123);
  assert.throws(() => releaseItem(mcp, config, manifest, { [mcp]: "0.2.0" }, release, "new", "new"));
  assert.throws(() => releaseItem(mcp, config, manifest, versions, { ...release, tag_name: "wrong" }, "new", "new"));
});

test("recovery accepts already-published matching bytes and rejects version or integrity mismatches", () => {
  const item = { name: "@shinku-ever/dsh-mcp-manager", version: "0.1.0" };
  const bytes = Buffer.from("verified archive");
  const metadata = { ...item, dist: { integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}` } };
  verifyPublished(item, metadata, bytes);
  assert.throws(() => verifyPublished(item, metadata, Buffer.from("different archive")));
  assert.throws(() => verifyPublished(item, { ...metadata, version: "0.2.0" }, bytes));
});

test("publication refuses local execution", async () => {
  // This is an offline test suite; no mock credentials or publication requests.
  if (process.env.GITHUB_ACTIONS !== "true") await assert.rejects(main("publish"), /only in GitHub Actions/);
});

test("partial npm failure exposes no releases; retry skips the matching published package", async () => {
  const events = [];
  const bytes = Buffer.from("verified archive");
  const digest = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  const prepared = ["mcp", "notifications"].map((name) => ({
    item: { name, version: "0.1.0" },
    archive: name,
    bytes,
  }));
  const metadata = (item) => ({ ...item, dist: { integrity: digest } });
  await assert.rejects(
    publishPrepared(prepared, {
      publish: (archive) => {
        events.push(`publish:${archive}`);
        if (archive === "notifications") throw new Error("npm failed");
      },
      expose: () => {
        throw new Error("must not expose incomplete release");
      },
    }),
    /npm failed/,
  );
  assert.deepEqual(events, ["publish:mcp", "publish:notifications"]);
  events.length = 0;
  prepared[0].metadata = metadata(prepared[0].item);
  await publishPrepared(prepared, {
    publish: (archive) => events.push(`publish:${archive}`),
    expose: (item) => events.push(`expose:${item.name}`),
  });
  assert.deepEqual(events, ["publish:notifications", "expose:mcp", "expose:notifications"]);
});

test("successful publish commands expose releases without waiting for registry visibility", async () => {
  const events = [];
  await publishPrepared([{ item: { name: "mcp", version: "0.0.2" }, archive: "mcp.tgz" }], {
    publish: (archive) => events.push(`publish:${archive}`),
    lookup: () => {
      throw new Error("Registry still returns 404 after successful publish");
    },
    expose: (item) => events.push(`expose:${item.name}`),
  });
  assert.deepEqual(events, ["publish:mcp.tgz", "expose:mcp"]);
});

test("workflow separates PR preparation, exact-SHA packing, and OIDC publication", async () => {
  const workflow = YAML.parse(await readFile(".github/workflows/publish.yml", "utf8"));
  const { jobs } = workflow;
  assert.equal(jobs["release-please"].if, undefined);
  assert.equal(
    jobs["release-please"].steps[0].with["skip-github-release"],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression, not JS interpolation.
    "${{ vars.NPM_PUBLISH_ENABLED != 'true' }}",
  );
  // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression.
  assert.equal(jobs.pack.steps[0].with.ref, "${{ github.sha }}");
  // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression.
  assert.equal(jobs.publish.steps[0].with.ref, "${{ github.sha }}");
  assert.equal(jobs.publish.permissions["id-token"], "write");
  assert.equal(jobs.pack.permissions["id-token"], undefined);
  assert(jobs.publish.steps.some((step) => step.uses?.startsWith("actions/download-artifact@")));
  for (const job of [jobs["release-please"], jobs.pack]) {
    const upload = job.steps.find((step) => step.uses?.startsWith("actions/upload-artifact@"));
    assert.equal(upload.with["include-hidden-files"], true, ".artifacts must be included in the upload");
  }
  assert(!jobs.publish.steps.some((step) => step.run?.includes("pnpm build")));
  assert(jobs.publish.if.includes("NPM_PUBLISH_ENABLED"));
});
