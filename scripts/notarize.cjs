const { notarize } = require('@electron/notarize');
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  if (process.env.SKIP_NOTARIZE === 'true') {
    if (process.env.HANA_LOCAL_RESIGN === 'true') {
      console.log('Re-signing local macOS app bundle (HANA_LOCAL_RESIGN=true)');
      execFileSync(process.execPath, [path.join(__dirname, 'sign-local.cjs'), appPath], { stdio: 'inherit' });
    }
    console.log('Skipping notarization (SKIP_NOTARIZE=true)');
    return;
  }

  console.log(`Notarizing ${appName}...`);

  const password = process.env.APPLE_APP_SPECIFIC_PASSWORD || process.env.APPLE_ID_PASSWORD;
  if (!password) {
    throw new Error('Set APPLE_APP_SPECIFIC_PASSWORD or APPLE_ID_PASSWORD for notarization');
  }

  await notarize({
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: password,
    teamId: process.env.APPLE_TEAM_ID,
  });

  console.log('Notarization complete.');
};
