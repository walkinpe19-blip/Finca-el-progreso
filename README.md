# Finca Ganadera El Progreso

Proyecto web con frontend estático en HTML/CSS/JavaScript y backend en Node.js + Express conectado a PostgreSQL.

## Tecnologías usadas

- Node.js
- Express
- PostgreSQL
- PDFKit
- ExcelJS
- CORS

## Dependencias

Instala las dependencias principales con:

```bash
npm install
```

Si prefieres instalarlas de forma explícita, ejecuta:

```bash
npm install express cors pg pdfkit exceljs
```

## Configuración de la base de datos

1. Asegúrate de tener PostgreSQL instalado y en ejecución.
2. Crea la base de datos usada por el proyecto:

```bash
createdb el_progreso_db
```

3. Importa el esquema y los datos iniciales:

```bash
psql -d el_progreso_db -f db/schema.sql
```

4. Opcionalmente, define variables de entorno si no quieres usar las credenciales por defecto:

```bash
export DB_USER=postgres
export DB_PASSWORD=root
export DB_HOST=localhost
export DB_NAME=el_progreso_db
export DB_PORT=5432
export PORT=5500
```

> En Windows PowerShell usa `setx` o un archivo `.env` según tu entorno.

## Estructura de la base de datos

El archivo `db/schema.sql` crea las tablas:

- `categorias`
  - `id` SERIAL PRIMARY KEY
  - `nombre` VARCHAR(50) NOT NULL UNIQUE

- `productos`
  - `id` SERIAL PRIMARY KEY
  - `nombre` VARCHAR(100) NOT NULL
  - `descripcion` TEXT
  - `precio` NUMERIC(10, 2) NOT NULL CHECK (precio > 0)
  - `stock` INT NOT NULL DEFAULT 0 CHECK (stock >= 0)
  - `estado` VARCHAR(20) NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo','Inactivo','Sin stock'))
  - `categoria_id` INT REFERENCES categorias(id) ON DELETE SET NULL
  - `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

- `usuarios`
  - `id_usuario` SERIAL PRIMARY KEY
  - `nombre` VARCHAR(100) NOT NULL
  - `apellido` VARCHAR(100) NOT NULL
  - `correo` VARCHAR(150) NOT NULL UNIQUE
  - `telefono` VARCHAR(20)
  - `contraseña` VARCHAR(255) NOT NULL
  - `rol` VARCHAR(20) NOT NULL DEFAULT 'usuario' CHECK (rol IN ('usuario','admin'))

El sistema de autenticación usa estas rutas principales:

- `POST /api/auth/register` para crear usuarios nuevos.
- `POST /api/auth/login` para iniciar sesión.
- `GET /api/auth/me` para obtener el usuario autenticado mediante token.

El frontend guarda el token en `localStorage` y lo envía en el encabezado `Authorization: Bearer <token>` para acceder a rutas protegidas.

### Consultas SQL usadas para categorías

Estas son las consultas principales usadas por el backend para administrar categorías:

- Obtener todas las categorías con la cantidad de productos:

```sql
SELECT c.id, c.nombre, COUNT(p.id)::int AS productos_count
FROM categorias c
LEFT JOIN productos p ON p.categoria_id = c.id
GROUP BY c.id
ORDER BY c.id ASC;
```

- Insertar una nueva categoría:

```sql
INSERT INTO categorias (nombre) VALUES ($1) RETURNING *;
```

- Actualizar el nombre de una categoría:

```sql
UPDATE categorias SET nombre = $1 WHERE id = $2 RETURNING *;
```

- Eliminar una categoría y liberar productos asociados:

```sql
BEGIN;
UPDATE productos SET categoria_id = NULL WHERE categoria_id = $1;
DELETE FROM categorias WHERE id = $1 RETURNING *;
COMMIT;
```

- Listar los productos de una categoría específica:

```sql
SELECT id, nombre, precio, stock
FROM productos
WHERE categoria_id = $1
ORDER BY id ASC;
```

## Endpoints principales

- `GET /api/categorias`
- `POST /api/categorias`
- `PUT /api/categorias/:id`
- `DELETE /api/categorias/:id`
- `GET /api/productos`
- `POST /api/productos`
- `PATCH /api/productos/:id`
- `DELETE /api/productos/:id`
- `GET /api/reportes/productos/pdf`
- `GET /api/reportes/productos/excel`

## Ejecutar el servidor

Inicia el servidor con:

```bash
node server.js
```

Luego abre en el navegador:

```text
http://127.0.0.1:5501
```

## Notas

- El backend usa PostgreSQL para almacenar categorías y productos.
- Los reportes en PDF y Excel se generan con `pdfkit` y `exceljs`.
- El campo `stock` puede ser `0` para indicar "sin stock".
