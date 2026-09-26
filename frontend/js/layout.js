// ==========================================================
// Renders the sidebar + wraps page content consistently.
// Call renderLayout('dashboard') at the top of each protected page,
// passing the current page's key so the right nav item highlights.
// ==========================================================
function renderLayout(activeKey) {
  requireAuth();
  const user = getUser();

  const nav = [
    { key: 'dashboard', label: '📊 Dashboard', href: 'dashboard.html' },
    { key: 'products', label: '📦 Products', href: 'products.html' },
    { key: 'receipts', label: '📥 Receipts', href: 'operations.html?type=receipt' },
    { key: 'delivery', label: '📤 Delivery Orders', href: 'operations.html?type=delivery' },
    { key: 'internal', label: '🔀 Internal Transfers', href: 'operations.html?type=internal' },
    { key: 'adjustment', label: '⚖️ Inventory Adjustment', href: 'operations.html?type=adjustment' },
    { key: 'history', label: '🧾 Move History', href: 'move-history.html' },
    { key: 'settings', label: '🏬 Settings / Warehouses', href: 'settings.html' },
  ];

  const sidebarHtml = `
    <div class="sidebar">
      <div class="sidebar-brand"><span class="dot"></span> StockSense</div>
      <div class="sidebar-section-label">Operations</div>
      ${nav.map(item => `
        <a class="sidebar-link ${activeKey === item.key ? 'active' : ''}" href="${item.href}">${item.label}</a>
      `).join('')}
      <div class="sidebar-footer">
        <a class="sidebar-link ${activeKey === 'profile' ? 'active' : ''}" href="profile.html">👤 My Profile</a>
        <a class="sidebar-link" onclick="doLogout()">🚪 Logout</a>
      </div>
    </div>
  `;

  const shell = document.createElement('div');
  shell.className = 'app-shell';
  shell.innerHTML = sidebarHtml + `<div class="main" id="main-content"></div>`;

  document.body.innerHTML = '';
  document.body.appendChild(shell);

  return document.getElementById('main-content');
}

function doLogout() {
  clearSession();
  window.location.href = 'index.html';
}

function statusBadge(status) {
  return `<span class="badge ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
}
