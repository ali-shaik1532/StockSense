const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { verifyChain } = require('../utils/ledger');

const router = express.Router();
router.use(authRequired);

// ---------------- MOVE HISTORY (filterable ledger view) ----------------
router.get('/', async (req, res) => {
  const { product_id, location_id, category_id, movement_type, warehouse_id, from, to } = req.query;

  let sql = `
    SELECT sl.id, sl.movement_type, sl.qty_change, sl.resulting_balance, sl.ts,
           p.name AS product_name, p.sku, p.uom,
           l.name AS location_name, w.id AS warehouse_id, w.name AS warehouse_name,
           u.name AS user_name, sl.document_id, d.doc_number,
           GROUP_CONCAT(DISTINCT af.rule) AS anomaly_flags
    FROM stock_ledger sl
    JOIN products p ON p.id = sl.product_id
    JOIN locations l ON l.id = sl.location_id
    JOIN warehouses w ON w.id = l.warehouse_id
    JOIN users u ON u.id = sl.user_id
    LEFT JOIN documents d ON d.id = sl.document_id
    LEFT JOIN anomaly_flags af ON af.ledger_id = sl.id
    WHERE 1=1
  `;
  const params = [];
  if (product_id) { sql += ' AND sl.product_id = ?'; params.push(product_id); }
  if (location_id) { sql += ' AND sl.location_id = ?'; params.push(location_id); }
  if (category_id) { sql += ' AND p.category_id = ?'; params.push(category_id); }
  if (movement_type) { sql += ' AND sl.movement_type = ?'; params.push(movement_type); }
  if (warehouse_id) { sql += ' AND w.id = ?'; params.push(warehouse_id); }
  if (from) { sql += ' AND sl.ts >= ?'; params.push(from); }
  if (to) { sql += ' AND sl.ts <= ?'; params.push(to); }

  sql += ' GROUP BY sl.id ORDER BY sl.ts DESC LIMIT 300';

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: ['Failed to fetch move history.'] });
  }
});

// ---------------- VERIFY LEDGER INTEGRITY (the headline feature) ----------------
router.get('/verify', async (req, res) => {
  try {
    const result = await verifyChain(pool);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: ['Failed to verify ledger integrity.'] });
  }
});

module.exports = router;
