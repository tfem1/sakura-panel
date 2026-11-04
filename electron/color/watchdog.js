/* SAKURA PANEL — crash watchdog.
 *
 * Started by the main process as `electron.exe watchdog.js <parentPid> <dataDir>` with
 * ELECTRON_RUN_AS_NODE=1 (same binary, no PowerShell, no extra install). It polls the
 * parent; if the parent dies while the session lock still says "adjustments active",
 * it writes every monitor's original gamma ramp back and resets the colour matrix.
 * On a normal exit the main process removes the lock (or marks it "keep") first, so
 * the watchdog just exits.
 */
const fs = require('fs');
const path = require('path');

const M = require('../../src/js/color-math.js');

function read(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }

/** Restores originals if the lock shows `parentPid` died with adjustments active. Returns what it did. */
function restoreFromLock({ dataDir, parentPid, backend }) {
  const lockFile = path.join(dataDir, 'color-session.json');
  const lock = read(lockFile);
  if (!lock) return { action: 'none', reason: 'no lock (clean exit)' };
  if (lock.keep) return { action: 'none', reason: 'adjustments kept on purpose' };
  if (Number(lock.pid) !== Number(parentPid)) return { action: 'none', reason: 'lock belongs to another session' };
  const backup = read(path.join(dataDir, 'color-backup.json')) || { displays: {} };
  if (!backend.platform.supported) return { action: 'none', reason: backend.platform.reason };
  const current = backend.listDisplays();
  const restored = [], failed = [];
  for (const [key, gdi] of Object.entries(lock.displays || {})) {
    const b = backup.displays && backup.displays[key];
    const ramp = b && M.rampFromJSON(b.ramp);
    if (!ramp) { failed.push(key); continue; }
    const d = current.find((x) => x.key === key);
    (backend.setRamp(d ? d.gdiName : gdi, ramp).ok ? restored : failed).push(key);
  }
  if (lock.matrix) { backend.matrix.set(M.identityMatrix()); backend.matrix.shutdown(); }
  try { fs.unlinkSync(lockFile); } catch (e) { /* already gone */ }
  return { action: 'restored', restored, failed };
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

if (require.main === module) {
  const parentPid = Number(process.argv[2]);
  const dataDir = process.argv[3];
  if (!parentPid || !dataDir) process.exit(2);
  const timer = setInterval(() => {
    if (alive(parentPid)) return;
    clearInterval(timer);
    try { restoreFromLock({ dataDir, parentPid, backend: require('./win32.js').create() }); } finally { process.exit(0); }
  }, 500);
}

module.exports = { restoreFromLock };
