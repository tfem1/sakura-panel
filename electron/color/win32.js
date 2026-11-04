/* SAKURA PANEL — Windows display backend (documented Win32 APIs only, via koffi FFI).
 *
 *  user32  EnumDisplayDevicesW, EnumDisplaySettingsW            monitor enumeration, current mode
 *  user32  GetDisplayConfigBufferSizes, QueryDisplayConfig,
 *          DisplayConfigGetDeviceInfo                           friendly names, device paths, HDR state
 *  gdi32   CreateDCW, DeleteDC, Get/SetDeviceGammaRamp          per-monitor hardware gamma ramp
 *  Magnification  MagInitialize, MagSet/GetFullscreenColorEffect, MagUninitialize
 *                                                              system-wide 5x5 colour matrix (DWM)
 *
 * Every call reports failure; nothing here returns success without the API saying so.
 */
const crypto = require('crypto');

function unsupported(reason) {
  return {
    platform: { supported: false, reason },
    listDisplays: () => [],
    getRamp: () => ({ ok: false, error: reason }),
    setRamp: () => ({ ok: false, error: reason }),
    gpus: () => [],
    matrix: { available: () => ({ ok: false, reason }), set: () => ({ ok: false, error: reason }), get: () => ({ ok: false, error: reason }), shutdown() {} },
  };
}

