-- MVP Panadería Lela — usuarios, catálogo extendido, finanzas, turnos, propuestas

ALTER TABLE products ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN photo_path TEXT;
ALTER TABLE products ADD COLUMN base_product_id TEXT;
ALTER TABLE products ADD COLUMN presentation_name TEXT NOT NULL DEFAULT 'Unidad';

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('principal', 'admin', 'empleado')),
  pin_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  permissions_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS price_history (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  old_price REAL NOT NULL,
  new_price REAL NOT NULL,
  changed_by TEXT,
  created_at TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS product_change_log (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS raw_materials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  stock REAL NOT NULL DEFAULT 0 CHECK (stock >= 0),
  avg_cost REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  official INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  raw_material_id TEXT NOT NULL REFERENCES raw_materials(id),
  quantity REAL NOT NULL CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS production_plans (
  id TEXT PRIMARY KEY,
  business_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'confirmed', 'cancelled')),
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS production_plan_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id TEXT NOT NULL REFERENCES production_plans(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  planned_qty INTEGER NOT NULL CHECK (planned_qty >= 0),
  confirmed_qty INTEGER,
  recipe_id TEXT
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  supplier_id TEXT REFERENCES suppliers(id),
  invoice_number TEXT NOT NULL DEFAULT '',
  purchased_at TEXT NOT NULL,
  total REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  payment_account TEXT,
  due_date TEXT,
  photo_path TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  raw_material_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL,
  subtotal REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  purchase_id TEXT REFERENCES purchases(id),
  amount REAL NOT NULL CHECK (amount > 0),
  paid_at TEXT NOT NULL,
  account TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS cash_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('efectivo','caja_fuerte','banco','sinpe','tarjeta')),
  balance REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cash_movements (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES cash_accounts(id),
  amount REAL NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in','out','transfer')),
  counterparty_account_id TEXT,
  category TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  photo_path TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  account_id TEXT NOT NULL REFERENCES cash_accounts(id),
  category TEXT NOT NULL DEFAULT 'general',
  photo_path TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shift_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES shift_templates(id),
  business_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','closed')),
  opened_at TEXT NOT NULL,
  opened_by TEXT,
  closed_at TEXT,
  closed_by TEXT,
  previous_shift_id TEXT,
  notes TEXT NOT NULL DEFAULT '',
  expected_cash REAL,
  counted_cash REAL,
  expected_inventory_json TEXT,
  counted_inventory_json TEXT,
  physical_sheet_photo TEXT,
  close_snapshot_json TEXT
);

CREATE TABLE IF NOT EXISTS shift_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','changes_requested','approved','rejected','partial')),
  title TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS proposal_items (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  applied INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS promos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('promo','combo')),
  price REAL NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promo_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  promo_id TEXT NOT NULL REFERENCES promos(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  substitutable INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exit_records (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  motive TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  photo_path TEXT,
  audio_path TEXT,
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  created_by TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS inventory_counts (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  created_by TEXT,
  scope TEXT NOT NULL DEFAULT 'finished',
  notes TEXT NOT NULL DEFAULT '',
  lines_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS print_jobs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  sale_id TEXT,
  status TEXT NOT NULL,
  printer_name TEXT,
  error_message TEXT,
  payload_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backups_log (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  path TEXT NOT NULL,
  kind TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT 'application/octet-stream'
);
