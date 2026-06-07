import path from "path";
import { createRequire } from "module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  buildGhosttyOpenArgs,
  directoryOrHome,
  findGhosttyAppPath,
} = require("../desktop/src/shared/ghostty-launch.cjs");

describe("Ghostty launch helper", () => {
  it("finds the first installed Ghostty app candidate", () => {
    const app = "/Applications/Ghostty.app";

    expect(findGhosttyAppPath({
      candidates: ["/missing/Ghostty.app", app],
      exists: (candidate) => candidate === app,
    })).toBe(app);
  });

  it("falls back to the user home when cwd is missing or not absolute", () => {
    expect(directoryOrHome("relative/project", { homeDir: "/Users/hana" }))
      .toBe("/Users/hana");
  });

  it("builds a macOS open command for a new Ghostty window in the requested cwd", () => {
    const cwd = process.cwd();
    const appPath = "/Applications/Ghostty.app";

    expect(buildGhosttyOpenArgs(cwd, { appPath })).toEqual({
      command: "open",
      args: [
        "-na",
        appPath,
        "--args",
        `--working-directory=${cwd}`,
      ],
      cwd,
      appPath,
      workingDirectory: cwd,
    });
  });

  it("returns null when Ghostty is not installed", () => {
    expect(buildGhosttyOpenArgs(path.resolve("/tmp"), {
      candidates: ["/missing/Ghostty.app"],
      exists: () => false,
    })).toBe(null);
  });
});
