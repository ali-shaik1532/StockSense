const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { appendLedgerEntry } = require('../utils/ledger');
const { isNonEmptyString, isPositiveNumber, collectErrors } = require('../utils/validate');

const router = express.Router();
router.use(authRequired);

const DOC_PREFIX = { receipt: 'RCPT', delivery: 'DLVR', internal: 'INTR', adjustment: 'ADJ' };
const VALID_TRANSITIONS = {
  draft: ['waiting', 'canceled'],
  waiting: ['ready', 'canceled'],
  ready: ['done', 'canceled'],
  done: [],
  canceled: []
};

async function generateDocNumber(conn, doc_type) {
  const prefix = DOC_PREFIX[doc_type];
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS cnt FROM documents WHERE doc_type = ?',
    [doc_type]
  );
  const seq = String(rows[0].cnt + 1).padStart(4, '0');
  return `${prefix}-${seq}`;
}

// ---------------- LIST DOCUMENTS (dashboard filters live here) ----------------
router.get('/', async (req, res) => {
  const { doc_type, status, warehouse_id, category_id, from, to } = req.query;

  let sql = `
    SELECT DISTINCT d.*, w.name AS warehouse_name, u.name AS created_by_name
    FROM documents d
    JOIN warehouses w ON w.id = d.warehouse_id
    JOIN users u ON u.id = d.created_by
  `;
  const params = [];
  const conditions = [];

  if (category_id) {
    sql += ' JOIN document_lines dl ON dl.document_id = d.id JOIN products p ON p.id = dl.product_id';
    conditions.push('p.category_id = ?');
    params.push(category_id);
  }
  if (doc_type) { conditions.push('d.doc_type = ?'); params.push(doc_type); }
  if (status) { conditions.push('d.status = ?'); params.push(status); }
  if (warehouse_id) { conditions.push('d.warehouse_id = ?'); params.push(warehouse_id); }
  if (from) { conditions.push('d.created_at >= ?'); params.push(from); }
  if (to) { conditions.push('d.created_at <= ?'); params.push(to); }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY d.created_at DESC LIMIT 200';

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: ['Failed to fetch documents.'] });
  }
});

// ---------------- GET ONE DOCUMENT (with lines) ----------------
router.get('/:id', async (req, res) => {
  try {
    const [docs] = await pool.query(
      `SELECT d.*, w.name AS warehouse_name FROM documents d JOIN warehouses w ON w.id = d.warehouse_id WHERE d.id = ?`,
      [req.params.id]
    );
    if (!docs.length) return res.status(404).json({ errors: ['Document not found.'] });

    const [lines] = await pool.query(
      `SELECT dl.*, p.name AS product_name, p.sku, p.uom,
              fl.name AS from_location_name, tl.name AS to_location_name
       FROM document_lines dl
       JOIN products p ON p.id = dl.product_id
       LEFT JOIN locations fl ON fl.id = dl.from_location_id
       LEFT JOIN locations tl ON tl.id = dl.to_location_id
       WHERE dl.document_id = ?`,
      [req.params.id]
    );

    res.json({ ...docs[0], lines });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: ['Failed to fetch document.'] });
  }
});

