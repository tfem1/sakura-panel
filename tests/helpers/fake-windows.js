/* Simulated Windows display stack shared by the engine and UI tests. */
const M = require('../../src/js/color-math.js');

function calibration() { const r = M.identityRamp(); for (let i = 0; i < 256; i++) r.b[i] = Math.round(i * 257 * 0.96); return r; }
const copy = (r) => ({ r: Uint16Array.from(r.r), g: Uint16Array.from(r.g), b: Uint16Array.from(r.b) });

class FakeWindows {
  constructor({ displays = 2, rejectBeyond = null, magAvailable = true } = {}) {
    this.platform = { supported: true };
    this.rejectBeyond = rejectBeyond; // emulate Windows refusing extreme ramps
    this.monitors = [];
    for (let i = 0; i < displays; i++) this.monitors.push({ key: 'mon' + i, gdiName: `\\\\.\\DISPLAY${i + 1}`, name: `Monitor ${i + 1}`, primary: i === 0, width: 2560, height: 1440, refresh: 144, hdr: { supported: true, enabled: false, bitsPerChannel: 8 } });
    this.factory = Object.fromEntries(this.monitors.map((m, i) => [m.gdiName, i === 0 ? calibration() : M.identityRamp()]));
    this.lut = Object.fromEntries(Object.entries(this.factory).map(([k, v]) => [k, copy(v)]));
    this.overrideOn = null; // gdiName whose writes get replaced (another app fighting)
    this.writes = 0;
    this.mag = { available: magAvailable, m: M.identityMatrix(), sets: 0 };
    const self = this;
    this.matrix = {
      available: () => (self.mag.available ? { ok: true } : { ok: false, reason: 'Magnification unavailable' }),
      set: (T) => { if (!self.mag.available) return { ok: false, error: 'nope' }; self.mag.m = Float32Array.from(T); self.mag.sets++; return { ok: true }; },
      get: () => ({ ok: true, matrix: Float32Array.from(self.mag.m) }),
      shutdown() {},
    };
  }
  listDisplays() { return this.monitors.map((m) => ({ ...m })); }
  connected(gdi) { return this.monitors.some((m) => m.gdiName === gdi); }
  getRamp(gdi) { return this.connected(gdi) ? { ok: true, ramp: copy(this.lut[gdi]) } : { ok: false, error: 'CreateDC failed' }; }
  setRamp(gdi, ramp) {
    if (!this.connected(gdi)) return { ok: false, error: 'CreateDC failed' };
    if (this.rejectBeyond != null && M.maxRampDiff(ramp, M.identityRamp()) > this.rejectBeyond) return { ok: false, error: 'Windows rejected the gamma ramp' };
    this.writes++;
    this.lut[gdi] = this.overrideOn === gdi ? M.identityRamp() : copy(ramp);
    return { ok: true };
  }
  modeChangeResetsLuts() { for (const m of this.monitors) this.lut[m.gdiName] = copy(this.factory[m.gdiName]); }
  gpus() { return [{ name: 'Fake GPU', vendor: 'NVIDIA' }]; }
}


module.exports = { FakeWindows, calibration, copy };
