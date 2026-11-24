/**
 * HealthMate SQLite Database Export Utility
 *
 * Exports and pulls the active SQLite database from the connected Android emulator or device
 * to Windows so it can be directly inspected, browsed, and verified in DB Browser for SQLite.
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

    // If multiple devices, detect which one has the app in focus or has the export file
    for (const serial of serials) {
      try {
        const focus = execSync(`${adb} -s ${serial} shell dumpsys window`).toString();
        if (focus.includes('host.exp.exponent') || focus.includes('HealthMate')) {
          return serial;
        }
      } catch {}
    }

    // Default to the first emulator or device
    return serials[0];
  } catch (err) {
    return null;
  }
}

function run() {
  const adb = findAdb();
  const rootDir = path.resolve(__dirname, '..', '..');
  const tempPullFile = path.join(rootDir, '.temp_export.db');
  const primaryDbFile = path.join(rootDir, 'health_records.db');
  const assetDbFile = path.join(__dirname, '..', 'assets', 'health_records.db');

  console.log('====================================================');
  console.log('    HealthMate SQLite Database Export Utility       ');
  console.log('====================================================');

  const serial = getActiveDevice(adb);
  if (!serial) {
    console.error('Error: No active Android emulator or device found.');
    console.error('Please make sure your emulator (e.g. Pixel_10_Pro) is running.');
    process.exit(1);
  }

  console.log(`Connected Android Device: ${serial}\n`);

  const possiblePaths = [
    '/sdcard/Android/data/host.exp.exponent/health_records_export.db',
    '/sdcard/Download/health_records_export.db',
  ];

  let pulled = false;
  for (const remotePath of possiblePaths) {
    try {
      console.log(`Checking device path: ${remotePath}...`);
      execSync(`${adb} -s ${serial} pull "${remotePath}" "${tempPullFile}"`, { stdio: 'pipe' });
      const stats = fs.statSync(tempPullFile);
      if (stats.size > 0) {
        console.log(`Successfully pulled database (${stats.size.toLocaleString()} bytes).\n`);
        pulled = true;
        break;
      }
    } catch {
      // Continue checking
    }
  }

  if (!pulled) {
    if (fs.existsSync(tempPullFile)) {
      fs.unlinkSync(tempPullFile);
    }
    console.log('Notice: Export snapshot not found on device yet.');
    console.log('Interact with HealthMate in Expo Go to trigger an automatic snapshot.');
    return;
  }

  // Synchronize copies to ensure DB Browser for SQLite opens the active data
  try {
    fs.copyFileSync(tempPullFile, primaryDbFile);
    fs.copyFileSync(tempPullFile, assetDbFile);
    fs.unlinkSync(tempPullFile);
    console.log('Synchronized database copies across project:');
    console.log(`  1. ${primaryDbFile}`);
    console.log(`  2. ${assetDbFile}\n`);
  } catch (syncErr) {
    if (fs.existsSync(tempPullFile)) {
      fs.unlinkSync(tempPullFile);
    }
    console.error('Error synchronizing database copies:', syncErr.message);
    process.exit(1);
  }

  // Verify and display tables and records using node:sqlite
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(primaryDbFile);
    console.log('----------------------------------------------------');
    console.log(' Database Content Verification (DB Browser Format)  ');
    console.log('----------------------------------------------------');
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
      .all();
    for (const t of tables) {
      const count = db.prepare(`SELECT count(*) as c FROM ${t.name}`).get().c;
      console.log(` Table: ${t.name.padEnd(20)} | Rows: ${count}`);
    }
    db.close();
    console.log('----------------------------------------------------\n');
  } catch {
    // Inspection is optional
  }

  console.log('--- DB Browser for SQLite Instructions ---');
  console.log('1. Open DB Browser for SQLite on your laptop.');
  console.log('2. Click "Open Database" (or press Ctrl + O).');
  console.log('3. Select:');
  console.log(`     ${primaryDbFile}`);
  console.log('4. Click the "Browse Data" tab.');
  console.log('5. Select any table (users, health_records, daily_goals, etc.) to view real live data.\n');
  console.log('====================================================\n');
}

run();
