import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  ensureNodePtySpawnHelperExecutable,
  firstExistingNodePtySpawnHelper,
  isExecutable,
  nodePtySpawnHelperCandidates,
} = require("../scripts/node-pty-spawn-helper.cjs");

const tempDirs = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hana-node-pty-helper-"));
  tempDirs.push(dir);
  return dir;
}

function writeFile(root, relativePath, content = "helper") {
  const filePath = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("node-pty spawn-helper packaging", () => {
  it("chooses the same platform prebuild helper that node-pty needs on macOS", () => {
    const nodePtyDir = makeTempDir();
    const helper = writeFile(nodePtyDir, "prebuilds/darwin-arm64/spawn-helper");

    expect(nodePtySpawnHelperCandidates(nodePtyDir, { platform: "darwin", arch: "arm64" }))
      .toContain(helper);
    expect(firstExistingNodePtySpawnHelper(nodePtyDir, { platform: "darwin", arch: "arm64" }))
      .toBe(helper);
  });

  it("restores executable permission when copying node_modules loses it", () => {
    const nodePtyDir = makeTempDir();
    const helper = writeFile(nodePtyDir, "prebuilds/darwin-arm64/spawn-helper");
    fs.chmodSync(helper, 0o644);

    const fixed = ensureNodePtySpawnHelperExecutable(nodePtyDir, { platform: "darwin", arch: "arm64" });

    expect(fixed).toBe(helper);
    expect(isExecutable(helper)).toBe(true);
  });

  it("does not require a Unix spawn-helper outside macOS", () => {
    const nodePtyDir = makeTempDir();

    expect(nodePtySpawnHelperCandidates(nodePtyDir, { platform: "win32", arch: "x64" }))
      .toEqual([]);
    expect(ensureNodePtySpawnHelperExecutable(nodePtyDir, { platform: "win32", arch: "x64" }))
      .toBe(null);
    expect(nodePtySpawnHelperCandidates(nodePtyDir, { platform: "linux", arch: "x64" }))
      .toEqual([]);
  });
});
