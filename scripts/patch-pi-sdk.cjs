/**
 * patch-pi-sdk.cjs — Pi SDK 版本验证与幂等兼容补丁
 *
 * 历史上这个脚本会在 postinstall 阶段修改
 * node_modules/@mariozechner/pi-coding-agent/dist/core/sdk.js，
 * 为 Hana 的 session-scoped sandbox tools 打通 baseToolsOverride。
 *
 * Pi SDK 0.68+ 已把 createAgentSession({ tools }) 改成工具名 allowlist，
 * Hana 现在通过 lib/pi-sdk 适配层把本地 Tool[] 转为 customTools + names。
 *
 * 当前仍需要一个很窄的 SDK 运行时补丁：pi-ai 0.70.5 的
 * openai-responses stream processor 会忽略 Responses API 原生
 * image_generation_call，导致上游已生成/计费的图片没有进入 assistant
 * message。这里在精确版本与源码结构校验后幂等补丁该分支。
 *
 * 文件名（patch-pi-sdk）保留是为了不动 package.json 的 postinstall 钩子，
 * 避免触发 npm install cache 重算。log 前缀继续沿用 verify-pi-sdk。
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const sdkRoot = path.join(root, "node_modules", "@mariozechner", "pi-coding-agent");
const piAiRoot = path.join(root, "node_modules", "@mariozechner", "pi-ai");
const verifiedVersions = new Set(["0.70.2"]);
const verifiedPiAiVersions = new Set(["0.70.5"]);

function fail(message) {
  console.error(`[verify-pi-sdk] ${message}`);
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function patchResponsesImageGeneration() {
  const file = path.join(piAiRoot, "dist", "providers", "openai-responses-shared.js");
  let src = fs.readFileSync(file, "utf8");
  const marker = "Hana compat: preserve native Responses image_generation_call results";
  if (src.includes(marker)) {
    console.log("[verify-pi-sdk] responses image_generation_call compat already applied");
    return;
  }

  const addedBranchNeedle = `            else if (item.type === "function_call") {
                currentItem = item;
                currentBlock = {
                    type: "toolCall",
                    id: \`\${item.call_id}|\${item.id}\`,
                    name: item.name,
                    arguments: {},
                    partialJson: item.arguments || "",
                };
                output.content.push(currentBlock);
                stream.push({ type: "toolcall_start", contentIndex: blockIndex(), partial: output });
            }`;
  const addedBranchPatch = `${addedBranchNeedle}
            else if (item.type === "image_generation_call") {
                // ${marker}.
                currentItem = item;
                currentBlock = null;
            }`;

  const doneBranchNeedle = `            else if (item.type === "function_call") {
                const args = currentBlock?.type === "toolCall" && currentBlock.partialJson
                    ? parseStreamingJson(currentBlock.partialJson)
                    : parseStreamingJson(item.arguments || "{}");
                let toolCall;
                if (currentBlock?.type === "toolCall") {
                    // Finalize in-place and strip the scratch buffer so replay only
                    // carries parsed arguments.
                    currentBlock.arguments = args;
                    delete currentBlock.partialJson;
                    toolCall = currentBlock;
                }
                else {
                    toolCall = {
                        type: "toolCall",
                        id: \`\${item.call_id}|\${item.id}\`,
                        name: item.name,
                        arguments: args,
                    };
                }
                currentBlock = null;
                stream.push({ type: "toolcall_end", contentIndex: blockIndex(), toolCall, partial: output });
            }`;
  const doneBranchPatch = `${doneBranchNeedle}
            else if (item.type === "image_generation_call") {
                const data = typeof item.result === "string" ? item.result.trim() : "";
                if (data) {
                    output.content.push({ type: "image", data, mimeType: "image/png" });
                }
                currentBlock = null;
            }`;

  if (!src.includes(addedBranchNeedle)) {
    fail("openai-responses-shared.js add-item hook marker not found");
  }
  if (!src.includes(doneBranchNeedle)) {
    fail("openai-responses-shared.js done-item hook marker not found");
  }

  src = src.replace(addedBranchNeedle, addedBranchPatch);
  src = src.replace(doneBranchNeedle, doneBranchPatch);
  fs.writeFileSync(file, src);
  console.log("[verify-pi-sdk] patched responses image_generation_call compat");
}

if (!fs.existsSync(sdkRoot)) {
  console.log("[verify-pi-sdk] SDK not installed, skipping");
  process.exit(0);
}

const pkg = readJson(path.join(sdkRoot, "package.json"));
if (!verifiedVersions.has(pkg.version)) {
  fail(`SDK version ${pkg.version} is not verified. Verified versions: ${[...verifiedVersions].join(", ")}`);
}

if (!fs.existsSync(piAiRoot)) {
  fail("@mariozechner/pi-ai is not installed");
}
const piAiPkg = readJson(path.join(piAiRoot, "package.json"));
if (!verifiedPiAiVersions.has(piAiPkg.version)) {
  fail(`pi-ai version ${piAiPkg.version} is not verified. Verified versions: ${[...verifiedPiAiVersions].join(", ")}`);
}

patchResponsesImageGeneration();

const sdkIndex = fs.readFileSync(path.join(sdkRoot, "dist", "index.js"), "utf8");
const expectedExportMarkers = [
  "createAgentSession",
  "createReadTool",
  "createWriteTool",
  "createEditTool",
  "createBashTool",
  "createGrepTool",
  "createFindTool",
  "createLsTool",
  "parseSessionEntries",
  "buildSessionContext",
];

for (const marker of expectedExportMarkers) {
  if (!sdkIndex.includes(marker)) {
    fail(`expected SDK export marker not found: ${marker}`);
  }
}

const scanDirs = ["core", "server", "lib", "hub"].map(d => path.join(root, d));
const adapterDir = path.join(root, "lib", "pi-sdk");
const importPattern = /(?:from\s+["']@mariozechner\/|import\s*\(\s*["']@mariozechner\/|require\s*\(\s*["']@mariozechner\/)/;
const leaks = [];

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full === adapterDir || entry.name === "node_modules") continue;
      scanDir(full);
    } else if (/\.(js|mjs|cjs)$/.test(entry.name)) {
      const content = fs.readFileSync(full, "utf8");
      if (importPattern.test(content)) {
        leaks.push(path.relative(root, full));
      }
    }
  }
}

for (const dir of scanDirs) scanDir(dir);

if (leaks.length > 0) {
  fail(`production files bypass lib/pi-sdk: ${leaks.join(", ")}`);
}

console.log("[verify-pi-sdk] all checks passed");
