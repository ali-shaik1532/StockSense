const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { isNonEmptyString, collectErrors } = require('../utils/validate');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM warehouses ORDER BY name');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name, address } = req.body;
  const errors = collectErrors([[isNonEmptyString(name, 100), 'Warehouse name is required.']]);
  if (errors.length) return res.status(400).json({ errors });

  const [result] = await pool.query('INSERT INTO warehouses (name, address) VALUES (?, ?)', [name.trim(), address || null]);
  res.status(201).json({ id: result.insertId });
});

router.get('/:id/locations', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM locations WHERE warehouse_id = ? ORDER BY name', [req.params.id]);
  res.json(rows);
});

router.post('/:id/locations', async (req, res) => {
  const { name } = req.body;
  const errors = collectErrors([[isNonEmptyString(name, 100), 'Location name is required.']]);
  if (errors.length) return res.status(400).json({ errors });

  const [result] = await pool.query(
    'INSERT INTO locations (warehouse_id, name) VALUES (?, ?)',
    [req.params.id, name.trim()]
  );
  res.status(201).json({ id: result.insertId });
});

// All locations across all warehouses (used to populate dropdowns quickly)
router.get('/locations/all', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT l.id, l.name, l.warehouse_id, w.name AS warehouse_name
     FROM locations l JOIN warehouses w ON w.id = l.warehouse_id
     ORDER BY w.name, l.name`
  );
  res.json(rows);
});

module.exports = router;
