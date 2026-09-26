// ==========================================================
// Minimal line-icon set. Single stroke, 18x18/16x16, currentColor,
// so icons inherit whatever text color the surrounding element has.
// Self-contained — no external icon font or CDN dependency.
// ==========================================================
const Icon = {
  dashboard: (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="2" width="6" height="7" rx="0.5"/><rect x="10" y="2" width="6" height="4" rx="0.5"/><rect x="10" y="8" width="6" height="8" rx="0.5"/><rect x="2" y="11" width="6" height="5" rx="0.5"/></svg>`,

  box: (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 5.5 9 2l7 3.5v7L9 16 2 12.5v-7Z"/><path d="M2 5.5 9 9l7-3.5M9 9v7"/></svg>`,

  inbound: (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 3v9.5A1.5 1.5 0 0 0 4.5 14h9a1.5 1.5 0 0 0 1.5-1.5V3"/><path d="M2 3h14M9 6.5v5M6.5 9 9 11.5 11.5 9"/></svg>`,

  outbound: (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 3v9.5A1.5 1.5 0 0 0 4.5 14h9a1.5 1.5 0 0 0 1.5-1.5V3"/><path d="M2 3h14M9 11.5v-5M6.5 8.5 9 6l2.5 2.5"/></svg>`,

  transfer: (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 6h11M10 3l3 3-3 3"/><path d="M16 12H5M8 9l-3 3 3 3"/></svg>`,

  scale: (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M9 2v14M4.5 3.5h9"/><path d="M9 5 2 5l3.5 6L9 5ZM9 5l7 0-3.5 6L9 5Z"/><path d="M4 16h10"/></svg>`,

  history: (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 9a6 6 0 1 0 1.8-4.3"/><path d="M2 2v3.5H5.5"/><path d="M9 5.5V9l2.5 1.5"/></svg>`,

  warehouse: (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 8 9 3l7 5"/><path d="M3 7.5V15h12V7.5"/><path d="M7 15v-4.5h4V15"/></svg>`,

  user: (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="9" cy="6" r="3"/><path d="M3 16c0-3 2.7-5 6-5s6 2 6 5"/></svg>`,

  logout: (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M7 3H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/><path d="M12 12.5 16 9l-4-3.5M7 9h9"/></svg>`,

  lock: (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="4" y="8" width="10" height="7" rx="1"/><path d="M6 8V5.5a3 3 0 0 1 6 0V8"/><circle cx="9" cy="11.3" r="1" fill="currentColor" stroke="none"/></svg>`,

  check: (s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3.5 9.5 7 13l7.5-9"/></svg>`,

  alert: (s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 2 16.5 15h-15L9 2Z"/><path d="M9 7.5v3.2"/><circle cx="9" cy="13" r="0.6" fill="currentColor" stroke="none"/></svg>`,

  camera: (s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 6h3l1.2-2h5.6L13 6h3v8H2Z"/><circle cx="9" cy="10" r="2.6"/></svg>`,

  search: (s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="5"/><path d="M12 12 16 16"/></svg>`,

  close: (s = 12) => `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3 15 15M15 3 3 15"/></svg>`,

  crate: (s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 7 11 3l9 4v8l-9 4-9-4V7Z"/><path d="M2 7l9 4 9-4M11 11v8M6 5l9 4M16 5l-9 4"/></svg>`
};
