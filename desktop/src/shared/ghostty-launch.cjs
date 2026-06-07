const fs = require("fs");
const os = require("os");
const path = require("path");

const DEFAULT_GHOSTTY_APP_PATHS = [
  "/Applications/Ghostty.app",
  path.join(os.homedir(), "Applications", "Ghostty.app"),
];

function directoryOrHome(cwd, opts = {}) {
  const homeDir = opts.homeDir || os.homedir();
  if (typeof cwd === "string" && cwd.trim()) {
    const candidate = cwd.trim();
    try {
      if (path.isAbsolute(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // Fall through to the user home.
    }
  }
  return homeDir;
}

function findGhosttyAppPath(opts = {}) {
  const candidates = Array.isArray(opts.candidates) && opts.candidates.length > 0
    ? opts.candidates
    : DEFAULT_GHOSTTY_APP_PATHS;
  const exists = typeof opts.exists === "function" ? opts.exists : (filePath) => fs.existsSync(filePath);
  for (const candidate of candidates) {
    if (exists(candidate)) return candidate;
  }
  return null;
}

function buildGhosttyOpenArgs(cwd, opts = {}) {
  const appPath = opts.appPath || findGhosttyAppPath(opts);
  if (!appPath) return null;
  const workingDirectory = directoryOrHome(cwd, opts);
  return {
    command: "open",
    args: [
      "-na",
      appPath,
      "--args",
      `--working-directory=${workingDirectory}`,
    ],
    cwd: workingDirectory,
    appPath,
    workingDirectory,
  };
}

module.exports = {
  DEFAULT_GHOSTTY_APP_PATHS,
  buildGhosttyOpenArgs,
  directoryOrHome,
  findGhosttyAppPath,
};
