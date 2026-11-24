-- Rendimiento del lote (unidades terminadas) para costeo por pieza
ALTER TABLE recipes ADD COLUMN batch_yield REAL NOT NULL DEFAULT 1;
