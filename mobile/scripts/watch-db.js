/**
 * HealthMate Automatic SQLite Live Sync Daemon
 *
 * Automatically keeps your Windows `health_records.db` synchronized with the active
 * mobile app in real-time. Whenever a new user registers or records are added in the app,
 * this service pulls the updated SQLite database directly to your laptop so you can
 * immediately view and manage it in DB Browser for SQLite.
 */
const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 8089;
const rootDir = path.resolve(__dirname, '..', '..');
const primaryDbFile = path.join(rootDir, 'health_records.db');
const assetDbFile = path.join(__dirname, '..', 'assets', 'health_records.db');

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

const adb = findAdb();

function getActiveDevice() {
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

let lastSyncedTimestamp = 0;
let isSyncing = false;

function performSync(reason = 'trigger') {
  if (isSyncing) return;

  // Do not overwrite health_records.db via raw file copy when the Java Spring Boot backend owns the SQLite WAL file
  if (fs.existsSync(`${primaryDbFile}-wal`) || fs.existsSync(`${primaryDbFile}-shm`)) {
    return;
  }

  isSyncing = true;

  try {
    const serial = getActiveDevice();
    if (!serial) {
      isSyncing = false;
      return;
    }

    const remotePath = '/sdcard/Android/data/host.exp.exponent/health_records_export.db';
    const tempPullFile = path.join(rootDir, '.temp_live_pull.db');

    execSync(`${adb} -s ${serial} pull "${remotePath}" "${tempPullFile}"`, { stdio: 'pipe' });

    if (fs.existsSync(tempPullFile)) {
      const stats = fs.statSync(tempPullFile);
      if (stats.size > 0) {
        fs.copyFileSync(tempPullFile, primaryDbFile);
        fs.copyFileSync(tempPullFile, assetDbFile);
        fs.unlinkSync(tempPullFile);

        // Read user count and health records count for feedback
        let userCount = 0;
        let recordCount = 0;
        try {
          const { DatabaseSync } = require('node:sqlite');
          const db = new DatabaseSync(primaryDbFile);
          userCount = db.prepare('SELECT count(*) as c FROM users').get().c;
          recordCount = db.prepare('SELECT count(*) as c FROM health_records').get().c;
          db.close();
        } catch {}

        console.log(`[Auto-Sync ${new Date().toLocaleTimeString()}] Live sync complete (${reason})`);
        console.log(`  -> health_records.db updated: ${userCount} users, ${recordCount} records.`);
        console.log(`  -> Click "Refresh" in DB Browser for SQLite to view the latest data.\n`);
      }
    }
  } catch (err) {
    // Device might be busy or app in middle of write
  } finally {
    isSyncing = false;
  }
}

// 1. HTTP Server for instant push notifications from the mobile app
const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith('/sync')) {
    performSync('instant HTTP event');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, timestamp: Date.now() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('===========================================================');
  console.log(` HealthMate Real-Time SQLite Auto-Sync Daemon Running     `);
  console.log(` Listening on port ${PORT} (and http://10.0.2.2:${PORT} for emulator)`);
  console.log('===========================================================');
  console.log('Target file on laptop:');
  console.log(`  ${primaryDbFile}\n`);
});

// 2. Fallback polling: Check device export file every 3 seconds
setInterval(() => {
  try {
    const serial = getActiveDevice();
    if (!serial) return;

    const remotePath = '/sdcard/Android/data/host.exp.exponent/health_records_export.db';
    const remoteStat = execSync(`${adb} -s ${serial} shell stat -c %Y "${remotePath}" 2>/dev/null`, {
      stdio: 'pipe',
    })
      .toString()
      .trim();

    const timestamp = parseInt(remoteStat, 10);
    if (!isNaN(timestamp) && timestamp > lastSyncedTimestamp) {
      if (lastSyncedTimestamp !== 0) {
        performSync('device file change detected');
      }
      lastSyncedTimestamp = timestamp;
    }
  } catch {}
}, 3000);

// Perform an initial sync on startup
performSync('startup initialization');

