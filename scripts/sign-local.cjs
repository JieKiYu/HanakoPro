/**
 * sign-local.cjs — 本地安装后的统一重签
 *
 * electron-builder 的 ad-hoc 签名和 Electron Framework 原始签名 Team ID 不同，
 * macOS 拒绝加载。这个脚本统一重签所有二进制，确保 Team ID 一致。
 *
 * 关键：server/node_modules 里的 .node 文件（native addon）也要签，
 * codesign --deep 不会递归进 node_modules 目录。
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const APP = path.resolve(process.argv[2] || process.env.HANAKOPRO_APP_PATH || "/Applications/HanakoPro.app");
const ENT = path.join(__dirname, "..", "desktop", "entitlements.mac.plist");
const LOCAL_IDENTITY = process.env.HANAKOPRO_LOCAL_CODESIGN_IDENTITY || "HanakoPro Local Code Signing";
const SKIP_LOCAL_IDENTITY = process.env.HANAKOPRO_DISABLE_LOCAL_CODESIGN_IDENTITY === "true";

if (!fs.existsSync(APP)) {
  console.error(`App bundle not found: ${APP}`);
  process.exit(1);
}

function shellQuote(value) {
  return `"${String(value).replace(/(["\\$`])/g, "\\$1")}"`;
}

function removeLaunchPolicyXattrs() {
  execSync(`xattr -cr ${shellQuote(APP)}`, { stdio: "inherit" });
}

function resolveIdentity() {
  if (SKIP_LOCAL_IDENTITY) return "-";
  try {
    const output = execSync("security find-identity -v -p codesigning", { encoding: "utf8" });
    if (output.includes(`"${LOCAL_IDENTITY}"`)) {
      return LOCAL_IDENTITY;
    }
  } catch (_) {
    // Fall back to ad-hoc signing below.
  }
  return "-";
}

const SIGN_IDENTITY = resolveIdentity();

function sign(target, opts = "") {
  execSync(`codesign --sign ${shellQuote(SIGN_IDENTITY)} --force ${opts} ${shellQuote(target)}`, { stdio: "inherit" });
}

function findByExtension(dir, extensions) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...findByExtension(full, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      result.push(full);
    }
  }
  return result;
}

function removeCodeSignTempFiles() {
  const files = findByExtension(APP, [".cstemp"]);
  for (const file of files) {
    fs.rmSync(file, { force: true });
  }
  if (files.length) console.log(`Removed ${files.length} stale codesign temp file(s)`);
}

// 1. 签 server 里的所有 Mach-O 文件（node binary + .node addons）
console.log(`Signing ${APP}`);
console.log(`Using signing identity: ${SIGN_IDENTITY === "-" ? "ad-hoc (-)" : SIGN_IDENTITY}`);
removeLaunchPolicyXattrs();
removeCodeSignTempFiles();

const serverDir = path.join(APP, "Contents", "Resources", "server");
if (fs.existsSync(serverDir)) {
  // node binary
  const nodeBin = path.join(serverDir, "node");
  if (fs.existsSync(nodeBin)) sign(nodeBin);

  // .node files（native addons）
  function findNodeFiles(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findNodeFiles(full);
      } else if (entry.name.endsWith(".node")) {
        sign(full);
      }
    }
  }
  const serverNodeModules = path.join(serverDir, "node_modules");
  if (fs.existsSync(serverNodeModules)) findNodeFiles(serverNodeModules);
}

// 2. 签 Computer Use helper + its dedicated TCC authorization app.
const computerUseHelper = path.join(APP, "Contents", "Resources", "computer-use", "macos", "hana-computer-use-helper");
if (fs.existsSync(computerUseHelper)) {
  sign(computerUseHelper);
}
const computerUseApp = path.join(APP, "Contents", "Resources", "computer-use", "macos", "Hanako Computer Use.app");
if (fs.existsSync(computerUseApp)) {
  sign(computerUseApp);
}

// 3. 签 frameworks + helpers（--deep 处理内部结构）
const frameworks = path.join(APP, "Contents", "Frameworks");
for (const entry of fs.readdirSync(frameworks)) {
  const full = path.join(frameworks, entry);
  if (entry.endsWith(".framework")) {
    for (const nested of findByExtension(full, [".dylib", ".so", ".node"])) {
      sign(nested);
    }
    const versionsDir = path.join(full, "Versions");
    if (fs.existsSync(versionsDir)) {
      for (const version of fs.readdirSync(versionsDir)) {
        const frameworkBinary = path.join(versionsDir, version, path.basename(entry, ".framework"));
        if (fs.existsSync(frameworkBinary)) sign(frameworkBinary);
      }
    }
    sign(full);
  } else if (entry.endsWith(".app")) {
    sign(full, `--entitlements "${ENT}"`);
  }
}

// 4. 签主 app（带 entitlements，V8 需要 JIT 权限）
sign(APP, `--entitlements "${ENT}"`);

// 5. 验证
removeCodeSignTempFiles();
execSync(`codesign --verify --deep --strict "${APP}"`, { stdio: "inherit" });
console.log("✓ Signed and verified");
