(async function init() {
  const main = renderLayout('history');

  main.innerHTML = `
    <div class="topbar">
      <div><h1>Move History</h1><div class="subtitle">The full Stock Ledger — every movement, immutable and hash-chained</div></div>
    </div>

    <div class="card">
      <div class="filters-bar">
        <select id="f_movement"><option value="">All Movement Types</option>
          <option value="receipt">Receipt</option><option value="delivery">Delivery</option>
          <option value="transfer_in">Transfer In</option><option value="transfer_out">Transfer Out</option>
          <option value="adjustment">Adjustment</option>
        </select>
        <select id="f_warehouse"><option value="">All Warehouses</option></select>
        <select id="f_category"><option value="">All Categories</option></select>
        <input type="date" id="f_from" title="From date">
        <input type="date" id="f_to" title="To date">
      </div>
      <table>
        <thead><tr><th>Timestamp</th><th>Product</th><th>Location</th><th>Movement</th><th>Qty Change</th><th>Resulting Balance</th><th>By</th><th>Doc</th></tr></thead>
        <tbody id="ledgerBody"><tr><td colspan="8" class="empty-state">Loading…</td></tr></tbody>
      </table>
    </div>
  `;

  ['f_movement', 'f_warehouse', 'f_category', 'f_from', 'f_to'].forEach(id =>
    document.getElementById(id).addEventListener('change', loadLedger)
  );

  await loadDropdowns();
  await loadLedger();

  async function loadDropdowns() {
    const warehouses = await apiRequest('/warehouses');
    const wSelect = document.getElementById('f_warehouse');
    warehouses.forEach(w => wSelect.insertAdjacentHTML('beforeend', `<option value="${w.id}">${w.name}</option>`));

    const categories = await apiRequest('/products/categories/all');
    const cSelect = document.getElementById('f_category');
    categories.forEach(c => cSelect.insertAdjacentHTML('beforeend', `<option value="${c.id}">${c.name}</option>`));
  }

  async function loadLedger() {
    const p = new URLSearchParams();
    const movement = document.getElementById('f_movement').value;
    const warehouse = document.getElementById('f_warehouse').value;
    const category = document.getElementById('f_category').value;
    const from = document.getElementById('f_from').value;
    const to = document.getElementById('f_to').value;
    if (movement) p.set('movement_type', movement);
    if (warehouse) p.set('warehouse_id', warehouse);
    if (category) p.set('category_id', category);
    if (from) p.set('from', from);
    if (to) p.set('to', to);

    try {
      const rows = await apiRequest(`/ledger?${p.toString()}`);
      const tbody = document.getElementById('ledgerBody');
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No stock movements match these filters.</td></tr>`;
        return;
      }
      tbody.innerHTML = rows.map(r => {
        const qtyColor = r.qty_change >= 0 ? 'var(--status-done)' : 'var(--status-danger)';
        const anomalies = r.anomaly_flags ? r.anomaly_flags.split(',').map(a => `<span class="anomaly-tag">${a.replace(/_/g, ' ')}</span>`).join('') : '';
        return `
        <tr>
          <td>${new Date(r.ts).toLocaleString()}</td>
          <td>${r.product_name} <span style="color:var(--text-muted);">(${r.sku})</span></td>
          <td>${r.warehouse_name} — ${r.location_name}</td>
          <td>${r.movement_type.replace('_', ' ')}${anomalies}</td>
          <td style="color:${qtyColor};font-weight:700;">${r.qty_change > 0 ? '+' : ''}${r.qty_change} ${r.uom}</td>
          <td>${r.resulting_balance} ${r.uom}</td>
          <td>${r.user_name}</td>
          <td>${r.doc_number || '—'}</td>
        </tr>`;
      }).join('');
    } catch (err) { console.error(err); }
  }
})();
