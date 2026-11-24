-- Compra real: tamaño del saco/paquete y precio → avg_cost = pack_price / pack_size_kg
ALTER TABLE raw_materials ADD COLUMN pack_size_kg REAL NOT NULL DEFAULT 1;
ALTER TABLE raw_materials ADD COLUMN pack_price REAL NOT NULL DEFAULT 0;
