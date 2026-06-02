#!/usr/bin/env node
const { spawnSync } = require("child_process");

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/mac-env.cjs <command> [args...]");
  process.exit(1);
}

const proxyUrl = process.env.HANAKOPRO_MAC_PROXY || "http://127.0.0.1:7892";
const socksUrl = process.env.HANAKOPRO_MAC_SOCKS_PROXY || "socks5://127.0.0.1:7892";

const env = {
  ...process.env,
  HTTP_PROXY: process.env.HTTP_PROXY || proxyUrl,
  HTTPS_PROXY: process.env.HTTPS_PROXY || proxyUrl,
  ALL_PROXY: process.env.ALL_PROXY || socksUrl,
  ELECTRON_GET_USE_PROXY: process.env.ELECTRON_GET_USE_PROXY || "true",
  GLOBAL_AGENT_HTTP_PROXY: process.env.GLOBAL_AGENT_HTTP_PROXY || proxyUrl,
  SKIP_NOTARIZE: process.env.SKIP_NOTARIZE || "true",
  HANA_LOCAL_RESIGN: process.env.HANA_LOCAL_RESIGN || "true",
};

const child = spawnSync(args[0], args.slice(1), {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

if (child.error) {
  console.error(child.error.message);
  process.exit(1);
}

process.exit(child.status ?? 1);
