import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { __testing } from "../server/terminal/manager.js";

const tempDirs = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hana-terminal-manager-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("terminal manager launch defaults", () => {
  it("falls back to the user home when a requested cwd no longer exists", () => {
    expect(__testing.resolveCwd(path.join(os.tmpdir(), "hana-missing-cwd"))).toBe(os.homedir());
  });

  it("accepts an existing directory as the terminal cwd", () => {
    const dir = makeTempDir();

    expect(__testing.resolveCwd(dir)).toBe(dir);
  });

  it("does not use an invalid SHELL from a GUI app environment on Unix", () => {
    if (process.platform === "win32") return;
    vi.stubEnv("SHELL", "/definitely/not/a/shell");

    expect(__testing.defaultShell()).not.toBe("/definitely/not/a/shell");
    expect(__testing.defaultShell()).toMatch(/(?:zsh|bash|sh)$/);
  });
});
