const fs = require("fs");
const path = require("path");

function nodePtySpawnHelperCandidates(nodePtyDir, opts = {}) {
  const platform = opts.platform || process.platform;
  const arch = opts.arch || process.arch;
  if (!nodePtyDir || platform !== "darwin") return [];
  return [
    path.join(nodePtyDir, "build", "Release", "spawn-helper"),
    path.join(nodePtyDir, "build", "Debug", "spawn-helper"),
    path.join(nodePtyDir, "prebuilds", `${platform}-${arch}`, "spawn-helper"),
  ];
}

function firstExistingNodePtySpawnHelper(nodePtyDir, opts = {}) {
  for (const candidate of nodePtySpawnHelperCandidates(nodePtyDir, opts)) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  return null;
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function ensureNodePtySpawnHelperExecutable(nodePtyDir, opts = {}) {
  const helper = firstExistingNodePtySpawnHelper(nodePtyDir, opts);
  if (!helper) return null;

  if (!isExecutable(helper)) {
    const stat = fs.statSync(helper);
    fs.chmodSync(helper, stat.mode | 0o755);
  }
  return helper;
}

function describeNodePtySpawnHelperRequirement(opts = {}) {
  const platform = opts.platform || process.platform;
  const arch = opts.arch || process.arch;
  if (platform !== "darwin") return null;
  return `node-pty/{build/Release,build/Debug,prebuilds/${platform}-${arch}}/spawn-helper`;
}

module.exports = {
  describeNodePtySpawnHelperRequirement,
  ensureNodePtySpawnHelperExecutable,
  firstExistingNodePtySpawnHelper,
  isExecutable,
  nodePtySpawnHelperCandidates,
};
