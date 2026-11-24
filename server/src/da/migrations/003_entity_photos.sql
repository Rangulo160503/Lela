-- Fotos en materia prima y combos (ruta local bajo /uploads o /images)
ALTER TABLE raw_materials ADD COLUMN photo_path TEXT;
ALTER TABLE promos ADD COLUMN photo_path TEXT;
