import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  copyBundledServerNodeModules,
  assertBundledServerNodeModulesReady,
} = require("../scripts/fix-modules.cjs");

const tempDirs = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hana-fix-modules-server-"));
  tempDirs.push(dir);
  return dir;
}

function writeFile(root, relativePath, content = "") {
  const filePath = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writeServerRuntimeSentinels(nodeModulesDir, opts = {}) {
  const platform = opts.platform || process.platform;
  const arch = opts.arch || process.arch;
  writeFile(nodeModulesDir, "ws/package.json", JSON.stringify({ name: "ws" }));
  writeFile(nodeModulesDir, "qrcode/package.json", JSON.stringify({ name: "qrcode" }));
  writeFile(nodeModulesDir, "better-sqlite3/package.json", JSON.stringify({ name: "better-sqlite3" }));
  writeFile(nodeModulesDir, "better-sqlite3/build/Release/better_sqlite3.node", "native");
  writeFile(nodeModulesDir, "node-pty/package.json", JSON.stringify({ name: "node-pty" }));
  writeFile(nodeModulesDir, `node-pty/prebuilds/${platform}-${arch}/spawn-helper`, "helper");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("fix-modules bundled server dependencies", () => {
  it("rebuilds packaged server node_modules even when a stale target directory already exists", () => {
    const tmp = makeTempDir();
    const serverDir = path.join(tmp, "resources", "server");
    const serverBuildModules = path.join(tmp, "dist-server", "mac-arm64", "node_modules");
    const staleModules = path.join(serverDir, "node_modules");

    writeFile(staleModules, "stale-only/package.json", JSON.stringify({ name: "stale-only" }));
    writeServerRuntimeSentinels(serverBuildModules, { platform: "darwin", arch: "arm64" });

    copyBundledServerNodeModules(serverDir, serverBuildModules, {
      platform: "darwin",
      arch: "arm64",
      log: () => {},
    });

    expect(fs.existsSync(path.join(staleModules, "stale-only", "package.json"))).toBe(false);
    expect(fs.existsSync(path.join(staleModules, "ws", "package.json"))).toBe(true);
    expect(fs.existsSync(path.join(staleModules, "qrcode", "package.json"))).toBe(true);
    expect(fs.existsSync(path.join(staleModules, "better-sqlite3", "package.json"))).toBe(true);
    expect(fs.existsSync(path.join(
      staleModules,
      "better-sqlite3",
      "build",
      "Release",
      "better_sqlite3.node",
    ))).toBe(true);
    expect(fs.existsSync(path.join(
      staleModules,
      "node-pty",
      "prebuilds",
      "darwin-arm64",
      "spawn-helper",
    ))).toBe(true);
  });

  it("restores node-pty spawn-helper executable permission when packaging server modules", () => {
    const tmp = makeTempDir();
    const serverDir = path.join(tmp, "resources", "server");
    const serverBuildModules = path.join(tmp, "dist-server", "mac-arm64", "node_modules");
    fs.mkdirSync(serverDir, { recursive: true });
    writeServerRuntimeSentinels(serverBuildModules, { platform: "darwin", arch: "arm64" });
    const sourceHelper = path.join(
      serverBuildModules,
      "node-pty",
      "prebuilds",
      "darwin-arm64",
      "spawn-helper",
    );
    fs.chmodSync(sourceHelper, 0o644);

    copyBundledServerNodeModules(serverDir, serverBuildModules, {
      platform: "darwin",
      arch: "arm64",
      log: () => {},
    });

    const packagedHelper = path.join(
      serverDir,
      "node_modules",
      "node-pty",
      "prebuilds",
      "darwin-arm64",
      "spawn-helper",
    );
    fs.accessSync(packagedHelper, fs.constants.X_OK);
  });

  it("fails fast when the packaged server node_modules misses a startup dependency", () => {
    const tmp = makeTempDir();
    const serverNodeModules = path.join(tmp, "resources", "server", "node_modules");

    writeFile(serverNodeModules, "ws/package.json", JSON.stringify({ name: "ws" }));
    writeFile(serverNodeModules, "better-sqlite3/package.json", JSON.stringify({ name: "better-sqlite3" }));

    expect(() => assertBundledServerNodeModulesReady(serverNodeModules)).toThrow(
      /node_modules\/qrcode\/package\.json/,
    );
  });
});