function create() {
  if (process.platform !== 'win32') return unsupported('Display colour control needs Windows. This build is running on ' + process.platform + '.');
  let koffi;
  try { koffi = require('koffi'); } catch (e) { return unsupported('The native bridge (koffi) failed to load: ' + e.message); }

  const user32 = koffi.load('user32.dll');
  const gdi32 = koffi.load('gdi32.dll');
  const kernel32 = koffi.load('kernel32.dll');

  const EnumDisplayDevicesW = user32.func('int __stdcall EnumDisplayDevicesW(const char16_t *lpDevice, uint32_t iDevNum, void *lpDisplayDevice, uint32_t dwFlags)');
  const EnumDisplaySettingsW = user32.func('int __stdcall EnumDisplaySettingsW(const char16_t *lpszDeviceName, uint32_t iModeNum, void *lpDevMode)');
  const GetDisplayConfigBufferSizes = user32.func('int32_t __stdcall GetDisplayConfigBufferSizes(uint32_t flags, uint32_t *numPathArrayElements, uint32_t *numModeInfoArrayElements)');
  const QueryDisplayConfig = user32.func('int32_t __stdcall QueryDisplayConfig(uint32_t flags, uint32_t *numPathArrayElements, void *pathArray, uint32_t *numModeInfoArrayElements, void *modeInfoArray, void *currentTopologyId)');
  const DisplayConfigGetDeviceInfo = user32.func('int32_t __stdcall DisplayConfigGetDeviceInfo(void *requestPacket)');
  const CreateDCW = gdi32.func('void *__stdcall CreateDCW(const char16_t *pwszDriver, const char16_t *pwszDevice, void *pdm, void *pip)');
  const DeleteDC = gdi32.func('int __stdcall DeleteDC(void *hdc)');
  const SetDeviceGammaRamp = gdi32.func('int __stdcall SetDeviceGammaRamp(void *hdc, void *lpRamp)');
  const GetDeviceGammaRamp = gdi32.func('int __stdcall GetDeviceGammaRamp(void *hdc, void *lpRamp)');
  const GetLastError = kernel32.func('uint32_t __stdcall GetLastError()');

  const wstr = (buf, off, bytes) => buf.toString('utf16le', off, off + bytes).split('\0')[0];
  const lastError = () => { try { return GetLastError(); } catch (e) { return 0; } };

  /* ---------------- DISPLAY_DEVICEW (840 bytes) ---------------- */
  const DD_SIZE = 840;
  function displayDevice(name, index, flags) {
    const b = Buffer.alloc(DD_SIZE);
    b.writeUInt32LE(DD_SIZE, 0);
    if (!EnumDisplayDevicesW(name, index, b, flags)) return null;
    return { deviceName: wstr(b, 4, 64), deviceString: wstr(b, 68, 256), stateFlags: b.readUInt32LE(324), deviceId: wstr(b, 328, 256) };
  }

  /* ---------------- DEVMODEW (220 bytes) ---------------- */
  const DM_SIZE = 220;
  function currentMode(gdiName) {
    const b = Buffer.alloc(DM_SIZE);
    b.writeUInt16LE(DM_SIZE, 68); // dmSize
    if (!EnumDisplaySettingsW(gdiName, 0xFFFFFFFF /* ENUM_CURRENT_SETTINGS */, b)) return null;
    return {
      x: b.readInt32LE(76), y: b.readInt32LE(80), orientation: b.readUInt32LE(84),
      bitsPerPixel: b.readUInt32LE(168), width: b.readUInt32LE(172), height: b.readUInt32LE(176), refresh: b.readUInt32LE(184),
    };
  }

  /* ---------------- DisplayConfig: names, device paths, advanced colour ---------------- */
  const QDC_ONLY_ACTIVE_PATHS = 2;
  function deviceInfo(type, size, adapterLow, adapterHigh, id) {
    const b = Buffer.alloc(size);
    b.writeUInt32LE(type, 0); b.writeUInt32LE(size, 4);
    b.writeUInt32LE(adapterLow, 8); b.writeInt32LE(adapterHigh, 12); b.writeUInt32LE(id, 16);
    const rc = DisplayConfigGetDeviceInfo(b);
    return rc === 0 ? b : null;
  }
  function displayConfig() {
    const byGdi = {};
    for (let attempt = 0; attempt < 3; attempt++) {
      const np = new Uint32Array(1), nm = new Uint32Array(1);
      if (GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, np, nm) !== 0) return byGdi;
      const paths = Buffer.alloc(np[0] * 72), modes = Buffer.alloc(nm[0] * 64);
      const rc = QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS, np, paths, nm, modes, null);
      if (rc === 122 /* ERROR_INSUFFICIENT_BUFFER */) continue;
      if (rc !== 0) return byGdi;
      for (let i = 0; i < np[0]; i++) {
        const o = i * 72;
        const sLow = paths.readUInt32LE(o), sHigh = paths.readInt32LE(o + 4), sId = paths.readUInt32LE(o + 8);
        const tLow = paths.readUInt32LE(o + 20), tHigh = paths.readInt32LE(o + 24), tId = paths.readUInt32LE(o + 28);
        const src = deviceInfo(1 /* GET_SOURCE_NAME */, 84, sLow, sHigh, sId);
        if (!src) continue;
        const gdi = wstr(src, 20, 64);
        const tgt = deviceInfo(2 /* GET_TARGET_NAME */, 420, tLow, tHigh, tId);
        const adv = deviceInfo(9 /* GET_ADVANCED_COLOR_INFO */, 32, tLow, tHigh, tId);
        const entry = byGdi[gdi] || (byGdi[gdi] = { names: [], paths: [], hdr: null });
        if (tgt) { entry.names.push(wstr(tgt, 36, 128)); entry.paths.push(wstr(tgt, 164, 256)); }
        if (adv) {
          const v = adv.readUInt32LE(20);
          entry.hdr = { supported: !!(v & 1), enabled: !!(v & 2), bitsPerChannel: adv.readUInt32LE(28), encoding: adv.readUInt32LE(24) };
        }
      }
      return byGdi;
    }
    return byGdi;
  }

  /* ---------------- monitors ---------------- */
  function listDisplays() {
    const cfg = (() => { try { return displayConfig(); } catch (e) { return {}; } })();
    const out = [];
    for (let i = 0; i < 32; i++) {
      const ad = displayDevice(null, i, 0);
      if (!ad) break;
      if (!(ad.stateFlags & 0x1 /* ATTACHED_TO_DESKTOP */)) continue;
      const mon = displayDevice(ad.deviceName, 0, 0x1 /* EDD_GET_DEVICE_INTERFACE_NAME */);
      const mode = currentMode(ad.deviceName) || {};
      const c = cfg[ad.deviceName] || { names: [], paths: [], hdr: null };
      const stableId = c.paths[0] || (mon && mon.deviceId) || ad.deviceName;
      out.push({
        key: 'm' + crypto.createHash('sha1').update(stableId.toLowerCase()).digest('hex').slice(0, 12),
        gdiName: ad.deviceName,
        name: c.names.filter(Boolean).join(' + ') || (mon && mon.deviceString) || ad.deviceName,
        adapter: ad.deviceString,
        adapterId: ad.deviceId,
        primary: !!(ad.stateFlags & 0x4),
        width: mode.width || 0, height: mode.height || 0, refresh: mode.refresh || 0, x: mode.x || 0, y: mode.y || 0,
        hdr: c.hdr,
      });
    }
    return out;
  }

  /* ---------------- gamma ramp ---------------- */
  function withDC(gdiName, fn) {
    const hdc = CreateDCW(gdiName, null, null, null);
    if (!hdc) return { ok: false, error: `CreateDC failed for ${gdiName} (Win32 error ${lastError()})` };
    try { return fn(hdc); } finally { DeleteDC(hdc); }
  }
  function getRamp(gdiName) {
    return withDC(gdiName, (hdc) => {
      const buf = new Uint16Array(768);
      if (!GetDeviceGammaRamp(hdc, buf)) return { ok: false, error: `GetDeviceGammaRamp failed (Win32 error ${lastError()})` };
      return { ok: true, ramp: { r: buf.slice(0, 256), g: buf.slice(256, 512), b: buf.slice(512, 768) } };
    });
  }
  function setRamp(gdiName, ramp) {
    return withDC(gdiName, (hdc) => {
      const buf = new Uint16Array(768);
      buf.set(ramp.r, 0); buf.set(ramp.g, 256); buf.set(ramp.b, 512);
      if (!SetDeviceGammaRamp(hdc, buf)) return { ok: false, error: `Windows rejected the gamma ramp (SetDeviceGammaRamp returned FALSE, Win32 error ${lastError()})` };
      return { ok: true };
    });
  }

  function gpus() {
    const seen = new Map();
    for (let i = 0; i < 32; i++) {
      const ad = displayDevice(null, i, 0);
      if (!ad) break;
      if (!ad.deviceString || seen.has(ad.deviceString)) continue;
      const ven = (/VEN_([0-9A-F]{4})/i.exec(ad.deviceId) || [])[1];
      const vendor = { '10DE': 'NVIDIA', '1002': 'AMD', '8086': 'Intel', '1414': 'Microsoft' }[(ven || '').toUpperCase()] || 'Unknown';
      seen.set(ad.deviceString, { name: ad.deviceString, vendor, vendorId: ven || null });
    }
    return [...seen.values()];
  }

  /* ---------------- Magnification colour matrix ---------------- */
  let mag = null, magState = 'idle', magReason = '';
  function magLoad() {
    if (mag || magState === 'failed') return !!mag;
    try {
      const lib = koffi.load('Magnification.dll');
      mag = {
        init: lib.func('int __stdcall MagInitialize()'),
        uninit: lib.func('int __stdcall MagUninitialize()'),
        set: lib.func('int __stdcall MagSetFullscreenColorEffect(void *pEffect)'),
        get: lib.func('int __stdcall MagGetFullscreenColorEffect(void *pEffect)'),
      };
      if (!mag.init()) { magState = 'failed'; magReason = `MagInitialize failed (Win32 error ${lastError()}). Is Windows Magnifier running?`; mag = null; return false; }
      magState = 'ready';
      return true;
    } catch (e) {
      magState = 'failed'; magReason = 'Magnification.dll is not available on this Windows edition (' + e.message + ').'; mag = null; return false;
    }
  }
  const matrix = {
    available() { return magLoad() ? { ok: true } : { ok: false, reason: magReason }; },
    set(T) {
      if (!magLoad()) return { ok: false, error: magReason };
      if (!mag.set(T)) return { ok: false, error: `MagSetFullscreenColorEffect returned FALSE (Win32 error ${lastError()})` };
      return { ok: true };
    },
    get() {
      if (!magLoad()) return { ok: false, error: magReason };
      const T = new Float32Array(25);
      if (!mag.get(T)) return { ok: false, error: `MagGetFullscreenColorEffect returned FALSE (Win32 error ${lastError()})` };
      return { ok: true, matrix: T };
    },
    shutdown() { if (mag) { try { mag.uninit(); } catch (e) { /* ignore */ } mag = null; magState = 'idle'; } },
  };

  return { platform: { supported: true }, listDisplays, getRamp, setRamp, gpus, matrix };
}

module.exports = { create, unsupported };
