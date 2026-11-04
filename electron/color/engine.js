/* SAKURA PANEL — display colour engine (main process).
 *
 * Responsibilities:
 *  - Turn settings into a per-monitor gamma ramp and a global colour matrix (color-math.js).
 *  - Push them to Windows through the backend (win32.js), check every return value,
 *    and verify by reading the ramp / matrix back from the system.
 *  - Back up each monitor's original ramp before the first change and restore it on demand,
 *    on exit, and after a crash (session lock file + watchdog).
 *  - Re-apply after monitor connect/disconnect, resolution or refresh changes and resume.
 *
 * Results are reported per display and per stage; failures are never reported as success.
 */
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const M = require('../../src/js/color-math.js');

const VERIFY_TOLERANCE = 512; // out of 65535: drivers may quantise ramps to 8-10 bits
const ATTENUATION_STEPS = [0.75, 0.5, 0.25];

const MSG = {
  hdr: 'HDR / Advanced Color is on for this display. Windows does not apply hardware gamma ramps in this mode, so these adjustments cannot take effect. Turn HDR off in Windows Settings › System › Display to use them.',
  limited: (pct) => `Windows only accepted ${pct}% of this adjustment. It refuses gamma ramps that move too far from neutral, so the strongest accepted version was applied.`,
  mismatch: (d) => `The display driver reports a different ramp than the one written (max difference ${d}/65535). Another program (Night light, f.lux, a calibration loader) may be overriding it.`,
  matrixMismatch: 'Windows reports a different colour matrix than the one written. Another program (Windows Magnifier or a colour filter tool) may be using it.',
  disconnected: 'This display is not connected. Its settings are kept and will be applied when it is reconnected.',
};

class ColorEngine extends EventEmitter {
  constructor({ backend, dataDir, setTimer = setTimeout, clearTimer = clearTimeout }) {
    super();
    this.backend = backend;
    this.dir = dataDir;
    this.setTimer = setTimer; this.clearTimer = clearTimer;
    this.files = {
      backup: path.join(dataDir, 'color-backup.json'),
      lock: path.join(dataDir, 'color-session.json'),
      config: path.join(dataDir, 'color-config.json'),
    };
    this.displays = [];
    this.backup = {};          // key -> { gdiName, name, ramp, captured }
    this.lastWritten = {};     // key -> ramp currently written by us
    this.active = new Set();   // keys whose ramp differs from the original
    this.matrixActive = false;
    this.lastMatrix = null;
    this.config = { displays: {}, global: { ...M.GLOBAL_DEFAULTS } };
    this.bypass = false;
    this.lastResults = null;
    this.recovered = null;
    this.pending = null; this.waiters = []; this.timer = null; this.lastApplyAt = 0;
  }

