// ==========================================================
(async function init() {
  const main = renderLayout('products');
  let categories = [];
  let locations = [];

  main.innerHTML = `
    <div class="topbar">
      <div><h1>Products</h1><div class="subtitle">Manage your catalog, categories, and reordering rules</div></div>
      <button class="btn" id="newProductBtn">+ New Product</button>
    </div>

    <div class="card">
      <div class="filters-bar">
        <input type="text" id="search" placeholder="🔍 Search by name or SKU…" style="min-width:240px;">
        <select id="f_category"><option value="">All Categories</option></select>
        <label style="display:flex;align-items:center;gap:6px;font-weight:500;">
          <input type="checkbox" id="f_lowstock" style="width:auto;"> Low stock only
        </label>
      </div>
      <table>
        <thead><tr><th>Name</th><th>SKU</th><th>Category</th><th>Total Stock</th><th>Reorder Point</th><th>Status</th><th></th></tr></thead>
        <tbody id="productsBody"><tr><td colspan="7" class="empty-state">Loading…</td></tr></tbody>
      </table>
    </div>

    <!-- New Product Modal -->
    <div class="modal-overlay hidden" id="modal">
      <div class="modal">
        <h2>New Product</h2>
        <div id="modalErrors"></div>
        <form id="productForm">
          <div class="form-group"><label>Product Name *</label><input type="text" id="p_name" required maxlength="150"></div>
          <div class="form-row">
            <div class="form-group"><label>SKU / Code *</label><input type="text" id="p_sku" placeholder="STL-ROD-01" required></div>
            <div class="form-group"><label>Unit of Measure</label><input type="text" id="p_uom" placeholder="kg, unit, box…" value="unit"></div>
          </div>
          <div class="form-group">
            <label>Category</label>
            <select id="p_category"><option value="">— None —</option></select>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Reorder Point</label><input type="number" id="p_reorder_point" min="0" step="0.01" value="0"></div>
            <div class="form-group"><label>Reorder Qty</label><input type="number" id="p_reorder_qty" min="0" step="0.01" value="0"></div>
          </div>
          <hr>
          <p style="font-size:13px;color:var(--text-muted);">Optional: set an opening stock balance</p>
          <div class="form-row">
            <div class="form-group"><label>Initial Stock</label><input type="number" id="p_initial_stock" min="0" step="0.01"></div>
            <div class="form-group"><label>Location</label><select id="p_location"><option value="">— Select —</option></select></div>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px;">
            <button type="button" class="btn secondary" id="cancelBtn">Cancel</button>
            <button type="submit" class="btn">Create Product</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('newProductBtn').onclick = () => document.getElementById('modal').classList.remove('hidden');
  document.getElementById('cancelBtn').onclick = () => document.getElementById('modal').classList.add('hidden');
  document.getElementById('search').addEventListener('input', debounce(loadProducts, 300));
  document.getElementById('f_category').addEventListener('change', loadProducts);
  document.getElementById('f_lowstock').addEventListener('change', loadProducts);
  document.getElementById('productForm').addEventListener('submit', createProduct);

  await loadDropdowns();
  await loadProducts();

  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  async function loadDropdowns() {
    categories = await apiRequest('/products/categories/all');
    const catFilter = document.getElementById('f_category');
    const catSelect = document.getElementById('p_category');
    categories.forEach(c => {
      catFilter.insertAdjacentHTML('beforeend', `<option value="${c.id}">${c.name}</option>`);
      catSelect.insertAdjacentHTML('beforeend', `<option value="${c.id}">${c.name}</option>`);
    });

    locations = await apiRequest('/warehouses/locations/all');
    const locSelect = document.getElementById('p_location');
    locations.forEach(l => locSelect.insertAdjacentHTML('beforeend', `<option value="${l.id}">${l.warehouse_name} — ${l.name}</option>`));
  }

  async function loadProducts() {
    const params = new URLSearchParams();
    const search = document.getElementById('search').value.trim();
    const category = document.getElementById('f_category').value;
    const lowStock = document.getElementById('f_lowstock').checked;
    if (search) params.set('search', search);
    if (category) params.set('category_id', category);
    if (lowStock) params.set('low_stock', 'true');

    try {
      const products = await apiRequest(`/products?${params.toString()}`);
      const tbody = document.getElementById('productsBody');
      if (!products.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No products found.</td></tr>`;
        return;
      }
      tbody.innerHTML = products.map(p => {
        const stockClass = p.total_stock <= 0 ? 'alert' : (p.total_stock <= p.reorder_point ? 'warn' : '');
        return `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td>${p.sku}</td>
          <td>${p.category_name || '—'}</td>
          <td style="${stockClass === 'alert' ? 'color:var(--status-danger);font-weight:700;' : stockClass === 'warn' ? 'color:var(--status-waiting);font-weight:700;' : ''}">${p.total_stock} ${p.uom}</td>
          <td>${p.reorder_point}</td>
          <td>${p.is_active ? '<span class="badge done">Active</span>' : '<span class="badge draft">Inactive</span>'}</td>
          <td><button class="btn secondary" onclick="viewStock(${p.id}, '${p.name.replace(/'/g, "\\'")}')">View Stock</button></td>
        </tr>`;
      }).join('');
    } catch (err) { console.error(err); }
  }

  async function createProduct(e) {
    e.preventDefault();
    const errorsEl = document.getElementById('modalErrors');
    showFormErrors(errorsEl, []);

    const body = {
      name: document.getElementById('p_name').value.trim(),
      sku: document.getElementById('p_sku').value.trim(),
      uom: document.getElementById('p_uom').value.trim() || 'unit',
      category_id: document.getElementById('p_category').value || null,
      reorder_point: Number(document.getElementById('p_reorder_point').value || 0),
      reorder_qty: Number(document.getElementById('p_reorder_qty').value || 0),
      initial_stock: document.getElementById('p_initial_stock').value || null,
      location_id: document.getElementById('p_location').value || null
    };

    try {
      await apiRequest('/products', { method: 'POST', body });
      document.getElementById('modal').classList.add('hidden');
      document.getElementById('productForm').reset();
      await loadProducts();
    } catch (err) {
      showFormErrors(errorsEl, err.errors || [err.message]);
    }
  }

  window.viewStock = async (productId, name) => {
    try {
      const stock = await apiRequest(`/products/${productId}/stock`);
      const rows = stock.length
        ? stock.map(s => `<tr><td>${s.warehouse_name}</td><td>${s.location_name}</td><td>${s.quantity}</td></tr>`).join('')
        : `<tr><td colspan="3" class="empty-state">No stock recorded yet.</td></tr>`;
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal">
          <h2>Stock — ${name}</h2>
          <table><thead><tr><th>Warehouse</th><th>Location</th><th>Qty</th></tr></thead><tbody>${rows}</tbody></table>
          <div style="text-align:right;margin-top:16px;"><button class="btn secondary" id="closeStock">Close</button></div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#closeStock').onclick = () => overlay.remove();
    } catch (err) { alert(err.message); }
  };
})();
