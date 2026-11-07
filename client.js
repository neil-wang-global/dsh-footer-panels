/**
 * Footer-overlay plugins → first-class sidebar panel entries.
 *
 * WHY THIS EXISTS
 * ---------------
 * pomasa-studio and dsh-pictor both draw their workbench on the `shell.overlay`
 * layer and toggle it from a `sidebar.footer.action` button. dsh-claude-style
 * performs a "footer takeover": it clones every footer-action node into the
 * account popover and hides the originals. Those clones cannot be mapped back
 * to their source nodes (their clickable controls are nested rather than the
 * entry root), so the visible rows swallow the click and the plugins can no
 * longer be opened from the sidebar.
 *
 * This shim modifies NEITHER side. It gives each plugin a normal entry point:
 *
 *   - a `sidebar.panellist` row plus a `main` panel, registered exactly like
 *     the built-in panels, so they appear in the sidebar's global panel list;
 *   - opening one dispatches `.click()` on the plugin's ORIGINAL footer-action
 *     node. That node stays mounted (only hidden by the takeover CSS) and still
 *     carries the plugin's own onClick, so the workbench opens under the
 *     plugin's own toggle logic;
 *   - leaving a panel closes its workbench again through the same node, so an
 *     overlay never outlives its selection.
 *
 * Selection is read from `ctx.layout.panelInfo`. The panel bodies are empty
 * markers: each workbench is a bounded overlay the plugin draws beside the
 * sidebar, covering the centre column once open.
 */
window.__ModuleLoader__.load({
  id: 'dsh-footer-panels',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /**
     * DEFAULT PANEL TABLE — the whole point of this plugin is that this is data,
     * not code. Each entry lifts one `sidebar.footer.action` launcher into the
     * sidebar's global panel list.
     *
     * POMASA Studio and Pictor are the two shipped EXAMPLES, not the scope: add
     * an entry (or override the same table from the bundle config's `panels`
     * array) and any other footer-bound plugin gets a panel entry too.
     *
     *   panelId  — the layout panel key; also the value in panelInfo.activePanelId
     *   label    — the row title shown in the global panel list
     *   order    — ascending row order, same scale as the built-in panels
     *   launcher — CSS selector for the plugin's OWN footer-action root
     *              (the original node, never the copy a theme may clone)
     */
    const DEFAULT_PANELS = [
      {
        panelId: 'pomasa-studio',
        label: 'POMASA Studio',
        order: 60,
        launcher: '[data-slot="sidebar.footer.action"] .ps-footer-action',
      },
      {
        panelId: 'dsh-pictor',
        label: 'Pictor',
        order: 61,
        launcher: '[data-slot="sidebar.footer.action"] .pt-footer-action',
      },
    ]

    /** Merge the bundle config's `panels` over the defaults, keyed by panelId. */
    function resolvePanels(config) {
      const override = config && Array.isArray(config.panels) ? config.panels : null
      if (override === null || override.length === 0) return DEFAULT_PANELS
      const merged = new Map(DEFAULT_PANELS.map((panel) => [panel.panelId, panel]))
      for (const panel of override) {
        if (!panel || typeof panel.panelId !== 'string' || typeof panel.launcher !== 'string') continue
        merged.set(panel.panelId, { ...merged.get(panel.panelId), ...panel })
      }
      return [...merged.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }

    /** 16px stroke glyphs matching the sidebar's panel icon weight. */
    function glyph(children) {
      return h(
        'svg',
        {
          width: 16,
          height: 16,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        children,
      )
    }

    const ICONS = {
      // POMASA: a multi-agent research network — one hub feeding several agent
      // nodes, matching the "调研系统 / MAS" idea rather than a generic window.
      'pomasa-studio': () =>
        glyph([
          h('circle', { key: 'hub', cx: 4, cy: 8, r: 1.9 }),
          h('circle', { key: 'a', cx: 12.2, cy: 3.4, r: 1.5 }),
          h('circle', { key: 'b', cx: 12.2, cy: 8, r: 1.5 }),
          h('circle', { key: 'c', cx: 12.2, cy: 12.6, r: 1.5 }),
          h('path', { key: 'l1', d: 'M5.7 7.2 10.9 4.2' }),
          h('path', { key: 'l2', d: 'M5.9 8h4.8' }),
          h('path', { key: 'l3', d: 'M5.7 8.8 10.9 11.8' }),
        ]),
      // Pictor: a picture frame — sun plus mountains — i.e. image generation.
      'dsh-pictor': () =>
        glyph([
          h('rect', { key: 'r', x: 2.25, y: 3.25, width: 11.5, height: 9.5, rx: 1.9 }),
          h('circle', { key: 's', cx: 5.9, cy: 6.6, r: 1.05 }),
          h('path', { key: 'm', d: 'M3.1 11.6 6.7 8.2l2.3 2.1 1.9-1.6 2.2 2.0' }),
        ]),
    }

    /** Neutral panel glyph for entries contributed through configuration. */
    function fallbackIcon() {
      return glyph([
        h('rect', { key: 'r', x: 2.25, y: 2.75, width: 11.5, height: 10.5, rx: 2 }),
        h('path', { key: 'p', d: 'M5.75 2.75v10.5' }),
      ])
    }

    function apply(ctx, config) {
      const slots = ctx.get('slots')
      if (slots === undefined) return

      const PANELS = resolvePanels(config)

      function nodeFor(panel) {
        if (typeof document === 'undefined') return null
        return document.querySelector(panel.launcher)
      }

      /**
       * Both plugins mark their open state with an `on` class on the launcher.
       * Read that instead of keeping a copy, so the shim can never drift from
       * the plugin's own toggle.
       */
      function isOpen(panel) {
        const node = nodeFor(panel)
        if (node === null) return false
        return node.getAttribute('aria-expanded') === 'true' || node.classList.contains('on')
      }

      /** Open or close one workbench through its plugin's own launcher. */
      function setOpen(panel, open) {
        const node = nodeFor(panel)
        if (node === null) return
        if (isOpen(panel) !== open) node.click()
      }

      const disposers = []

      for (const panel of PANELS) {
        // Empty marker so the panel key has an occupant; the workbench itself is
        // the plugin's overlay.
        const View = () => h('div', { 'data-panel-view': panel.panelId })

        disposers.push(
          slots.inject('main', () =>
            slots.register(
              { name: 'main', key: panel.panelId, id: panel.panelId, order: panel.order },
              View,
            ),
          ),
        )

        disposers.push(
          slots.inject('sidebar.panellist', () =>
            slots.register(
              { name: 'sidebar.panellist', id: panel.panelId, order: panel.order, label: panel.label },
              ICONS[panel.panelId] ?? fallbackIcon,
            ),
          ),
        )
      }

      /**
       * Keep every workbench in step with the panel selection. Polling beats
       * trusting one observer kind: the observable face differs between
       * framework versions, and a missed transition would leave an overlay
       * covering the app. A tick only reads a snapshot and compares a class.
       */
      function sync() {
        const layout = ctx.get('layout')
        const info = layout && layout.panelInfo
        if (info === undefined || typeof info.getSnapshot !== 'function') return
        const active = info.getSnapshot().activePanelId
        for (const panel of PANELS) setOpen(panel, active === panel.panelId)
      }

      const layout = ctx.get('layout')
      const info = layout && layout.panelInfo
      if (info !== undefined && typeof info.getSnapshot === 'function') {
        sync()
        const timer = window.setInterval(sync, 120)
        disposers.push(() => window.clearInterval(timer))
      }

      return () => {
        for (const dispose of disposers) dispose()
      }
    }

    return { inject: ['slots'], apply }
  },
})
