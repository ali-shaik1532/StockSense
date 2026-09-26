(async function init() {
  const main = renderLayout('dashboard');
  const user = getUser();

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Welcome back, ${user.name.split(' ')[0]} <span class="live-dot" title="Live"></span></h1>
        <div class="subtitle">Real-time snapshot of inventory operations</div>
      </div>
      <button class="btn secondary" id="verifyBtn">🔒 Verify Ledger Integrity</button>
    </div>

    <div id="verifyResult"></div>

    <div class="kpi-grid" id="kpiGrid"></div>

    <div class="card">
      <div class="filters-bar">
        <select id="f_type"><option value="">All Document Types</option>
          <option value="receipt">Receipts</option><option value="delivery">Delivery</option>
          <option value="internal">Internal</option><option value="adjustment">Adjustments</option>
        </select>
        <select id="f_status"><option value="">All Statuses</option>
          <option value="draft">Draft</option><option value="waiting">Waiting</option>
          <option value="ready">Ready</option><option value="done">Done</option><option value="canceled">Canceled</option>
        </select>
        <select id="f_warehouse"><option value="">All Warehouses</option></select>
        <select id="f_category"><option value="">All Categories</option></select>
      </div>
      <table>
        <thead><tr><th>Doc #</th><th>Type</th><th>Warehouse</th><th>Created By</th><th>Status</th><th>Created</th></tr></thead>
        <tbody id="docsBody"><tr><td colspan="6" class="empty-state">Loading…</td></tr></tbody>
      </table>
    </div>
  `;

  document.getElementById('verifyBtn').onclick = verifyLedger;
  ['f_type', 'f_status', 'f_warehouse', 'f_category'].forEach(id =>
    document.getElementById(id).addEventListener('change', loadDocuments)
  );

  await loadDropdowns();
  await loadKPIs();
  await loadDocuments();

  // Realtime: whenever backend emits a stock change, refresh KPIs + table live.
  const socket = io('http://localhost:4000');
  socket.on('stock:changed', () => { loadKPIs(); loadDocuments(); });

  async function loadDropdowns() {
    try {
      const warehouses = await apiRequest('/warehouses');
      const wSelect = document.getElementById('f_warehouse');
      warehouses.forEach(w => wSelect.insertAdjacentHTML('beforeend', `<option value="${w.id}">${w.name}</option>`));

      const categories = await apiRequest('/products/categories/all');
      const cSelect = document.getElementById('f_category');
      categories.forEach(c => cSelect.insertAdjacentHTML('beforeend', `<option value="${c.id}">${c.name}</option>`));
    } catch (err) { console.error(err); }
  }

  async function loadKPIs() {
    try {
      const k = await apiRequest('/dashboard/kpis');
      document.getElementById('kpiGrid').innerHTML = `
        <div class="kpi-card"><div class="label">Total Products</div><div class="value">${k.total_products}</div></div>
        <div class="kpi-card warn"><div class="label">Low Stock</div><div class="value">${k.low_stock}</div></div>
        <div class="kpi-card alert"><div class="label">Out of Stock</div><div class="value">${k.out_of_stock}</div></div>
        <div class="kpi-card"><div class="label">Pending Receipts</div><div class="value">${k.pending_receipts}</div></div>
        <div class="kpi-card"><div class="label">Pending Deliveries</div><div class="value">${k.pending_deliveries}</div></div>
        <div class="kpi-card"><div class="label">Transfers Scheduled</div><div class="value">${k.scheduled_transfers}</div></div>
      `;
    } catch (err) { console.error(err); }
  }

  async function loadDocuments() {
    const params = new URLSearchParams();
    const type = document.getElementById('f_type').value;
    const status = document.getElementById('f_status').value;
    const warehouse = document.getElementById('f_warehouse').value;
    const category = document.getElementById('f_category').value;
    if (type) params.set('doc_type', type);
    if (status) params.set('status', status);
    if (warehouse) params.set('warehouse_id', warehouse);
    if (category) params.set('category_id', category);

    try {
      const docs = await apiRequest(`/documents?${params.toString()}`);
      const tbody = document.getElementById('docsBody');
      if (!docs.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No documents match these filters.</td></tr>`;
        return;
      }
      tbody.innerHTML = docs.map(d => `
        <tr>
          <td><strong>${d.doc_number}</strong></td>
          <td>${d.doc_type}</td>
          <td>${d.warehouse_name}</td>
          <td>${d.created_by_name}</td>
          <td>${statusBadge(d.status)}</td>
          <td>${new Date(d.created_at).toLocaleString()}</td>
        </tr>
      `).join('');
    } catch (err) { console.error(err); }
  }

  async function verifyLedger() {
    const resultEl = document.getElementById('verifyResult');
    resultEl.innerHTML = `<div class="card" style="margin-bottom:16px;">Checking ${'\u23F3'} ...</div>`;
    try {
      const result = await apiRequest('/ledger/verify');
      if (result.is_valid) {
        resultEl.innerHTML = `<div class="success-box">✅ Ledger integrity verified — all ${result.total_entries} entries form an unbroken cryptographic chain. No tampering detected.</div>`;
      } else {
        resultEl.innerHTML = `<div class="error-box">🚨 TAMPERING DETECTED in ${result.problems.length} entr${result.problems.length === 1 ? 'y' : 'ies'}:<br>` +
          result.problems.map(p => `Ledger #${p.ledger_id}: ${p.issue} — ${p.detail}`).join('<br>') + `</div>`;
      }
    } catch (err) {
      resultEl.innerHTML = `<div class="error-box">${err.message}</div>`;
    }
  }
})();
