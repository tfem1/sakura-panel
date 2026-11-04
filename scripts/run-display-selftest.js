/* Runs the hardware display self-test on Windows: `npm run test:display`.
 * Starts Electron in --selftest mode (no window), which applies every adjustment to the
 * real displays, reads the result back from Windows, prints a report and restores the
 * original colours. Close SAKURA PANEL first (tray > Quit).
 */
const { spawn } = require('child_process');
const path = require('path');

if (process.platform !== 'win32') {
  console.log('The display self-test needs Windows (it drives the real display hardware).');
  process.exit(2);
}
const electron = require('electron');
const child = spawn(electron, [path.resolve(__dirname, '..'), '--selftest'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
child.stdout.on('data', (d) => process.stdout.write(d));
child.stderr.on('data', (d) => { const s = String(d); if (!/^\[\d+:\d+\//.test(s)) process.stderr.write(s); });
child.on('exit', (code) => {
  console.log(code === 0 ? '\nDisplay self-test passed.' : code === 3 ? '\nQuit SAKURA PANEL first, then run again.' : '\nDisplay self-test reported failures (see above).');
  process.exit(code || 0);
});
