/** Release Please tags select packages; npm receives only archives verified by the pack job. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import spawn from "cross-spawn";

const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const integrity = (bytes) => `sha512-${createHash("sha512").update(bytes).digest("base64")}`;

export function releaseItem(path, config, manifest, versions, release, tagSha, sha) {
  assert.match(path, /^packages\/dsh-[a-z-]+$/);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(versions[path], manifest.version, `Version manifest differs for ${path}`);
  const tag = `${config.component}-v${manifest.version}`;
  if (!release || tagSha !== sha) return undefined;
  assert.equal(release.tag_name, tag);
  assert.equal(manifest.private, undefined, "Private packages must not be published");
  assert.equal(manifest.publishConfig?.access, "public");
  return {
    path,
    name: manifest.name,
    version: manifest.version,
    tag,
    sha,
    releaseId: release.id,
    archive: `${manifest.name.replace(/^@/, "").replace("/", "-")}-${manifest.version}.tgz`,
  };
}

export function verifyPublished(item, metadata, bytes) {
  assert.equal(metadata.name, item.name);
  assert.equal(metadata.version, item.version);
  assert.equal(metadata.dist?.integrity, integrity(bytes), `Published bytes differ for ${item.name}@${item.version}`);
}

export async function publishPrepared(prepared, operations) {
  for (const { item, archive, bytes, metadata } of prepared) {
    if (!metadata) await operations.publish(archive);
    const result = await operations.lookup(item);
    assert(result, `Published version is not yet visible: ${item.name}@${item.version}; rerun the failed job`);
    verifyPublished(item, result, bytes);
  }
  // Keep GitHub releases in draft until all selected packages pass npm integrity verification.
  for (const { item } of prepared) await operations.expose(item);
}

function run(command, args) {
  const result = spawn.sync(command, args, { encoding: "utf8", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function api(path, args = []) {
  return JSON.parse(run("gh", ["api", path, ...args]));
}

async function published(item) {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(item.name)}/${item.version}`);
  if (response.status === 404) return undefined;
  assert(response.ok, `Registry lookup failed: ${response.status}`);
  return response.json();
}

export async function main(mode) {
  assert.equal(process.env.GITHUB_ACTIONS, "true", "Release commands run only in GitHub Actions");
  assert.equal(process.env.GITHUB_REF, "refs/heads/main", "Releases require main");
  const repo = process.env.GITHUB_REPOSITORY;
  assert.match(repo ?? "", /^[\w.-]+\/[\w.-]+$/);
  const sha = process.env.GITHUB_SHA;
  assert.match(sha ?? "", /^[a-f0-9]{40}$/);
  assert.equal(run("git", ["rev-parse", "HEAD"]), sha, "Checkout must match the workflow commit");
  const config = await json("release-please-config.json");
  const versions = await json(".release-please-manifest.json");
  const planPath = ".artifacts/release-plan.json";

  if (mode === "plan") {
    const items = [];
    // The by-tag endpoint is for published releases. List with the version
    // job's write-capable token so drafts are visible without broadening pack permissions.
    const releases = api(`repos/${repo}/releases?per_page=100`, ["--paginate", "--slurp"]).flat();
    for (const [path, settings] of Object.entries(config.packages)) {
      const manifest = await json(`${path}/package.json`);
      const tag = `${settings.component}-v${manifest.version}`;
      const release = releases.find((candidate) => candidate.tag_name === tag);
      if (!release) continue;
      const tagSha = run("git", ["rev-parse", `refs/tags/${tag}^{commit}`]);
      const item = releaseItem(path, settings, manifest, versions, release, tagSha, sha);
      if (item) items.push(item);
    }
    await mkdir(".artifacts", { recursive: true });
    await writeFile(planPath, `${JSON.stringify(items, null, 2)}\n`);
    await appendFile(process.env.GITHUB_OUTPUT, `has-releases=${items.length > 0}\n`);
    console.log(JSON.stringify(items, null, 2));
    return;
  }

  assert.equal(mode, "publish", "Expected plan or publish");
  const items = await json(planPath);
  assert(items.length > 0, "No selected releases");
  const prepared = [];
  // Validate every item before the first external write, including on recovery runs.
  for (const item of items) {
    const manifest = await json(`${item.path}/package.json`);
    const release = api(`repos/${repo}/releases/${item.releaseId}`);
    const ref = api(`repos/${repo}/git/ref/tags/${item.tag}`);
    const tagSha =
      ref.object.type === "tag" ? api(`repos/${repo}/git/tags/${ref.object.sha}`).object.sha : ref.object.sha;
    assert.deepEqual(
      releaseItem(item.path, config.packages[item.path], manifest, versions, release, tagSha, sha),
      item,
    );
    const archive = resolve(".artifacts", item.archive);
    const bytes = await readFile(archive);
    const packedManifest = JSON.parse(run("tar", ["-xOf", archive, "package/package.json"]));
    assert.equal(packedManifest.name, item.name, "Archive package differs from the release plan");
    assert.equal(packedManifest.version, item.version, "Archive version differs from the release plan");
    const metadata = await published(item);
    if (metadata) verifyPublished(item, metadata, bytes);
    prepared.push({ item, archive, bytes, metadata });
  }
  await publishPrepared(prepared, {
    publish: (archive) =>
      console.log(run("pnpm", ["publish", archive, "--access", "public", "--ignore-scripts", "--no-git-checks"])),
    lookup: published,
    expose: (item) => {
      api(`repos/${repo}/releases/${item.releaseId}`, ["--method", "PATCH", "-F", "draft=false"]);
      console.log(`Verified npm and GitHub release: ${item.name}@${item.version} (${item.sha})`);
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main(process.argv[2]);
