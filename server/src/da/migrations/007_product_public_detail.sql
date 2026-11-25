-- Detalle público de productos (vitrina): ingredientes y nutrición
ALTER TABLE products ADD COLUMN ingredients_public TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN nutrition_json TEXT NOT NULL DEFAULT '';
