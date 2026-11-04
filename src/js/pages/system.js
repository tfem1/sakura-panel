/* System Settings — app behaviour, interface preferences, data, about. */
(function () {
  const SP = window.SP;
  const { h, icon } = SP.ui;
  const VERSION = '1.0.0';

  SP.pages.push({
    id: 'system', title: 'System Settings', group: 'system', icon: 'gear',
    search: ['Start with Windows', 'Minimize to tray', 'When SAKURA PANEL quits', 'Start page', 'Interface detail', 'Animations', 'Interface scale', 'Notifications', 'Automatic updates', 'Export settings', 'Reset all settings', 'About'],
    render(root) {
      root.append(SP.ui.pageHeader({ eyebrow: 'System', title: 'System Settings', desc: 'How SAKURA PANEL starts and behaves. These preferences apply immediately.' }));

      const pages = SP.pages.map((p) => [p.id, p.title]);
      const app = SP.ui.card({ icon: 'gear', title: 'Application', body: [
        SP.ui.row({ path: 'system.startWithWindows', label: 'Start with Windows', desc: 'Launch minimised when you sign in.', control: SP.ui.toggle({ path: 'system.startWithWindows', label: 'Start with Windows' }) }),
        SP.ui.row({ path: 'system.tray', label: 'Minimize to tray', desc: 'Closing the window keeps SAKURA PANEL in the notification area.', control: SP.ui.toggle({ path: 'system.tray', label: 'Minimize to tray' }) }),
        SP.ui.row({ path: 'system.colorOnExit', label: 'When SAKURA PANEL quits', desc: 'Restore puts every display back to its original colours. Keep leaves the per-display gamma adjustments in place; the global colour matrix (saturation, vibrance, hue) always ends with the app, so keep it running in the tray to keep those.', control: SP.ui.segmented({ path: 'system.colorOnExit', label: 'When SAKURA PANEL quits', options: [['restore', 'Restore colours'], ['keep', 'Keep gamma']] }) }),
        SP.ui.row({ path: 'system.startPage', label: 'Start page', control: SP.ui.select({ path: 'system.startPage', label: 'Start page', options: pages }) }),
      ] });

      const ui = SP.ui.card({ icon: 'sparkle', title: 'Interface', body: [
        SP.ui.row({ path: 'system.view', label: 'Interface detail', desc: 'Simple hides expert controls. Search always finds them.', control: SP.ui.segmented({ path: 'system.view', label: 'Interface detail', options: [['simple', 'Simple'], ['advanced', 'Advanced']] }) }),
        SP.ui.row({ path: 'system.motion', label: 'Animations', desc: 'Reduced keeps feedback but shortens motion.', control: SP.ui.segmented({ path: 'system.motion', label: 'Animations', options: [['full', 'Full'], ['reduced', 'Reduced'], ['off', 'Off']] }) }),
        SP.ui.row({ path: 'system.scale', label: 'Interface scale', control: SP.ui.select({ path: 'system.scale', label: 'Interface scale', options: [[90, '90%'], [100, '100% (recommended)'], [110, '110%'], [125, '125%']] }) }),
      ] });

      const notif = SP.ui.card({ icon: 'info', title: 'Notifications & updates', body: [
        SP.ui.row({ path: 'system.notifications', label: 'Notifications', desc: 'Profile switches and thermal warnings.', control: SP.ui.toggle({ path: 'system.notifications', label: 'Notifications' }) }),
        SP.ui.row({ path: 'system.updates', label: 'Automatic updates', control: SP.ui.toggle({ path: 'system.updates', label: 'Automatic updates' }) }),
      ] });

      const data = SP.ui.card({ icon: 'folder', title: 'Data', body: [
        SP.ui.row({ label: 'Export settings', desc: 'Applied settings and the active theme as JSON.', control: SP.ui.button('Export', { icon: 'download', onClick: () => {
          const blob = new Blob([JSON.stringify(SP.state.exportAll(), null, 2)], { type: 'application/json' });
          const a = h('a', { href: URL.createObjectURL(blob), download: 'sakura-panel-settings.json' });
          document.body.appendChild(a); a.click(); a.remove();
          SP.ui.toast('Settings exported');
        } }) }),
        SP.ui.row({ label: 'Reset all settings', desc: 'Restores every page to defaults. Themes are not affected.', control: SP.ui.button('Reset…', { variant: 'danger', icon: 'reset', onClick: async () => {
          if (await SP.ui.dialog({ title: 'Reset all settings?', body: 'Every display, 3D, profile and performance setting returns to its default.', confirmText: 'Reset', danger: true })) {
            SP.state.resetAll(); SP.ui.toast('All settings reset');
          }
        } }) }),
      ] });

      const about = h('section', { class: 'sp-card sp-about', 'data-search': 'About' },
        h('div', { class: 'sp-about-logo' }, SP.ui.mark(64), h('div', { class: 'sp-about-word' }, h('b', null, 'SAKURA'), h('span', null, 'PANEL')), h('small', null, 'Graphics control · Version ' + VERSION)),
        h('div', { class: 'sp-about-icons' },
          h('figure', null, h('img', { src: 'assets/app-icon.svg', width: 56, height: 56, alt: 'Application icon' }), h('figcaption', null, 'App icon')),
          h('figure', null, h('img', { src: 'assets/app-icon-small.svg', width: 32, height: 32, alt: 'Small application icon' }), h('figcaption', null, 'Small')),
          h('figure', null, h('img', { src: 'assets/taskbar-icon.svg', width: 24, height: 24, alt: 'Taskbar icon' }), h('figcaption', null, 'Taskbar'))),
        h('p', { class: 'sp-muted' }, 'Display colour is applied through Windows (hardware gamma ramp per display, compositor colour matrix for all displays). 3D, display-mode, profile and performance controls and GPU telemetry are not connected to a driver yet.'));

      root.append(h('div', { class: 'sp-grid sp-grid-2' }, h('div', { class: 'sp-stack' }, app, ui), h('div', { class: 'sp-stack' }, notif, data, about)));
    },
  });
})();