// ---------------- CREATE DOCUMENT (draft) ----------------
router.post('/', async (req, res) => {
  const { doc_type, warehouse_id, partner_name, reason, lines } = req.body;

  const errors = collectErrors([
    [['receipt', 'delivery', 'internal', 'adjustment'].includes(doc_type), 'Invalid document type.'],
    [!!warehouse_id, 'A warehouse is required.'],
    [Array.isArray(lines) && lines.length > 0, 'At least one line item is required.'],
    [doc_type === 'adjustment' ? isNonEmptyString(reason, 500) : true, 'A reason is required for stock adjustments.']
  ]);
  if (errors.length) return res.status(400).json({ errors });

  // Per-line validation depending on document type
  for (const [i, line] of lines.entries()) {
    if (!line.product_id) errors.push(`Line ${i + 1}: product is required.`);
    if (!isPositiveNumber(line.quantity) && doc_type !== 'adjustment') {
      errors.push(`Line ${i + 1}: quantity must be a positive number.`);
    }
    if (doc_type === 'adjustment' && (line.quantity === undefined || Number(line.quantity) < 0)) {
      errors.push(`Line ${i + 1}: counted quantity must be zero or a positive number.`);
    }
    if (doc_type === 'receipt' && !line.to_location_id) errors.push(`Line ${i + 1}: destination location is required for receipts.`);
    if (doc_type === 'delivery' && !line.from_location_id) errors.push(`Line ${i + 1}: source location is required for deliveries.`);
    if (doc_type === 'internal' && (!line.from_location_id || !line.to_location_id)) errors.push(`Line ${i + 1}: both source and destination are required for transfers.`);
    if (doc_type === 'internal' && line.from_location_id === line.to_location_id) errors.push(`Line ${i + 1}: source and destination must differ.`);
    if (doc_type === 'adjustment' && !line.to_location_id) errors.push(`Line ${i + 1}: location is required for adjustments.`);
  }
  if (errors.length) return res.status(400).json({ errors });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const doc_number = await generateDocNumber(conn, doc_type);
    const [docResult] = await conn.query(
      `INSERT INTO documents (doc_number, doc_type, status, warehouse_id, partner_name, reason, created_by)
       VALUES (?, ?, 'draft', ?, ?, ?, ?)`,
      [doc_number, doc_type, warehouse_id, partner_name || null, reason || null, req.user.id]
    );
    const documentId = docResult.insertId;

    for (const line of lines) {
      await conn.query(
        `INSERT INTO document_lines (document_id, product_id, quantity, from_location_id, to_location_id)
         VALUES (?, ?, ?, ?, ?)`,
        [documentId, line.product_id, line.quantity, line.from_location_id || null, line.to_location_id || null]
      );
    }

    await conn.commit();
    res.status(201).json({ id: documentId, doc_number, message: 'Document created as draft.' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ errors: ['Failed to create document.'] });
  } finally {
    conn.release();
  }
});

