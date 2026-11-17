-- Panadería Lela — esquema inicial (Stage 1 + cimientos MVP)

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  physical_stock INTEGER NOT NULL CHECK (physical_stock >= 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  total REAL NOT NULL CHECK (total >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('efectivo', 'sinpe', 'tarjeta')),
  amount_paid REAL NOT NULL CHECK (amount_paid >= 0),
  change_amount REAL NOT NULL CHECK (change_amount >= 0)
);

CREATE TABLE IF NOT EXISTS sale_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  subtotal REAL NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sale_lines_sale_id ON sale_lines(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);

CREATE TABLE IF NOT EXISTS production_sheets (
  id TEXT PRIMARY KEY,
  business_date TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS production_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sheet_id TEXT NOT NULL REFERENCES production_sheets(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sold INTEGER NOT NULL CHECK (sold >= 0),
  stock_before INTEGER NOT NULL CHECK (stock_before >= 0),
  quantity INTEGER NOT NULL CHECK (quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_production_lines_sheet ON production_lines(sheet_id);

CREATE TABLE IF NOT EXISTS merma_records (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  stock_before INTEGER NOT NULL CHECK (stock_before >= 0),
  stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
  reason TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_merma_created_at ON merma_records(created_at DESC);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity_delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id, created_at);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
