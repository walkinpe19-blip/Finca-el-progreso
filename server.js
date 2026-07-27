const path = require('path');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'el_progreso_db',
    password: process.env.DB_PASSWORD || 'root',
    port: process.env.DB_PORT || 5432,
});

app.get('/api/categorias', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                c.id,
                c.nombre,
                COUNT(p.id)::int AS productos_count
            FROM categorias c
            LEFT JOIN productos p ON p.categoria_id = c.id
            GROUP BY c.id
            ORDER BY c.id ASC;
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al consultar categorías.' });
    }
});

app.post('/api/categorias', async (req, res) => {
    const nombre = req.body.nombre?.trim();
    if (!nombre) {
        return res.status(400).json({ error: 'El nombre de la categoría es obligatorio.' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO categorias (nombre) VALUES ($1) RETURNING *;',
            [nombre]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Esa categoría ya existe.' });
        }
        res.status(500).json({ error: 'Error al guardar la categoría.' });
    }
});

app.put('/api/categorias/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const nombre = req.body.nombre?.trim();

    if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'ID inválido.' });
    }
    if (!nombre) {
        return res.status(400).json({ error: 'El nombre de la categoría es obligatorio.' });
    }
    try {
        const result = await pool.query(
            'UPDATE categorias SET nombre = $1 WHERE id = $2 RETURNING *;',
            [nombre, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Ya existe una categoría con ese nombre.' });
        }
        res.status(500).json({ error: 'Error al actualizar la categoría.' });
    }
});

app.delete('/api/categorias/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'ID inválido.' });
    }

    const client = await pool.connect();

    try {
        const productos = await client.query(
            `
            SELECT id, nombre, precio, stock
            FROM productos
            WHERE categoria_id = $1
            ORDER BY id ASC;
            `,
            [id]
        );

        if (productos.rows.length > 0 && req.query.confirm !== 'true') {
            return res.status(409).json({
                error: 'Esta categoría tiene productos asignados.',
                productos: productos.rows
            });
        }

        await client.query('BEGIN');
        await client.query('UPDATE productos SET categoria_id = NULL WHERE categoria_id = $1;', [id]);
        const deleted = await client.query(
            'DELETE FROM categorias WHERE id = $1 RETURNING *;',
            [id]
        );

        if (deleted.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Categoría no encontrada.' });
        }

        await client.query('COMMIT');
        res.json({
            mensaje: 'Categoría eliminada correctamente.',
            productos_afectados: productos.rows
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al eliminar la categoría.' });
    } finally {
        client.release();
    }
});

app.get('/api/categorias/:id/productos', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'ID inválido.' });
    }
    try {
        const result = await pool.query(
            `
            SELECT id, nombre, precio, stock
            FROM productos
            WHERE categoria_id = $1
            ORDER BY id ASC;
            `,
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al consultar productos de la categoría.' });
    }
});

app.get('/api/productos', async (req, res) => {
    try {
        const query = `
            SELECT p.id, p.nombre, p.descripcion, p.precio, p.stock, p.estado,
                p.categoria_id AS categoria_id,
                COALESCE(c.nombre, 'Sin categoría') AS categoria
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            ORDER BY p.id DESC;
        `;
        const result = await pool.query(query);
        console.log('GET /api/productos rows=', result.rowCount);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al consultar productos.' });
    }
});

app.post('/api/productos', async (req, res) => {
    console.log('POST /api/productos body=', req.body);
    const contentType = req.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
        console.log('POST /api/productos invalid content-type', contentType);
        return res.status(415).json({ error: 'Content-Type debe ser application/json.' });
    }
    const { nombre, descripcion, precio, stock, categoria_id, estado } = req.body;
    if (!nombre || precio === undefined || precio === null || Number.isNaN(Number(precio)) || stock === undefined || stock === null || Number.isNaN(Number(stock)) || categoria_id === undefined || categoria_id === null || Number.isNaN(Number(categoria_id))) {
        console.log('POST /api/productos validation failed', { nombre, precio, stock, categoria_id });
        return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    }
    const estadoFinal = estado || 'Activo';
    try {
        const query = `
            INSERT INTO productos (nombre, descripcion, precio, stock, categoria_id, estado)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;
        `;
        const result = await pool.query(query, [nombre, descripcion, precio, stock, categoria_id, estadoFinal]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar el producto.' });
    }
});

app.patch('/api/productos/:id/estado', async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    if (!estado) {
        return res.status(400).json({ error: 'Falta el campo estado.' });
    }
    try {
        const query = 'UPDATE productos SET estado = $1 WHERE id = $2 RETURNING *;';
        const result = await pool.query(query, [estado, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar el estado.' });
    }
});

app.patch('/api/productos/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, precio, stock, categoria_id, estado } = req.body;
    const updates = [];
    const values = [];
    if (nombre !== undefined) {
        values.push(nombre);
        updates.push(`nombre = $${values.length}`);
    }
    if (descripcion !== undefined) {
        values.push(descripcion);
        updates.push(`descripcion = $${values.length}`);
    }
    if (precio !== undefined) {
        values.push(precio);
        updates.push(`precio = $${values.length}`);
    }
    if (stock !== undefined) {
        values.push(stock);
        updates.push(`stock = $${values.length}`);
    }
    if (categoria_id !== undefined) {
        values.push(categoria_id);
        updates.push(`categoria_id = $${values.length}`);
    }
    if (estado !== undefined) {
        values.push(estado);
        updates.push(`estado = $${values.length}`);
    }
    if (!updates.length) {
        return res.status(400).json({ error: 'No hay campos para actualizar.' });
    }
    try {
        const query = `UPDATE productos SET ${updates.join(', ')} WHERE id = $${values.length + 1} RETURNING *;`;
        values.push(id);
        console.log('PATCH /api/productos/' + id, query, values);
        const result = await pool.query(query, values);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('PATCH error', err);
        res.status(500).json({ error: 'Error al actualizar el producto.' });
    }
});