// ---------------- TRANSITION STATUS (draft -> waiting -> ready -> done / canceled) ----------------
router.post('/:id/transition', async (req, res) => {
  const { status: newStatus } = req.body;
  const validStatuses = ['draft', 'waiting', 'ready', 'done', 'canceled'];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ errors: ['Invalid target status.'] });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [docs] = await conn.query('SELECT * FROM documents WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!docs.length) { await conn.rollback(); return res.status(404).json({ errors: ['Document not found.'] }); }
    const doc = docs[0];

    if (!VALID_TRANSITIONS[doc.status].includes(newStatus)) {
      await conn.rollback();
      return res.status(400).json({ errors: [`Cannot move a '${doc.status}' document to '${newStatus}'.`] });
    }

    // Only on transition to 'done' do we touch the ledger — this is the "Validate" action.
    if (newStatus === 'done') {
      const [lines] = await conn.query('SELECT * FROM document_lines WHERE document_id = ?', [doc.id]);
      const ledgerEntries = [];

      for (const line of lines) {
        if (doc.doc_type === 'receipt') {
          ledgerEntries.push(await appendLedgerEntry(conn, {
            product_id: line.product_id, location_id: line.to_location_id,
            movement_type: 'receipt', qty_change: Number(line.quantity),
            document_id: doc.id, user_id: req.user.id
          }));
        } else if (doc.doc_type === 'delivery') {
          ledgerEntries.push(await appendLedgerEntry(conn, {
            product_id: line.product_id, location_id: line.from_location_id,
            movement_type: 'delivery', qty_change: -Number(line.quantity),
            document_id: doc.id, user_id: req.user.id
          }));
        } else if (doc.doc_type === 'internal') {
          ledgerEntries.push(await appendLedgerEntry(conn, {
            product_id: line.product_id, location_id: line.from_location_id,
            movement_type: 'transfer_out', qty_change: -Number(line.quantity),
            document_id: doc.id, user_id: req.user.id
          }));
          ledgerEntries.push(await appendLedgerEntry(conn, {
            product_id: line.product_id, location_id: line.to_location_id,
            movement_type: 'transfer_in', qty_change: Number(line.quantity),
            document_id: doc.id, user_id: req.user.id
          }));
        } else if (doc.doc_type === 'adjustment') {
          // line.quantity is the COUNTED (absolute) quantity; compute delta vs current balance
          const [balRows] = await conn.query(
            'SELECT quantity FROM stock_balances WHERE product_id = ? AND location_id = ?',
            [line.product_id, line.to_location_id]
          );
          const currentQty = balRows.length ? balRows[0].quantity : 0;
          const delta = Number((Number(line.quantity) - currentQty).toFixed(3));

          if (delta !== 0) {
            const entry = await appendLedgerEntry(conn, {
              product_id: line.product_id, location_id: line.to_location_id,
              movement_type: 'adjustment', qty_change: delta,
              document_id: doc.id, user_id: req.user.id
            });
            ledgerEntries.push(entry);
            await checkAnomalies(conn, entry, currentQty);
          }
        }
      }
      await conn.query('UPDATE documents SET status = ?, validated_by = ?, validated_at = NOW() WHERE id = ?', [newStatus, req.user.id, doc.id]);
    } else {
      await conn.query('UPDATE documents SET status = ? WHERE id = ?', [newStatus, doc.id]);
    }

    await conn.commit();
    req.app.get('io').emit('stock:changed', { reason: 'document_transition', document_id: doc.id, status: newStatus });
    res.json({ message: `Document moved to '${newStatus}'.` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    if (err.code === 'INSUFFICIENT_STOCK') {
      return res.status(400).json({ errors: [err.message] });
    }
    res.status(500).json({ errors: ['Failed to transition document.'] });
  } finally {
    conn.release();
  }
});

// ---------------- RULE-BASED ANOMALY DETECTION (runs on adjustments) ----------------
async function checkAnomalies(conn, ledgerEntry, previousBalance) {
  const flags = [];

  // Rule 1: adjustment changes stock by more than 30% of previous balance (and previous balance is meaningful)
  if (previousBalance > 0) {
    const pctChange = Math.abs(ledgerEntry.qty_change) / previousBalance;
    if (pctChange > 0.3) {
      flags.push(['LARGE_ADJUSTMENT', `Adjustment changed stock by ${(pctChange * 100).toFixed(1)}% of previous balance (${previousBalance} -> ${ledgerEntry.resulting_balance}).`]);
    }
  }

  // Rule 2: off-hours adjustment (before 6am or after 10pm server time)
  const hour = new Date(ledgerEntry.ts).getHours();
  if (hour < 6 || hour >= 22) {
    flags.push(['OFF_HOURS', `Adjustment made at ${hour}:00, outside typical business hours.`]);
  }

  // Rule 3: same user adjusted the same product 3+ times in the last hour
  const [recent] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM stock_ledger
     WHERE product_id = ? AND user_id = ? AND movement_type = 'adjustment' AND ts >= (NOW() - INTERVAL 1 HOUR)`,
    [ledgerEntry.product_id, ledgerEntry.user_id]
  );
  if (recent[0].cnt >= 3) {
    flags.push(['REPEATED_ADJUSTMENT', `This user has adjusted this product ${recent[0].cnt} times in the last hour.`]);
  }

  for (const [rule, details] of flags) {
    await conn.query('INSERT INTO anomaly_flags (ledger_id, rule, details) VALUES (?, ?, ?)', [ledgerEntry.id, rule, details]);
  }
}

module.exports = router;
