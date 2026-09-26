// ==========================================================
// Renders the sidebar + wraps page content consistently.
// Call renderLayout('dashboard') at the top of each protected page,
// passing the current page's key so the right nav item highlights.
// Requires js/icons.js to be loaded first.
// ==========================================================
function renderLayout(activeKey) {
  requireAuth();
  const user = getUser();

  const nav = [
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', href: 'dashboard' },
    { key: 'products', label: 'Products', icon: 'box', href: 'products' },
    { key: 'receipts', label: 'Receipts', icon: 'inbound', href: 'operations?type=receipt' },
    { key: 'delivery', label: 'Delivery Orders', icon: 'outbound', href: 'operations?type=delivery' },
    { key: 'internal', label: 'Internal Transfers', icon: 'transfer', href: 'operations?type=internal' },
    { key: 'adjustment', label: 'Inventory Adjustment', icon: 'scale', href: 'operations?type=adjustment' },
    { key: 'history', label: 'Move History', icon: 'history', href: 'move-history' },
    { key: 'settings', label: 'Settings', icon: 'warehouse', href: 'settings' },
  ];

  const sidebarHtml = `
    <div class="sidebar">
      <div class="sidebar-brand">${Icon.crate(20)} StockSense</div>
      <div class="sidebar-section-label">Operations</div>
      ${nav.map(item => `
        <a class="sidebar-link ${activeKey === item.key ? 'active' : ''}" href="${item.href}">${Icon[item.icon](15)}<span>${item.label}</span></a>
      `).join('')}
      <div class="sidebar-footer">
        <a class="sidebar-link ${activeKey === 'profile' ? 'active' : ''}" href="profile.html">${Icon.user(15)}<span>My Profile</span></a>
        <a class="sidebar-link" onclick="doLogout()">${Icon.logout(15)}<span>Logout</span></a>
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