app.delete('/api/productos/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM productos WHERE id = $1 RETURNING *;', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Producto no encontrado.' });
        res.json({ mensaje: 'Eliminado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar.' });
    }
});

// Reporte en PDF
app.get('/api/reportes/productos/pdf', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.id, p.nombre, p.descripcion, p.precio, p.stock, p.estado,
                COALESCE(c.nombre, 'Sin categoría') AS categoria
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            ORDER BY p.id ASC;
        `);
        const productos = result.rows;

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const fecha = new Date();
        const fechaTexto = fecha.toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' });
        const horaTexto = fecha.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="reporte-productos-${fecha.toISOString().slice(0,10)}.pdf"`);
        doc.pipe(res);

        doc.fontSize(18).text('Finca Ganadera El Progreso', { align: 'center' });
        doc.fontSize(13).text('Reporte de Inventario de Productos', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(9).fillColor('gray')
           .text(`Generado el ${fechaTexto} a las ${horaTexto}`, { align: 'center' });
        doc.fillColor('black');
        doc.moveDown(1.5);

        const startX = 40;
        let y = doc.y;
        const colWidths = [30, 120, 90, 60, 50, 70, 90];
        const headers = ['ID', 'Nombre', 'Categoría', 'Precio', 'Stock', 'Estado', 'Descripción'];

        doc.fontSize(9).font('Helvetica-Bold');
        let x = startX;
        headers.forEach((h, i) => {
            doc.text(h, x, y, { width: colWidths[i] });
            x += colWidths[i];
        });
        doc.moveTo(startX, y + 15).lineTo(555, y + 15).stroke();
        doc.font('Helvetica');
        y += 22;

        productos.forEach(p => {
            if (y > 760) {
                doc.addPage();
                y = 40;
            }
            x = startX;
            const valores = [
                String(p.id), p.nombre, p.categoria,
                `$${Number(p.precio).toFixed(2)}`, String(p.stock),
                p.estado, p.descripcion || '-'
            ];
            valores.forEach((v, i) => {
                doc.fontSize(8).text(v, x, y, { width: colWidths[i] });
                x += colWidths[i];
            });
            y += 20;
        });

        doc.moveDown(2);
        doc.fontSize(8).fillColor('gray')
           .text(`Total de productos: ${productos.length}`, startX, doc.y);

        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al generar el reporte PDF.' });
    }
});

// Reporte en Excel
app.get('/api/reportes/productos/excel', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.id, p.nombre, p.descripcion, p.precio, p.stock, p.estado,
                COALESCE(c.nombre, 'Sin categoría') AS categoria
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            ORDER BY p.id ASC;
        `);
        const productos = result.rows;
        const fecha = new Date();
        const fechaTexto = fecha.toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' });
        const horaTexto = fecha.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Finca El Progreso';
        workbook.created = fecha;
        const sheet = workbook.addWorksheet('Reporte de Productos');

        sheet.mergeCells('A1:G1');
        sheet.getCell('A1').value = 'Finca Ganadera El Progreso — Reporte de Inventario';
        sheet.getCell('A1').font = { size: 14, bold: true };
        sheet.getCell('A1').alignment = { horizontal: 'center' };

        sheet.mergeCells('A2:G2');
        sheet.getCell('A2').value = `Generado el ${fechaTexto} a las ${horaTexto}`;
        sheet.getCell('A2').font = { size: 10, italic: true, color: { argb: 'FF666666' } };
        sheet.getCell('A2').alignment = { horizontal: 'center' };

        sheet.addRow([]);

        const headerRow = sheet.addRow(['ID', 'Nombre', 'Categoría', 'Precio', 'Stock', 'Estado', 'Descripción']);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
            cell.alignment = { horizontal: 'center' };
        });

        productos.forEach(p => {
            sheet.addRow([
                p.id, p.nombre, p.categoria,
                Number(p.precio), p.stock, p.estado, p.descripcion || '-'
            ]);
        });

        sheet.columns = [
            { width: 8 }, { width: 25 }, { width: 18 },
            { width: 12 }, { width: 10 }, { width: 12 }, { width: 35 }
        ];
        sheet.getColumn(4).numFmt = '"$"#,##0.00';

        sheet.addRow([]);
        const totalRow = sheet.addRow([`Total de productos: ${productos.length}`]);
        totalRow.font = { italic: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="reporte-productos-${fecha.toISOString().slice(0,10)}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al generar el reporte Excel.' });
    }
});

app.get('/debug/routes', (req, res) => {
    const routes = [];
    const stack = app._router?.stack || [];
    stack.forEach(layer => {
        if (layer.route && layer.route.path) {
            const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
            routes.push({ path: layer.route.path, methods });
        }
    });
    res.json(routes);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor en puerto ${PORT}`);
    const stack = app._router?.stack || [];
    stack.forEach(layer => {
        if (layer.route && layer.route.path) {
            const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
            console.log('Route:', methods, layer.route.path);
        }
    });
});