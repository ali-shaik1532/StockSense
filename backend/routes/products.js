const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { isNonEmptyString, isValidSku, isNonNegativeNumber, collectErrors } = require('../utils/validate');

const router = express.Router();
router.use(authRequired);

// ---------------- LIST PRODUCTS (with stock-per-location+smart filters) ----------------
router.get('/', async (req, res) => {
  const { search, category_id, low_stock } = req.query;

  let sql = `
    SELECT p.id, p.name, p.sku, p.uom, p.reorder_point, p.reorder_qty, p.is_active,
           c.name AS category_name, c.id AS category_id,
           COALESCE(SUM(sb.quantity), 0) AS total_stock
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN stock_balances sb ON sb.product_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    sql += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category_id) {
    sql += ' AND p.category_id = ?';
    params.push(category_id);
  }

  sql += ' GROUP BY p.id';
  if (low_stock === 'true') {
    sql += ' HAVING total_stock <= p.reorder_point';
  }
  sql += ' ORDER BY p.name ASC';

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: ['Failed to fetch products.'] });
  }
});

// ---------------- PRODUCT DETAIL: stock per location ----------------
router.get('/:id/stock', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT sb.location_id, l.name AS location_name, w.name AS warehouse_name, sb.quantity
       FROM stock_balances sb
       JOIN locations l ON l.id = sb.location_id
       JOIN warehouses w ON w.id = l.warehouse_id
       WHERE sb.product_id = ?
       ORDER BY w.name, l.name`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: ['Failed to fetch stock per location.'] });
  }
});

// ---------------- CREATE PRODUCT ----------------
router.post('/', async (req, res) => {
  const { name, sku, category_id, uom, reorder_point, reorder_qty, initial_stock, location_id } = req.body;

  const errors = collectErrors([
    [isNonEmptyString(name, 150), 'Product name is required (max 150 chars).'],
    [isValidSku(sku), 'SKU must be 3-30 letters/numbers/dashes, e.g. STL-ROD-01.'],
    [uom ? isNonEmptyString(uom, 30) : true, 'Unit of measure is invalid.'],
    [reorder_point !== undefined ? isNonNegativeNumber(reorder_point) : true, 'Reorder point must be a non-negative number.'],
    [reorder_qty !== undefined ? isNonNegativeNumber(reorder_qty) : true, 'Reorder quantity must be a non-negative number.'],
    [initial_stock !== undefined && initial_stock !== null && initial_stock !== '' ? isNonNegativeNumber(initial_stock) : true, 'Initial stock must be a non-negative number.'],
    [initial_stock ? !!location_id : true, 'A location is required when setting initial stock.']
  ]);
  if (errors.length) return res.status(400).json({ errors });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM products WHERE sku = ?', [sku.toUpperCase()]);
    if (existing.length) {
      await conn.rollback();
      return res.status(409).json({ errors: ['A product with this SKU already exists.'] });
    }

    const [result] = await conn.query(
      `INSERT INTO products (name, sku, category_id, uom, reorder_point, reorder_qty)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), sku.toUpperCase(), category_id || null, uom || 'unit', reorder_point || 0, reorder_qty || 0]
    );
    const productId = result.insertId;

    if (initial_stock && Number(initial_stock) > 0 && location_id) {
      const { appendLedgerEntry } = require('../utils/ledger');
      await appendLedgerEntry(conn, {
        product_id: productId,
        location_id,
        movement_type: 'adjustment',
        qty_change: Number(initial_stock),
        document_id: null,
        user_id: req.user.id
      });
    }

    await conn.commit();
    req.app.get('io').emit('stock:changed', { reason: 'product_created', product_id: productId });
    res.status(201).json({ id: productId, message: 'Product created.' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ errors: ['Failed to create product.'] });
  } finally {
    conn.release();
  }
});

// ---------------- UPDATE PRODUCT ----------------
router.put('/:id', async (req, res) => {
  const { name, category_id, uom, reorder_point, reorder_qty, is_active } = req.body;

  const errors = collectErrors([
    [name ? isNonEmptyString(name, 150) : true, 'Product name is invalid.'],
    [reorder_point !== undefined ? isNonNegativeNumber(reorder_point) : true, 'Reorder point must be a non-negative number.'],
    [reorder_qty !== undefined ? isNonNegativeNumber(reorder_qty) : true, 'Reorder quantity must be a non-negative number.']
  ]);
  if (errors.length) return res.status(400).json({ errors });

  try {
    await pool.query(
      `UPDATE products SET
        name = COALESCE(?, name),
        category_id = ?,
        uom = COALESCE(?, uom),
        reorder_point = COALESCE(?, reorder_point),
        reorder_qty = COALESCE(?, reorder_qty),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, category_id ?? null, uom, reorder_point, reorder_qty, is_active, req.params.id]
    );
    res.json({ message: 'Product updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: ['Failed to update product.'] });
  }
});

// ---------------- CATEGORIES ----------------
router.get('/categories/all', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM categories ORDER BY name');
  res.json(rows);
});

router.post('/categories', async (req, res) => {
  const { name } = req.body;
  if (!isNonEmptyString(name, 100)) return res.status(400).json({ errors: ['Category name is required.'] });
  try {
    const [result] = await pool.query('INSERT INTO categories (name) VALUES (?)', [name.trim()]);
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(409).json({ errors: ['Category already exists.'] });
  }
});

module.exports = router;