  /* ---------------- persistence ---------------- */
  readJSON(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; } }
  writeJSON(file, data) {
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file); // atomic replace: a crash never leaves a half-written backup
  }
  saveBackup() {
    const displays = {};
    for (const [k, v] of Object.entries(this.backup)) displays[k] = { gdiName: v.gdiName, name: v.name, captured: v.captured, ramp: M.rampToJSON(v.ramp) };
    this.writeJSON(this.files.backup, { version: 1, displays });
  }
  writeLock(keep = false) {
    if (!this.active.size && !this.matrixActive) { this.removeLock(); return; }
    const displays = {};
    for (const k of this.active) { const d = this.byKey(k); displays[k] = d ? d.gdiName : (this.backup[k] && this.backup[k].gdiName); }
    this.writeJSON(this.files.lock, { pid: process.pid, keep, displays, matrix: this.matrixActive, updatedAt: new Date().toISOString() });
  }
  removeLock() { try { fs.unlinkSync(this.files.lock); } catch (e) { /* none */ } }
  saveConfig(cfg) { this.writeJSON(this.files.config, cfg); }
  loadConfig() { return this.normalizeConfig(this.readJSON(this.files.config, null)); }

  normalizeConfig(cfg) {
    const out = { displays: {}, global: M.sanitizeGlobal(cfg && cfg.global) };
    const ds = (cfg && cfg.displays) || {};
    for (const [k, v] of Object.entries(ds)) {
      if (!/^[\w-]{1,40}$/.test(k) || !v || typeof v !== 'object') continue;
      out.displays[k] = { enabled: v.enabled !== false, tone: M.sanitizeTone(v.tone) };
    }
    return out;
  }

  byKey(k) { return this.displays.find((d) => d.key === k); }

  /* ---------------- lifecycle ---------------- */
  init() {
    if (!this.backend.platform.supported) return { supported: false, reason: this.backend.platform.reason };
    const saved = this.readJSON(this.files.backup, { displays: {} });
    for (const [k, v] of Object.entries(saved.displays || {})) {
      const ramp = M.rampFromJSON(v.ramp);
      if (ramp) this.backup[k] = { gdiName: v.gdiName, name: v.name, captured: v.captured !== false, ramp };
    }
    this.displays = this.backend.listDisplays();

    // Crash recovery: a lock file left behind means the last session did not shut down cleanly.
    const lock = this.readJSON(this.files.lock, null);
    if (lock && !lock.keep) {
      const restored = [], failed = [];
      for (const [k, gdi] of Object.entries(lock.displays || {})) {
        const b = this.backup[k];
        const d = this.byKey(k);
        if (!b) { failed.push({ key: k, error: 'no backup' }); continue; }
        const r = this.backend.setRamp(d ? d.gdiName : gdi, b.ramp);
        (r.ok ? restored : failed).push({ key: k, name: b.name, error: r.error });
      }
      if (lock.matrix) this.backend.matrix.set(M.identityMatrix());
      this.removeLock();
      this.recovered = { at: lock.updatedAt, restored, failed };
    } else if (lock && lock.keep) {
      // Adjustments were intentionally kept at last exit: those displays are still modified.
      for (const k of Object.keys(lock.displays || {})) this.active.add(k);
    }
    return { supported: true, recovered: this.recovered };
  }

  refreshDisplays() {
    const before = new Map(this.displays.map((d) => [d.key, d]));
    this.displays = this.backend.listDisplays();
    const after = new Map(this.displays.map((d) => [d.key, d]));
    const added = [...after.keys()].filter((k) => !before.has(k));
    const removed = [...before.keys()].filter((k) => !after.has(k));
    for (const k of removed) { delete this.lastWritten[k]; }
    return { added, removed };
  }

  ensureBackup(d) {
    if (this.backup[d.key]) return this.backup[d.key];
    // Never capture a ramp we modified ourselves (e.g. kept from a previous session).
    if (this.active.has(d.key)) {
      this.backup[d.key] = { gdiName: d.gdiName, name: d.name, captured: false, ramp: M.identityRamp() };
    } else {
      const r = this.backend.getRamp(d.gdiName);
      this.backup[d.key] = { gdiName: d.gdiName, name: d.name, captured: r.ok, ramp: r.ok ? r.ramp : M.identityRamp() };
    }
    this.saveBackup();
    return this.backup[d.key];
  }

  /* ---------------- core apply ---------------- */
  applyRampStage(d, entry, opts) {
    const base = this.ensureBackup(d).ramp;
    const wantsChange = entry && entry.enabled && !M.isNeutralTone(entry.tone);
    const res = { name: d.name, status: 'original', verified: null, strength: 1, message: '' };

    if (wantsChange && d.hdr && d.hdr.enabled) {
      res.status = 'unavailable'; res.message = MSG.hdr;
      // Make sure nothing we wrote earlier lingers while the display is in HDR.
      if (this.active.has(d.key)) { this.backend.setRamp(d.gdiName, base); this.active.delete(d.key); delete this.lastWritten[d.key]; }
      return res;
    }

    const target = this.bypass || !wantsChange ? base : M.buildRamp(entry.tone, base);
    const prev = this.lastWritten[d.key];
    // Only write to displays we change or have changed before; never touch an untouched monitor.
    const involved = wantsChange || this.active.has(d.key) || !!prev;
    const unchanged = !!prev && M.maxRampDiff(prev, target) === 0;
    if (involved && (opts.force || !unchanged)) {
      let r = this.backend.setRamp(d.gdiName, target);
      let written = target;
      if (!r.ok && target !== base) {
        for (const t of ATTENUATION_STEPS) {
          const softer = M.blendRamp(base, target, t);
          const rr = this.backend.setRamp(d.gdiName, softer);
          if (rr.ok) { r = rr; written = softer; res.strength = t; break; }
        }
        if (!r.ok) { res.status = 'failed'; res.message = r.error; return res; }
      } else if (!r.ok) { res.status = 'failed'; res.message = r.error; return res; }
      this.lastWritten[d.key] = written;
    }

    const isOriginal = target === base || M.maxRampDiff(this.lastWritten[d.key] || base, base) === 0;
    if (isOriginal) this.active.delete(d.key); else this.active.add(d.key);
    res.status = this.bypass ? 'compare' : isOriginal ? 'original' : res.strength < 1 ? 'limited' : 'applied';
    if (res.status === 'limited') res.message = MSG.limited(Math.round(res.strength * 100));

    if (opts.verify && this.lastWritten[d.key]) {
      const rb = this.backend.getRamp(d.gdiName);
      if (!rb.ok) { res.verified = false; res.message = (res.message ? res.message + ' ' : '') + 'Read-back failed: ' + rb.error; }
      else {
        const diff = M.maxRampDiff(rb.ramp, this.lastWritten[d.key]);
        res.verified = diff <= VERIFY_TOLERANCE;
        if (!res.verified) { res.status = 'mismatch'; res.message = MSG.mismatch(diff); }
      }
    }
    return res;
  }

  applyMatrixStage(global, opts) {
    const target = this.bypass ? M.identityMatrix() : M.buildMatrix(global);
    const identity = M.isIdentityMatrix(target);
    const res = { status: identity ? 'original' : 'applied', verified: null, message: '' };
    if (identity && !this.matrixActive && !this.lastMatrix) return res; // never used: leave Magnification alone
    const avail = this.backend.matrix.available();
    if (!avail.ok) {
      res.status = identity ? 'original' : 'unavailable'; res.message = identity ? '' : avail.reason;
      return res;
    }
    const unchanged = this.lastMatrix && M.matrixDiff(this.lastMatrix, target) < 1e-7;
    if (!unchanged || opts.force) {
      const r = this.backend.matrix.set(target);
      if (!r.ok) { res.status = 'failed'; res.message = r.error; return res; }
      this.lastMatrix = target;
    }
    this.matrixActive = !identity;
    if (this.bypass) res.status = 'compare';
    if (opts.verify) {
      const rb = this.backend.matrix.get();
      res.verified = rb.ok && M.matrixDiff(rb.matrix, target) < 1e-4;
      if (!rb.ok) res.message = 'Read-back failed: ' + rb.error;
      else if (!res.verified) { res.status = 'mismatch'; res.message = MSG.matrixMismatch; }
    }
    return res;
  }

  apply(cfgIn, opts = {}) {
    if (!this.backend.platform.supported) {
      return this.publish({ ok: false, supported: false, reason: this.backend.platform.reason, displays: {}, matrix: { status: 'unavailable', message: this.backend.platform.reason } });
    }
    const cfg = this.normalizeConfig(cfgIn);
    if (!opts.transient) this.config = cfg;
    const displays = {};
    for (const d of this.displays) {
      try { displays[d.key] = this.applyRampStage(d, cfg.displays[d.key], opts); }
      catch (e) { displays[d.key] = { name: d.name, status: 'failed', message: e.message, verified: false }; }
    }
    for (const k of Object.keys(cfg.displays)) {
      if (!displays[k]) displays[k] = { name: (this.backup[k] && this.backup[k].name) || 'Display', status: 'disconnected', message: MSG.disconnected };
    }
    let matrix;
    try { matrix = this.applyMatrixStage(cfg.global, opts); } catch (e) { matrix = { status: 'failed', message: e.message, verified: false }; }
    this.writeLock();
    this.lastApplyAt = Date.now();
    const bad = (s) => s === 'failed' || s === 'mismatch' || s === 'unavailable';
    const ok = !Object.values(displays).some((r) => bad(r.status)) && !bad(matrix.status);
    return this.publish({ ok, supported: true, bypass: this.bypass, displays, matrix, at: new Date().toISOString() });
  }

  publish(results) { this.lastResults = results; this.emit('results', results); return results; }

  /** Live preview: coalesces rapid slider updates to at most one Windows update per ~16 ms. */
  preview(cfg) {
    this.pending = cfg;
    const p = new Promise((resolve) => this.waiters.push(resolve));
    if (!this.timer) {
      const wait = Math.max(0, 16 - (Date.now() - this.lastApplyAt));
      this.timer = this.setTimer(() => {
        this.timer = null;
        const c = this.pending; this.pending = null;
        const waiters = this.waiters; this.waiters = [];
        const r = this.apply(c);
        waiters.forEach((w) => w(r));
      }, wait);
    }
    return p;
  }

  /** Apply + verify by read-back, then persist as the configuration restored at startup. */
  commit(cfg) {
    if (this.timer) { this.clearTimer(this.timer); this.timer = null; this.pending = null; }
    const r = this.apply(cfg, { verify: true, force: true });
    this.waiters.splice(0).forEach((w) => w(r));
    if (r.supported) this.saveConfig(this.config);
    return r;
  }

  /** A/B comparison against the real original output (true = show original). */
  compare(on) {
    this.bypass = !!on;
    return this.apply(this.config, { force: true, transient: true });
  }

  /** Puts every display back exactly as it was before SAKURA PANEL touched it. */
  restoreOriginal() {
    this.bypass = false;
    const neutral = { displays: {}, global: { ...M.GLOBAL_DEFAULTS } };
    for (const d of this.displays) neutral.displays[d.key] = { enabled: true, tone: { ...M.TONE_DEFAULTS } };
    const r = this.apply(neutral, { verify: true, force: true });
    if (r.supported) this.saveConfig(this.config);
    return r;
  }

  /** Monitor added/removed, resolution/refresh change, resume: Windows may reset ramps. */
  handleDisplayChange() {
    if (!this.backend.platform.supported) return null;
    const change = this.refreshDisplays();
    this.lastWritten = {};
    const r = this.apply(this.config, { verify: true, force: true });
    r.change = change;
    return r;
  }

  status() {
    const b = this.backend;
    return {
      supported: b.platform.supported,
      reason: b.platform.reason || '',
      displays: this.displays.map((d) => ({
        key: d.key, name: d.name, adapter: d.adapter, primary: d.primary, width: d.width, height: d.height, refresh: d.refresh,
        hdr: d.hdr, backup: !!this.backup[d.key], backupCaptured: this.backup[d.key] ? this.backup[d.key].captured : null,
        rampAvailable: !(d.hdr && d.hdr.enabled),
      })),
      gpus: b.gpus ? b.gpus() : [],
      matrix: b.platform.supported ? b.matrix.available() : { ok: false, reason: b.platform.reason },
      recovered: this.recovered,
      config: this.config,
      lastResults: this.lastResults,
    };
  }

  /**
   * Exit policy. 'restore' (default): put every display back to its original state.
   * 'keep': leave hardware gamma ramps in place (they survive the process); the colour
   * matrix always ends with the process, so it is reset either way.
   */
  shutdown(policy = 'restore') {
    if (!this.backend.platform.supported) return;
    if (this.timer) { this.clearTimer(this.timer); this.timer = null; }
    this.bypass = false;
    if (this.matrixActive) { this.backend.matrix.set(M.identityMatrix()); this.matrixActive = false; }
    if (policy === 'keep' && this.active.size) {
      this.writeLock(true);
    } else {
      for (const k of [...this.active]) {
        const d = this.byKey(k); const b = this.backup[k];
        if (d && b) this.backend.setRamp(d.gdiName, b.ramp);
      }
      this.active.clear();
      this.removeLock();
    }
    this.backend.matrix.shutdown();
  }
}

module.exports = { ColorEngine, VERIFY_TOLERANCE, MSG };
