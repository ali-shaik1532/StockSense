(async function init() {
  const main = renderLayout('settings');

  main.innerHTML = `
    <div class="topbar">
      <div><h1>Settings — Warehouses</h1><div class="subtitle">Manage warehouses and their internal locations</div></div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <h3 style="margin-top:0;">Add Warehouse</h3>
      <div id="whErrors"></div>
      <form id="whForm" class="form-row">
        <div class="form-group" style="flex: 1; min-width: 0;"><label>Name *</label><input type="text" id="wh_name" required maxlength="100"></div>
        <div class="form-group" style="flex: 1; min-width: 0;"><label>Address</label><input type="text" id="wh_address" maxlength="255"></div>
        <div class="form-group" style="flex: 0 0 auto; align-self: flex-end;"><button class="btn" type="submit">Add</button></div>
      </form>
    </div>

    <div id="warehouseList"></div>

    <div class="card" style="margin-top:10px;">
      <h3 style="margin-top:0;">Add Category</h3>
      <div id="catErrors"></div>
      <form id="catForm" class="form-row">
        <div class="form-group" style="flex: 1; min-width: 0;"><label>Category Name *</label><input type="text" id="cat_name" required maxlength="100"></div>
        <div class="form-group" style="flex: 0 0 auto; align-self: flex-end;"><button class="btn" type="submit">Add</button></div>
      </form>
    </div>
  `;

  document.getElementById('whForm').addEventListener('submit', addWarehouse);
  document.getElementById('catForm').addEventListener('submit', addCategory);

  await loadWarehouses();

  async function loadWarehouses() {
    const warehouses = await apiRequest('/warehouses');
    const container = document.getElementById('warehouseList');
    container.innerHTML = '';

    for (const w of warehouses) {
      const locations = await apiRequest(`/warehouses/${w.id}/locations`);
      const card = document.createElement('div');
      card.className = 'card';
      card.style.marginBottom = '14px';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><strong>${w.name}</strong><div style="color:var(--text-muted);font-size:13px;">${w.address || 'No address set'}</div></div>
        </div>
        <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">
          ${locations.map(l => `<span class="badge draft">${l.name}</span>`).join('') || '<span style="color:var(--text-muted);font-size:13px;">No locations yet</span>'}
        </div>
        <div class="form-row" style="margin-top:14px; align-items: flex-start;">
          <div class="form-group" style="flex: 1; min-width: 0; margin-bottom: 0;"><input type="text" placeholder="New location name (e.g. Rack C)" class="new-loc-input" maxlength="100"></div>
          <div class="form-group" style="flex: 0 0 auto; margin-bottom: 0;"><button type="button" class="btn secondary add-loc-btn">+ Add Location</button></div>
        </div>
      `;
      card.querySelector('.add-loc-btn').onclick = async () => {
        const input = card.querySelector('.new-loc-input');
        const name = input.value.trim();
        if (!name) return;
        try {
          await apiRequest(`/warehouses/${w.id}/locations`, { method: 'POST', body: { name } });
          await loadWarehouses();
        } catch (err) { alert(err.message); }
      };
      container.appendChild(card);
    }
  }

  async function addWarehouse(e) {
    e.preventDefault();
    const errorsEl = document.getElementById('whErrors');
    showFormErrors(errorsEl, []);
    try {
      await apiRequest('/warehouses', {
        method: 'POST',
        body: { name: document.getElementById('wh_name').value.trim(), address: document.getElementById('wh_address').value.trim() }
      });
      document.getElementById('whForm').reset();
      await loadWarehouses();
    } catch (err) { showFormErrors(errorsEl, err.errors || [err.message]); }
  }

  async function addCategory(e) {
    e.preventDefault();
    const errorsEl = document.getElementById('catErrors');
    showFormErrors(errorsEl, []);
    try {
      await apiRequest('/products/categories', { method: 'POST', body: { name: document.getElementById('cat_name').value.trim() } });
      document.getElementById('catForm').reset();
      showFormErrors(errorsEl, []);
    } catch (err) { showFormErrors(errorsEl, err.errors || [err.message]); }
  }
})();