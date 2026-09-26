const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/kpis', async (req, res) => {
  try {
    const [[{ total_products }]] = await pool.query(
      `SELECT COUNT(*) AS total_products FROM products WHERE is_active = 1`
    );

    const [[{ low_stock }]] = await pool.query(`
      SELECT COUNT(*) AS low_stock FROM (
        SELECT p.id FROM products p
        LEFT JOIN stock_balances sb ON sb.product_id = p.id
        WHERE p.is_active = 1
        GROUP BY p.id
        HAVING COALESCE(SUM(sb.quantity), 0) <= p.reorder_point AND COALESCE(SUM(sb.quantity), 0) > 0
      ) t
    `);

    const [[{ out_of_stock }]] = await pool.query(`
      SELECT COUNT(*) AS out_of_stock FROM (
        SELECT p.id FROM products p
        LEFT JOIN stock_balances sb ON sb.product_id = p.id
        WHERE p.is_active = 1
        GROUP BY p.id
        HAVING COALESCE(SUM(sb.quantity), 0) <= 0
      ) t
    `);

    const [[{ pending_receipts }]] = await pool.query(
      `SELECT COUNT(*) AS pending_receipts FROM documents WHERE doc_type = 'receipt' AND status IN ('draft','waiting','ready')`
    );
    const [[{ pending_deliveries }]] = await pool.query(
      `SELECT COUNT(*) AS pending_deliveries FROM documents WHERE doc_type = 'delivery' AND status IN ('draft','waiting','ready')`
    );
    const [[{ scheduled_transfers }]] = await pool.query(
      `SELECT COUNT(*) AS scheduled_transfers FROM documents WHERE doc_type = 'internal' AND status IN ('draft','waiting','ready')`
    );

    res.json({
      total_products,
      low_stock,
      out_of_stock,
      pending_receipts,
      pending_deliveries,
      scheduled_transfers
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: ['Failed to load KPIs.'] });
  }
});

// Low-stock / out-of-stock product list for alerts panel
router.get('/alerts', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.id, p.name, p.sku, p.reorder_point, p.reorder_qty,
             COALESCE(SUM(sb.quantity), 0) AS total_stock
      FROM products p
      LEFT JOIN stock_balances sb ON sb.product_id = p.id
      WHERE p.is_active = 1
      GROUP BY p.id
      HAVING total_stock <= p.reorder_point
      ORDER BY total_stock ASC
      LIMIT 20
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: ['Failed to load alerts.'] });
  }
});

module.exports = router;
