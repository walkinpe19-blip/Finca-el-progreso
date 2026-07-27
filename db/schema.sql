-- Base de datos para Finca Ganadera El Progreso
-- Si aún no existe, crea la base de datos con:
--   createdb el_progreso_db
-- Luego ejecuta este script desde PostgreSQL:
--   psql -d el_progreso_db -f db/schema.sql

CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio NUMERIC(10, 2) NOT NULL CHECK (precio > 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo','Inactivo','Sin stock')),
    categoria_id INT REFERENCES categorias(id) ON DELETE SET NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Si ya existe la tabla y necesitas aplicar los cambios de categorías/estado:
ALTER TABLE productos
ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'Activo'
    CHECK (estado IN ('Activo', 'Inactivo', 'Sin stock'));

UPDATE productos
SET estado = 'Sin stock'
WHERE stock = 0;

ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_categoria_id_fkey;

ALTER TABLE productos
ADD CONSTRAINT productos_categoria_id_fkey
FOREIGN KEY (categoria_id) REFERENCES categorias(id)
ON DELETE SET NULL;
INSERT INTO categorias (nombre) VALUES 
('Lácteos'), ('Cárnicos'), ('Derivados');

INSERT INTO productos (nombre, descripcion, precio, stock, categoria_id) VALUES 
('Queso Artesanal 1lb', 'Queso fresco', 250.00, 20, 1),
('Leche Fresca 1L', 'Leche entera pasteurizada', 75.00, 50, 1),
('Corte Carne Premium 1lb', 'Carne bovina', 350.00, 15, 2);
