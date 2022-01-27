require('dotenv').config();
const fs = require("fs")
const { notarize } = require('electron-notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  const appPath = `${appOutDir}/${appName}.app`;

  if (!fs.existsSync(appPath)) {
    console.log('skip')
    return
  }

  console.log(`Notarizing ${appName} found at ${appPath}`)

  return await notarize({
    appBundleId: 'junto.foundation.flux',
    appPath: appPath,
    appleId: process.env.APPLEID,
    appleIdPassword: process.env.APPLEIDPASS,
  });
};