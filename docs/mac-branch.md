# HanakoPro Mac Branch

This branch keeps HanakoPro close to upstream `main` and carries only the
small patches needed to build and run a local macOS app.

## Branch Layout

```bash
git fetch upstream
git checkout main
git merge --ff-only upstream/main
git checkout mac
git rebase main
```

Keep platform-specific changes small and easy to replay after each upstream
update.

## Local Build

Use the Mac helper scripts when building on this machine:

```bash
npm run mac:ci
npm run mac:pack:local
```

`mac:ci` runs npm 11 through `scripts/mac-env.cjs`, because this repo uses
`.npmrc` options that require npm >= 11.10.

`mac:pack:local` builds the macOS `.app` with:

- `HTTP_PROXY` / `HTTPS_PROXY` defaulting to `http://127.0.0.1:7892`
- `ALL_PROXY` defaulting to `socks5://127.0.0.1:7892`
- `SKIP_NOTARIZE=true`
- `HANA_LOCAL_RESIGN=true`

The local build skips Apple notarization and re-signs the app bundle with the
stable local identity `HanakoPro Local Code Signing` when available. The helper
script `scripts/ensure-local-codesign-cert.cjs` creates or reuses that identity
in the login keychain, and `scripts/sign-local.cjs` falls back to ad-hoc signing
only when the local identity is unavailable. This keeps Electron Framework,
native addons, the bundled server, and the computer-use helper on one compatible
local signature while reducing repeated macOS permission prompts.

To use another proxy port:

```bash
HANAKOPRO_MAC_PROXY=http://127.0.0.1:7890 \
HANAKOPRO_MAC_SOCKS_PROXY=socks5://127.0.0.1:7890 \
npm run mac:pack:local
```

## Release Build

For a public DMG, use real Apple credentials and do not force local notarization
skip:

```bash
APPLE_ID=... \
APPLE_APP_SPECIFIC_PASSWORD=... \
APPLE_TEAM_ID=... \
SKIP_NOTARIZE=false \
HANA_LOCAL_RESIGN=false \
npm run dist
```

The local self-signed app is for development and self-use. A public release
still needs a Developer ID signature and notarization.
