const crypto = require('crypto');

// Genesis hash — the "block 0" of the chain. Every fresh DB starts from this constant.
const GENESIS_HASH = '0'.repeat(64);

/**
 * Deterministically compute the hash for one ledger entry.
 * IMPORTANT: field order here must NEVER change once you've demoed / seeded data,
 * or every hash after that point will (correctly) fail verification.
 */
function computeEntryHash({ id, product_id, location_id, movement_type, qty_change, resulting_balance, document_id, user_id, ts, prev_hash }) {
  const payload = [
    id,
    product_id,
    location_id,
    movement_type,
    Number(qty_change).toFixed(3),
    Number(resulting_balance).toFixed(3),
    document_id ?? 'null',
    user_id,
    new Date(ts).toISOString(),
    prev_hash
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Fetch the hash of the most recent ledger row (or GENESIS_HASH if the ledger is empty).
 * Must be called within the same transaction/connection as the insert that follows it,
 * using a connection with a row lock, to avoid a race between two simultaneous writers.
 */
async function getLastHash(conn) {
  const [rows] = await conn.query('SELECT entry_hash FROM stock_ledger ORDER BY id DESC LIMIT 1 FOR UPDATE');
  if (rows.length === 0) return GENESIS_HASH;
  return rows[0].entry_hash;
}

/**
 * Append one ledger entry inside an existing transaction connection.
 * Also updates the stock_balances cache table.
 * Returns the inserted ledger row (with its id and hash).
 */
async function appendLedgerEntry(conn, { product_id, location_id, movement_type, qty_change, document_id, user_id }) {
  const prev_hash = await getLastHash(conn);

  // Get current balance, lock the row (or create it at 0 if it doesn't exist yet)
  const [balRows] = await conn.query(
    'SELECT id, quantity FROM stock_balances WHERE product_id = ? AND location_id = ? FOR UPDATE',
    [product_id, location_id]
  );

  let currentQty = 0;
  let balanceId;
  if (balRows.length === 0) {
    const [insertRes] = await conn.query(
      'INSERT INTO stock_balances (product_id, location_id, quantity) VALUES (?, ?, 0)',
      [product_id, location_id]
    );
    balanceId = insertRes.insertId;
  } else {
    currentQty = balRows[0].quantity;
    balanceId = balRows[0].id;
  }

  const resulting_balance = Number((currentQty + Number(qty_change)).toFixed(3));

  if (resulting_balance < 0) {
    const err = new Error(`Insufficient stock: available ${currentQty}, requested change ${qty_change}`);
    err.code = 'INSUFFICIENT_STOCK';
    throw err;
  }

  const ts = new Date();
  ts.setMilliseconds(0);

  // Insert ledger row first without hash to get its auto-increment id, then update with the hash.
  const [insertRes] = await conn.query(
    `INSERT INTO stock_ledger
      (product_id, location_id, movement_type, qty_change, resulting_balance, document_id, user_id, ts, prev_hash, entry_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [product_id, location_id, movement_type, qty_change, resulting_balance, document_id, user_id, ts, prev_hash, 'PENDING']
  );

  const id = insertRes.insertId;
  const entry_hash = computeEntryHash({
    id, product_id, location_id, movement_type, qty_change, resulting_balance, document_id, user_id, ts, prev_hash
  });

  await conn.query('UPDATE stock_ledger SET entry_hash = ? WHERE id = ?', [entry_hash, id]);
  await conn.query('UPDATE stock_balances SET quantity = ? WHERE id = ?', [resulting_balance, balanceId]);

  return { id, product_id, location_id, movement_type, qty_change, resulting_balance, document_id, user_id, ts, prev_hash, entry_hash };
}

/**
 * Walk the entire ledger in order and re-derive each hash from stored field values.
 * If any row's stored entry_hash doesn't match what we recompute, that row (and everything
 * after it) has been tampered with or corrupted.
 */
async function verifyChain(pool) {
  const [rows] = await pool.query('SELECT * FROM stock_ledger ORDER BY id ASC');

  let expectedPrevHash = GENESIS_HASH;
  const problems = [];

  for (const row of rows) {
    if (row.prev_hash !== expectedPrevHash) {
      problems.push({
        ledger_id: row.id,
        issue: 'BROKEN_CHAIN_LINK',
        detail: `Expected prev_hash ${expectedPrevHash.slice(0, 12)}... but row stores ${row.prev_hash.slice(0, 12)}...`
      });
    }

    const recomputed = computeEntryHash(row);
    if (recomputed !== row.entry_hash) {
      problems.push({
        ledger_id: row.id,
        issue: 'HASH_MISMATCH',
        detail: `Row data does not match its stored hash — this entry was likely edited after creation.`
      });
    }

    expectedPrevHash = row.entry_hash; // continue the chain using the STORED hash so we pinpoint exactly where it breaks
  }

  return {
    total_entries: rows.length,
    is_valid: problems.length === 0,
    problems
  };
}

module.exports = { GENESIS_HASH, computeEntryHash, getLastHash, appendLedgerEntry, verifyChain };
