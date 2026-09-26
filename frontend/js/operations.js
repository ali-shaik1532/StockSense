(async function init() {
  const params = new URLSearchParams(window.location.search);
  const docType = params.get('type') || 'receipt';

  const TYPE_META = {
    receipt: { label: 'Receipts (Incoming Stock)', sidebarKey: 'receipts', partnerLabel: 'Supplier', needsFrom: false, needsTo: true },
    delivery: { label: 'Delivery Orders (Outgoing Stock)', sidebarKey: 'delivery', partnerLabel: 'Customer', needsFrom: true, needsTo: false },
    internal: { label: 'Internal Transfers', sidebarKey: 'internal', partnerLabel: null, needsFrom: true, needsTo: true },
    adjustment: { label: 'Inventory Adjustment', sidebarKey: 'adjustment', partnerLabel: null, needsFrom: false, needsTo: true, isAdjustment: true }
  };
  const meta = TYPE_META[docType];
  const main = renderLayout(meta.sidebarKey);

  let productsCache = [];
  let locationsCache = [];
  let warehousesCache = [];
  let lineCount = 0;

  main.innerHTML = `
    <div class="topbar">
      <div><h1>${meta.label}</h1><div class="subtitle">Create, validate, and track ${docType} documents</div></div>
      <button class="btn" id="newDocBtn">+ New ${docType === 'internal' ? 'Transfer' : docType.charAt(0).toUpperCase() + docType.slice(1)}</button>
    </div>

    <div class="card">
      <div class="filters-bar">
        <select id="f_status"><option value="">All Statuses</option>
          <option value="draft">Draft</option><option value="waiting">Waiting</option>
          <option value="ready">Ready</option><option value="done">Done</option><option value="canceled">Canceled</option>
        </select>
        <select id="f_warehouse"><option value="">All Warehouses</option></select>
      </div>
      <table>
        <thead><tr><th>Doc #</th><th>${meta.partnerLabel || 'Details'}</th><th>Warehouse</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody id="docsBody"><tr><td colspan="6" class="empty-state">Loading…</td></tr></tbody>
      </table>
    </div>

    <!-- New Document Modal -->
    <div class="modal" style="width:760px; max-width: 95vw;">
      <div class="modal" style="width:640px;">
        <h2>New ${docType === 'internal' ? 'Internal Transfer' : docType.charAt(0).toUpperCase() + docType.slice(1)}</h2>
        <div id="modalErrors"></div>
        <form id="docForm">
          <div class="form-row">
            <div class="form-group"><label>Warehouse *</label><select id="d_warehouse" required></select></div>
            ${meta.partnerLabel ? `<div class="form-group"><label>${meta.partnerLabel}</label><input type="text" id="d_partner" maxlength="150"></div>` : ''}
          </div>
          ${meta.isAdjustment ? `<div class="form-group"><label>Reason for Adjustment *</label><textarea id="d_reason" rows="2" required placeholder="e.g. Physical stock count — 3kg damaged in storage"></textarea></div>` : ''}

          <label>Line Items</label>
          <div id="linesContainer"></div>
          <button type="button" class="btn secondary" id="addLineBtn" style="margin-bottom:16px;">+ Add Line</button>
          <button type="button" class="btn secondary" id="scanBtn" style="margin-bottom:16px;margin-left:8px;">${Icon.camera(13)} Scan SKU</button>

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px;">
            <button type="button" class="btn secondary" id="cancelModalBtn">Cancel</button>
            <button type="submit" class="btn">Save as Draft</button>
          </div>
        </form>
      </div>
    </div>

    <!-- QR Scanner Modal -->
    <div class="modal-overlay hidden" id="scanModal">
      <div class="modal">
        <h2>Scan Product SKU</h2>
        <p style="font-size:13px;color:var(--text-muted);">Point the camera at a barcode/QR code containing the product SKU.</p>
        <div id="reader" style="width:100%;"></div>
        <div style="text-align:right;margin-top:12px;"><button class="btn secondary" id="closeScanBtn">Close</button></div>
      </div>
    </div>
  `;

  document.getElementById('newDocBtn').onclick = openModal;
  document.getElementById('cancelModalBtn').onclick = closeModal;
  document.getElementById('addLineBtn').onclick = () => addLineRow();
  document.getElementById('docForm').addEventListener('submit', saveDraft);
  document.getElementById('f_status').addEventListener('change', loadDocs);
  document.getElementById('f_warehouse').addEventListener('change', loadDocs);
  document.getElementById('scanBtn').onclick = openScanner;
  document.getElementById('closeScanBtn').onclick = closeScanner;

  await loadReferenceData();
  await loadDocs();

  async function loadReferenceData() {
    productsCache = await apiRequest('/products');
    locationsCache = await apiRequest('/warehouses/locations/all');
    warehousesCache = await apiRequest('/warehouses');

    const wSelects = [document.getElementById('f_warehouse'), document.getElementById('d_warehouse')];
    wSelects.forEach(sel => warehousesCache.forEach(w => sel.insertAdjacentHTML('beforeend', `<option value="${w.id}">${w.name}</option>`)));
  }

  function productOptions(selectedId) {
    return productsCache.map(p => `<option value="${p.id}" ${p.id == selectedId ? 'selected' : ''}>${p.name} (${p.sku})</option>`).join('');
  }
  function locationOptions(selectedId) {
    return locationsCache.map(l => `<option value="${l.id}" ${l.id == selectedId ? 'selected' : ''}>${l.warehouse_name} — ${l.name}</option>`).join('');
  }

  function addLineRow(prefillProductId) {
    lineCount++;
    const id = `line_${lineCount}`;
    const row = document.createElement('div');
    row.className = 'form-row';
    row.id = id;
    row.style.alignItems = 'flex-end';

    let extraFields = '';
    if (meta.needsFrom) extraFields += `<div class="form-group"><label>From Location *</label><select class="line-from">${locationOptions()}</select></div>`;
    if (meta.needsTo) extraFields += `<div class="form-group"><label>${meta.isAdjustment ? 'Location *' : 'To Location *'}</label><select class="line-to">${locationOptions()}</select></div>`;

    row.innerHTML = `
      <div class="form-group" style="flex:2;"><label>Product *</label><select class="line-product">${productOptions(prefillProductId)}</select></div>
      <div class="form-group"><label>${meta.isAdjustment ? 'Counted Qty *' : 'Quantity *'}</label><input type="number" class="line-qty" min="0" step="0.001" required></div>
      ${extraFields}
      <button type="button" class="btn secondary" onclick="document.getElementById('${id}').remove()">${Icon.close(11)}</button>
    `;
    document.getElementById('linesContainer').appendChild(row);
  }

  function openModal() {
    document.getElementById('linesContainer').innerHTML = '';
    lineCount = 0;
    addLineRow();
    document.getElementById('modal').classList.remove('hidden');
  }
  function closeModal() { document.getElementById('modal').classList.add('hidden'); }

  async function saveDraft(e) {
    e.preventDefault();
    const errorsEl = document.getElementById('modalErrors');
    showFormErrors(errorsEl, []);

    const lines = Array.from(document.querySelectorAll('#linesContainer .form-row')).map(row => {
      const line = {
        product_id: row.querySelector('.line-product').value,
        quantity: row.querySelector('.line-qty').value
      };
      if (meta.needsFrom) line.from_location_id = row.querySelector('.line-from').value;
      if (meta.needsTo) line.to_location_id = row.querySelector('.line-to').value;
      return line;
    });

    const body = {
      doc_type: docType,
      warehouse_id: document.getElementById('d_warehouse').value,
      lines
    };
    if (meta.partnerLabel) body.partner_name = document.getElementById('d_partner')?.value.trim();
    if (meta.isAdjustment) body.reason = document.getElementById('d_reason').value.trim();

    try {
      await apiRequest('/documents', { method: 'POST', body });
      closeModal();
      await loadDocs();
    } catch (err) {
      showFormErrors(errorsEl, err.errors || [err.message]);
    }
  }

  async function loadDocs() {
    const p = new URLSearchParams({ doc_type: docType });
    const status = document.getElementById('f_status').value;
    const warehouse = document.getElementById('f_warehouse').value;
    if (status) p.set('status', status);
    if (warehouse) p.set('warehouse_id', warehouse);

    try {
      const docs = await apiRequest(`/documents?${p.toString()}`);
      const tbody = document.getElementById('docsBody');
      if (!docs.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No ${docType} documents yet. Click "+ New" to create one.</td></tr>`;
        return;
      }
      tbody.innerHTML = docs.map(d => `
        <tr>
          <td><strong>${d.doc_number}</strong></td>
          <td>${d.partner_name || d.reason || '—'}</td>
          <td>${d.warehouse_name}</td>
          <td>${statusBadge(d.status)}</td>
          <td>${new Date(d.created_at).toLocaleString()}</td>
          <td>${actionButtons(d)}</td>
        </tr>
      `).join('');
    } catch (err) { console.error(err); }
  }

  function actionButtons(doc) {
    const next = { draft: 'waiting', waiting: 'ready', ready: 'done' }[doc.status];
    const nextLabel = { waiting: 'Mark Waiting', ready: 'Mark Ready', done: 'Validate' }[next];
    let html = '';
    if (next) html += `<button class="btn secondary" onclick="transition(${doc.id}, '${next}')">${nextLabel}</button> `;
    if (['draft', 'waiting', 'ready'].includes(doc.status)) html += `<button class="btn danger" onclick="transition(${doc.id}, 'canceled')">Cancel</button>`;
    return html || '—';
  }

  window.transition = async (docId, status) => {
    try {
      await apiRequest(`/documents/${docId}/transition`, { method: 'POST', body: { status } });
      await loadDocs();
    } catch (err) {
      alert((err.errors && err.errors.join('\n')) || err.message);
    }
  };

  // ---------------- QR / Barcode scanning ----------------
  let scanner = null;
  function openScanner() {
    document.getElementById('scanModal').classList.remove('hidden');
    scanner = new Html5Qrcode('reader');
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 220 },
      (decodedText) => {
        const match = productsCache.find(p => p.sku.toLowerCase() === decodedText.trim().toLowerCase());
        if (match) {
          addLineRow(match.id);
          closeScanner();
        }
      },
      () => {} // ignore per-frame scan failures
    ).catch(err => console.error('Camera start failed:', err));
  }
  function closeScanner() {
    document.getElementById('scanModal').classList.add('hidden');
    if (scanner) { scanner.stop().catch(() => {}); scanner = null; }
  }
})();
