-- ============================================================
-- StockSense Database Schema
-- MySQL 8+
-- ============================================================

CREATE DATABASE IF NOT EXISTS stocksense;
USE stocksense;

-- ---------------- USERS & AUTH ----------------
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('inventory_manager','warehouse_staff','admin') NOT NULL DEFAULT 'warehouse_staff',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE otp_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) DEFAULT 0,
  attempts INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------- WAREHOUSES & LOCATIONS ----------------
CREATE TABLE warehouses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  warehouse_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,          -- e.g. "Rack A", "Production Floor"
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
);

-- ---------------- PRODUCTS ----------------
CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  sku VARCHAR(60) NOT NULL UNIQUE,
  category_id INT,
  uom VARCHAR(30) NOT NULL DEFAULT 'unit',   -- unit of measure
  reorder_point DECIMAL(14,3) DEFAULT 0,     -- trigger low-stock alert
  reorder_qty DECIMAL(14,3) DEFAULT 0,       -- suggested reorder quantity
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Current stock snapshot per product per location.
-- This is a DERIVED CACHE — the stock_ledger table below is the source of truth.
-- Always recomputable: SUM(qty_change) grouped by product_id, location_id.
CREATE TABLE stock_balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  location_id INT NOT NULL,
  quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_prod_loc (product_id, location_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);

-- ---------------- DOCUMENTS (Receipts / Delivery / Internal / Adjustment) ----------------
CREATE TABLE documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doc_number VARCHAR(30) NOT NULL UNIQUE,     -- e.g. RCPT-0001
  doc_type ENUM('receipt','delivery','internal','adjustment') NOT NULL,
  status ENUM('draft','waiting','ready','done','canceled') NOT NULL DEFAULT 'draft',
  warehouse_id INT NOT NULL,
  partner_name VARCHAR(150),                  -- supplier / customer name (nullable for internal/adjustment)
  reason TEXT,                                -- mandatory for adjustments
  created_by INT NOT NULL,
  validated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  validated_at DATETIME,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (validated_by) REFERENCES users(id)
);

CREATE TABLE document_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,            -- for adjustment: COUNTED quantity (absolute)
  from_location_id INT,                       -- used by delivery / internal
  to_location_id INT,                         -- used by receipt / internal
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (from_location_id) REFERENCES locations(id),
  FOREIGN KEY (to_location_id) REFERENCES locations(id)
);

-- ---------------- STOCK LEDGER (SOURCE OF TRUTH — HASH CHAINED) ----------------
-- Every stock movement, ever. Immutable by application design.
-- entry_hash = SHA256(id + product_id + location_id + qty_change + movement_type + document_id + user_id + timestamp + prev_hash)
-- This creates a verifiable chain: tampering with any past row breaks every hash after it.
CREATE TABLE stock_ledger (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  location_id INT NOT NULL,
  movement_type ENUM('receipt','delivery','transfer_in','transfer_out','adjustment') NOT NULL,
  qty_change DECIMAL(14,3) NOT NULL,          -- positive or negative
  resulting_balance DECIMAL(14,3) NOT NULL,   -- balance AFTER this entry, for audit readability
  document_id INT,
  user_id INT NOT NULL,
  ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  prev_hash CHAR(64) NOT NULL,
  entry_hash CHAR(64) NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (location_id) REFERENCES locations(id),
  FOREIGN KEY (document_id) REFERENCES documents(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Anomaly flags raised on adjustments/ledger entries (rule-based, no ML needed)
CREATE TABLE anomaly_flags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ledger_id INT NOT NULL,
  rule VARCHAR(100) NOT NULL,      -- e.g. 'LARGE_ADJUSTMENT', 'OFF_HOURS', 'REPEATED_ADJUSTMENT'
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ledger_id) REFERENCES stock_ledger(id) ON DELETE CASCADE
);

-- ---------------- SEED DATA ----------------
INSERT INTO warehouses (name, address) VALUES
  ('Main Warehouse', 'Plot 12, Industrial Area'),
  ('Warehouse 2', 'Sector 9, Logistics Park');

INSERT INTO locations (warehouse_id, name) VALUES
  (1, 'Rack A'), (1, 'Rack B'), (1, 'Production Floor'), (1, 'Receiving Dock'),
  (2, 'Rack A'), (2, 'Shipping Dock');

INSERT INTO categories (name) VALUES ('Raw Materials'), ('Finished Goods'), ('Packaging');

-- Default genesis hash for the ledger chain (block 0)
-- This constant is referenced in code as GENESIS_HASH.
