/**
 * HealthMate SQLite Database Push Utility
 *
 * Pushes a SQLite database edited on Windows (e.g. using DB Browser for SQLite)
 * to the connected Android device or emulator, and updates bundled assets.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function findAdb() {
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const defaultAdb = path.join(localAppData, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
    if (fs.existsSync(defaultAdb)) {
      return `"${defaultAdb}"`;
    }
  }
  return 'adb';
}

function getActiveDevice(adb) {
  try {
    const output = execSync(`${adb} devices`).toString();
    const lines = output.split('\n').filter((l) => l.includes('\tdevice'));
    if (lines.length === 0) return null;

    const serials = lines.map((l) => l.split('\t')[0].trim());
    if (serials.length === 1) return serials[0];

    for (const serial of serials) {
      try {
        const focus = execSync(`${adb} -s ${serial} shell dumpsys window`).toString();
        if (focus.includes('host.exp.exponent') || focus.includes('HealthMate')) {
          return serial;
        }
      } catch {}
    }

    return serials[0];
  } catch {
    return null;
  }
}

function run() {
  const adb = findAdb();
  const rootDir = path.resolve(__dirname, '..', '..');
  const sourceFile = path.join(rootDir, 'health_records.db');
  const assetFile = path.join(__dirname, '..', 'assets', 'health_records.db');

  console.log('====================================================');
  console.log('     HealthMate SQLite Database Push Utility        ');
  console.log('====================================================');

  if (!fs.existsSync(sourceFile)) {
    console.error(`Error: Source database file not found at: ${sourceFile}`);
    process.exit(1);
  }

  // Update bundled asset
  fs.copyFileSync(sourceFile, assetFile);
  console.log(`Updated bundled asset: ${assetFile}`);

  const serial = getActiveDevice(adb);
  if (!serial) {
    console.log('Notice: No active Android emulator/device detected. Asset updated for next build.');
    return;
  }

  console.log(`Connected Android Device: ${serial}`);

  const targetLocations = [
    '/sdcard/Android/data/host.exp.exponent/health_records_export.db',
    '/sdcard/Download/health_records_export.db',
  ];

  for (const remotePath of targetLocations) {
    try {
      execSync(`${adb} -s ${serial} push "${sourceFile}" "${remotePath}"`, { stdio: 'pipe' });
      console.log(`Pushed to device: ${remotePath}`);
    } catch (pushErr) {
      console.warn(`Could not push to ${remotePath}:`, pushErr.message);
    }
  }

  console.log('\nDatabase pushed successfully!');
  console.log('Tip: In the HealthMate app, pull-to-refresh on the Dashboard to reload data.');
  console.log('====================================================\n');
}

run();

