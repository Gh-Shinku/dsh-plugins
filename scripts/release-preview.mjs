/** Offline version-PR preview using the same Release Please version as the pinned action. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import spawn from "cross-spawn";
import { Manifest, setLogger } from "release-please";
import { parseConventionalCommits } from "release-please/build/src/commit.js";
import { buildStrategy } from "release-please/build/src/factory.js";
import { CommitSplit } from "release-please/build/src/util/commit-split.js";
import { TagName } from "release-please/build/src/util/tag-name.js";
import { Version } from "release-please/build/src/version.js";

const logger = { info() {}, warn() {}, debug() {}, error() {}, trace() {} };
setLogger(logger);
const read = (path) => readFile(path, "utf8");
const fakeGitHub = {
  repository: { owner: "Gh-Shinku", repo: "dsh-plugins", defaultBranch: "main" },
  async getFileJson(path) {
    return JSON.parse(await read(path));
  },
  async getFileContentsOnBranch(path) {
    const parsedContent = await read(path);
    return { parsedContent, content: Buffer.from(parsedContent).toString("base64"), sha: "offline" };
  },
};

export async function preview(commits) {
  // Exercise Release Please's real config parser, routing, version strategy, and file updaters.
  const manifest = await Manifest.fromManifest(fakeGitHub, "main", undefined, undefined, { logger });
  const config = JSON.parse(await read("release-please-config.json"));
  const versions = JSON.parse(await read(".release-please-manifest.json"));
  const split = new CommitSplit({ packagePaths: Object.keys(config.packages) }).split(commits);
  const proposals = [];
  for (const [path, settings] of Object.entries(manifest.repositoryConfig)) {
    const strategy = await buildStrategy({ ...settings, path, github: fakeGitHub, targetBranch: "main" });
    const previous = {
      tag: new TagName(Version.parse(versions[path]), settings.component),
      sha: config["bootstrap-sha"],
      notes: "Existing npm baseline",
    };
    const pr = await strategy.buildReleasePullRequest(parseConventionalCommits(split[path] ?? [], logger), previous);
    if (!pr) continue;
    const updates = [];
    for (const update of pr.updates) {
      let original;
      try {
        original = await read(update.path);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (original === undefined && !update.createIfMissing) continue;
      updates.push({ path: update.path, content: update.updater.updateContent(original) });
    }
    proposals.push({ path, version: pr.version.toString(), notes: pr.body.toString(), updates });
  }
  return proposals;
}

function git(args) {
  const result = spawn.sync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "git failed");
  return result.stdout.trim();
}

export async function main() {
  const config = JSON.parse(await read("release-please-config.json"));
  const shas = git(["rev-list", `${config["bootstrap-sha"]}..HEAD`])
    .split(/\r?\n/)
    .filter(Boolean);
  const commits = shas.map((sha) => ({
    sha,
    message: git(["show", "-s", "--format=%B", sha]),
    files: git(["diff-tree", "--no-commit-id", "--name-only", "-r", sha]).split(/\r?\n/).filter(Boolean),
  }));
  const proposals = await preview(commits);
  const directory = resolve(".artifacts/release-preview");
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/plan.json`, `${JSON.stringify(proposals, null, 2)}\n`);
  for (const proposal of proposals) console.log(`${proposal.path}: ${proposal.version}`);
  console.log(`Offline preview (no GitHub or npm writes): ${directory}/plan.json`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
