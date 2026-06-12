#!/usr/bin/env node
const { spawnSync } = require("child_process");
const net = require("net");
const path = require("path");

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/mac-env.cjs <command> [args...]");
  process.exit(1);
}

function canConnect(host, port, timeoutMs = 250) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function main() {
  const hasLocal7892 = await canConnect("127.0.0.1", 7892);
  const fallbackHttpProxy = hasLocal7892 ? "http://127.0.0.1:7892" : "";
  const fallbackSocksProxy = hasLocal7892 ? "socks5://127.0.0.1:7892" : "";
  const proxyUrl = process.env.HANAKOPRO_MAC_PROXY
    || process.env.HTTPS_PROXY
    || process.env.HTTP_PROXY
    || process.env.https_proxy
    || process.env.http_proxy
    || fallbackHttpProxy;
  const socksUrl = process.env.HANAKOPRO_MAC_SOCKS_PROXY
    || process.env.ALL_PROXY
    || process.env.all_proxy
    || fallbackSocksProxy;

  const env = {
    ...process.env,
    ...(proxyUrl ? {
      HTTP_PROXY: process.env.HTTP_PROXY || proxyUrl,
      HTTPS_PROXY: process.env.HTTPS_PROXY || proxyUrl,
      http_proxy: process.env.http_proxy || proxyUrl,
      https_proxy: process.env.https_proxy || proxyUrl,
      npm_config_proxy: process.env.npm_config_proxy || process.env.NPM_CONFIG_PROXY || proxyUrl,
      npm_config_https_proxy: process.env.npm_config_https_proxy || process.env.NPM_CONFIG_HTTPS_PROXY || proxyUrl,
      ELECTRON_GET_USE_PROXY: process.env.ELECTRON_GET_USE_PROXY || "true",
      GLOBAL_AGENT_HTTP_PROXY: process.env.GLOBAL_AGENT_HTTP_PROXY || proxyUrl,
    } : {}),
    ...(socksUrl ? {
      ALL_PROXY: process.env.ALL_PROXY || socksUrl,
      all_proxy: process.env.all_proxy || socksUrl,
    } : {}),
    CSC_NAME: process.env.CSC_NAME || "-",
    SKIP_NOTARIZE: process.env.SKIP_NOTARIZE || "true",
    HANA_LOCAL_RESIGN: process.env.HANA_LOCAL_RESIGN || "true",
  };

  if (process.platform === "darwin" && process.env.HANAKOPRO_SKIP_LOCAL_CODESIGN_CERT !== "true") {
    const ensure = spawnSync(process.execPath, [path.join(__dirname, "ensure-local-codesign-cert.cjs")], {
      stdio: "inherit",
      env,
    });
    if (ensure.error) {
      console.error(ensure.error.message);
      process.exit(1);
    }
    if ((ensure.status ?? 1) !== 0) {
      process.exit(ensure.status ?? 1);
    }
  }

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
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
