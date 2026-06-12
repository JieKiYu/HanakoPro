#!/usr/bin/env node
/**
 * ensure-local-codesign-cert.cjs
 *
 * Creates a stable local code-signing identity for HanakoPro development.
 * This is not a Developer ID certificate and must not be used for public
 * distribution. It only keeps local macOS permission prompts more stable
 * across repeated ad-hoc development builds on this machine.
 */
const { execFileSync, execSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const IDENTITY = process.env.HANAKOPRO_LOCAL_CODESIGN_IDENTITY || "HanakoPro Local Code Signing";
const KEYCHAIN = process.env.HANAKOPRO_LOCAL_CODESIGN_KEYCHAIN || getLoginKeychain();
const DAYS = Number(process.env.HANAKOPRO_LOCAL_CODESIGN_DAYS || 3650);

function getLoginKeychain() {
  return execFileSync("security", ["login-keychain"], { encoding: "utf8" }).trim().replace(/^"|"$/g, "");
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    stdio: options.stdio || "pipe",
    encoding: options.encoding || "utf8",
    ...options,
  });
}

function identityExists() {
  const output = run("security", ["find-identity", "-v", "-p", "codesigning", KEYCHAIN]);
  return output.includes(`"${IDENTITY}"`);
}

function certificateExists() {
  try {
    const output = run("security", ["find-certificate", "-a", "-c", IDENTITY, "-Z", KEYCHAIN]);
    return output.includes("SHA-1 hash:");
  } catch (_) {
    return false;
  }
}

function writeOpenSslConfig(file) {
  fs.writeFileSync(file, `[ req ]
default_bits = 4096
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = codesign_ext

[ dn ]
CN = ${IDENTITY}
O = HanakoPro Local Development
OU = Local Code Signing

[ codesign_ext ]
basicConstraints = critical,CA:TRUE,pathlen:0
keyUsage = critical,digitalSignature,keyCertSign,cRLSign
extendedKeyUsage = critical,codeSigning
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
`, "utf8");
}

function main() {
  if (process.platform !== "darwin") {
    console.log("[local-codesign] macOS only; skipping.");
    return;
  }

  if (identityExists()) {
    console.log(`[local-codesign] Reusing identity: ${IDENTITY}`);
    return;
  }

  if (certificateExists()) {
    console.log(`[local-codesign] Reusing existing certificate: ${IDENTITY}`);
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hanako-local-codesign-"));
  const password = crypto.randomBytes(24).toString("hex");
  const config = path.join(tmp, "openssl.cnf");
  const key = path.join(tmp, "key.pem");
  const cert = path.join(tmp, "cert.pem");
  const p12 = path.join(tmp, "identity.p12");

  try {
    console.log(`[local-codesign] Creating local identity: ${IDENTITY}`);
    console.log(`[local-codesign] Keychain: ${KEYCHAIN}`);
    writeOpenSslConfig(config);

    run("openssl", ["genrsa", "-out", key, "4096"]);
    run("openssl", [
      "req",
      "-new",
      "-x509",
      "-days",
      String(DAYS),
      "-key",
      key,
      "-out",
      cert,
      "-config",
      config,
    ]);
    run("openssl", [
      "pkcs12",
      "-export",
      "-inkey",
      key,
      "-in",
      cert,
      "-name",
      IDENTITY,
      "-out",
      p12,
      "-passout",
      `pass:${password}`,
    ]);

    run("security", [
      "import",
      p12,
      "-k",
      KEYCHAIN,
      "-P",
      password,
      "-f",
      "pkcs12",
      "-T",
      "/usr/bin/codesign",
      "-T",
      "/usr/bin/security",
    ], { stdio: "inherit" });

    console.log("[local-codesign] Trusting certificate for code signing.");
    console.log("[local-codesign] macOS may ask for your password once here.");
    run("security", [
      "add-trusted-cert",
      "-r",
      "trustRoot",
      "-p",
      "codeSign",
      "-k",
      KEYCHAIN,
      cert,
    ], { stdio: "inherit" });

    if (!identityExists()) {
      throw new Error(`Created certificate, but codesign identity is still not valid: ${IDENTITY}`);
    }

    console.log(`[local-codesign] Ready: ${IDENTITY}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

try {
  main();
} catch (err) {
  console.error(`[local-codesign] ${err.message}`);
  process.exit(1);
}
