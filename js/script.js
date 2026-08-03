const header = document.querySelector("header");
const ctaButtons = document.querySelectorAll(".cta a, .contacto-cta a");
const contactForm = document.querySelector(".formulario form");
const mapIframe = document.querySelector(".mapa-contenedor iframe");

function toggleHeaderScroll() {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 50);
}

function animateButtonPress(button) {
    button.classList.add("clicked");
    setTimeout(() => button.classList.remove("clicked"), 180);
}

function bindCtaButtons() {
    if (!ctaButtons.length) return;
    ctaButtons.forEach(button => {
        button.addEventListener("click", event => {
            animateButtonPress(button);
            console.log(`Botón CTA presionado: ${button.textContent.trim()}`);
            if (button.closest(".contacto-cta")) {
                event.preventDefault();
                window.location.href = button.href;
            }
        });
    });
}

function showFormMessage(message, isError = false) {
    if (!contactForm) return;
    let messageBox = contactForm.querySelector(".form-message");
    if (!messageBox) {
        messageBox = document.createElement("div");
        messageBox.className = "form-message";
        contactForm.prepend(messageBox);
    }
    messageBox.textContent = message;
    messageBox.style.color = isError ? "#b71c1c" : "#1b5e20";
}

function validateContactForm(values) {
    const errors = [];
    if (!values.name) errors.push("Por favor escribe tu nombre.");
    if (!values.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) {
        errors.push("Ingresa un correo válido.");
    }
    if (!values.message) errors.push("El mensaje no puede quedar vacío.");
    return errors;
}

function bindContactForm() {
    if (!contactForm) return;
    contactForm.addEventListener("submit", event => {
        event.preventDefault();
        const formData = new FormData(contactForm);
        const values = {
            name: formData.get("name")?.toString().trim(),
            email: formData.get("email")?.toString().trim(),
            phone: formData.get("phone")?.toString().trim(),
            message: formData.get("message")?.toString().trim(),
        };
        const errors = validateContactForm(values);
        if (errors.length) {
            showFormMessage(errors.join(" "), true);
            return;
        }
        showFormMessage("Mensaje enviado. Te contactaremos lo antes posible.");
        contactForm.reset();
    });
}

function setupMapFrame() {
    if (!mapIframe) return;
    mapIframe.addEventListener("load", () => {
        console.log("Mapa cargado correctamente.");
    });
}

const origin = window.location.origin;
const isLocalHost = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
const isLiveServerPort = window.location.port && window.location.port.startsWith('55');
const usingBrowserFile = origin === 'null' || origin.startsWith('file:');

let API_BASE = window.API_BASE || (usingBrowserFile || (isLocalHost && isLiveServerPort)
    ? 'http://127.0.0.1:3000'
    : origin);
window.API_BASE = API_BASE;

const CURRENT_ORIGIN = window.location.origin === 'null'
    ? (window.location.protocol === 'file:' ? '' : window.location.origin)
    : window.location.origin;
const LOGIN_PAGE = CURRENT_ORIGIN ? `${CURRENT_ORIGIN}/html/login.html` : '/html/login.html';
const PRODUCTOS_PAGE = CURRENT_ORIGIN ? `${CURRENT_ORIGIN}/html/productos.html` : '/html/productos.html';
const REPORTES_PAGE = CURRENT_ORIGIN ? `${CURRENT_ORIGIN}/html/reportes.html` : '/html/reportes.html';
let categoriaMap = {};
let currentUser = null;

function getToken() {
    return localStorage.getItem('finca_token');
}

function setAuthHeader(headers = {}) {
    const token = getToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

function showAuthMessage(element, text, isSuccess = false) {
    if (!element) return;
    element.textContent = text;
    element.classList.toggle('success', isSuccess);
    element.classList.toggle('error', !isSuccess);
}

async function applyAuthState() {
    const token = getToken();
    const currentPage = window.location.pathname.split('/').pop();
    const isAdminPage = ['gestion.html', 'categorias.html', 'usuarios.html'].includes(currentPage);

    if (!token) {
        currentUser = null;
        updateNavForAuth();

        // Redirigir si intenta acceder a páginas de admin sin autenticación
        if (isAdminPage) {
            window.location.replace(LOGIN_PAGE);
        }
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
            headers: setAuthHeader()
        });
        if (!response.ok) {
            throw new Error('No autenticado');
        }

        currentUser = await response.json();
        updateNavForAuth();

        // Redirigir usuarios regulares que intenten acceder a gestion o categorias
        if (isAdminPage && currentUser.rol !== 'admin') {
            window.location.replace(REPORTES_PAGE);
        }
    } catch (error) {
        currentUser = null;
        localStorage.removeItem('finca_token');
        updateNavForAuth();

        // Redirigir si falla autenticación e intenta acceder a admin pages
        if (isAdminPage) {
            window.location.replace(LOGIN_PAGE);
        }
    }
}

function updateNavForAuth() {
    const nav = document.querySelector('nav');
    if (!nav) return;

    const existingUser = document.getElementById('nav-user');
    if (existingUser) existingUser.remove();

    const existingLogin = Array.from(nav.querySelectorAll('a')).find(link => link.textContent.trim() === 'Iniciar sesión');
    if (existingLogin) existingLogin.remove();

    if (!currentUser) {
        const loginLink = document.createElement('a');
        loginLink.href = LOGIN_PAGE;
        loginLink.textContent = 'Iniciar sesión';
        nav.appendChild(loginLink);
    } else {
        const userContainer = document.createElement('div');
        userContainer.style.display = 'flex';
        userContainer.style.alignItems = 'center';
        userContainer.style.gap = '15px';
        
        const userBlock = document.createElement('div');
        userBlock.id = 'nav-user';
        userBlock.className = 'nav-user';
        userBlock.innerHTML = `
            <div class="avatar">${(currentUser.nombre || 'U').charAt(0)}${(currentUser.apellido || 'U').charAt(0)}</div>
            <div class="user-info">
                <strong>${escapeHtml(currentUser.nombre)} ${escapeHtml(currentUser.apellido)}</strong>
                <span>online</span>
            </div>
        `;
        
        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'logout-btn';
        logoutBtn.textContent = 'Cerrar sesión';
        logoutBtn.onclick = logout;
        
        userContainer.appendChild(userBlock);
        userContainer.appendChild(logoutBtn);
        nav.appendChild(userContainer);
    }

    const adminLinks = document.querySelectorAll('.nav-admin-only');
    adminLinks.forEach(link => {
        if (currentUser && currentUser.rol === 'admin') {
            link.style.display = 'inline-block';
        } else {
            link.style.display = 'none';
        }
    });
}

function initSiteScripts() {
    window.addEventListener("scroll", toggleHeaderScroll);
    toggleHeaderScroll();
    bindCtaButtons();
    bindContactForm();
    setupMapFrame();
}

document.addEventListener("DOMContentLoaded", async () => {
    initSiteScripts();
    console.log('script.js loaded, API_BASE=', API_BASE);
    await applyAuthState();
    await cargarCategorias();
    if (document.getElementById('tabla-productos')) {
        await cargarReporteProductos();
    }
    if (document.getElementById('tabla-usuarios')) {
        await cargarUsuarios();
    }
});

let categoriaPendienteEliminar = null;

const form = document.getElementById('form-producto');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('nombre')?.value.trim();
            const descripcion = document.getElementById('descripcion')?.value.trim();
            const precioValue = document.getElementById('precio')?.value;
            const precio = parseFloat(precioValue);
            const stockValue = document.getElementById('stock')?.value;
            const stock = Number(stockValue);
            const categoriaValue = document.getElementById('categoria_id')?.value;
            const categoria_id = Number(categoriaValue);
            const estado = document.getElementById('estado')?.value || 'Activo';
            const mensaje = document.getElementById('mensaje');
            console.log('gestion submit', { nombre, descripcion, precioValue, precio, stockValue, stock, categoriaValue, categoria_id, estado });
            if (!nombre || Number.isNaN(precio) || stockValue === '' || Number.isNaN(stock) || categoriaValue === '' || Number.isNaN(categoria_id) || !estado) {
                if (mensaje) mensaje.textContent = 'Completa todos los campos correctamente.';
                return;
            }
            try {
                const payload = { nombre, descripcion, precio, stock, categoria_id, estado };
                console.log('POST /api/productos payload', payload);
                const response = await fetch(`${API_BASE}/api/productos`, {
                    method: 'POST',
                    headers: setAuthHeader({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (!response.ok) {
                    if (mensaje) mensaje.textContent = data.error || 'Error al guardar el producto.';
                    return;
                }
                if (mensaje) mensaje.textContent = 'Producto guardado correctamente.';
                form.reset();
                cargarReporteProductos();
            } catch (error) {
                if (mensaje) mensaje.textContent = 'Error de conexión con el servidor.';
            }
        });
    }

    const modal = document.getElementById('modal-editar');
    const btnCerrar = document.getElementById('modal-cerrar');
    const btnCancelar = document.getElementById('modal-cancelar');
    const formEditar = document.getElementById('form-editar-producto');

    if (btnCerrar) btnCerrar.addEventListener('click', closeEditModal);
    if (btnCancelar) btnCancelar.addEventListener('click', closeEditModal);
    if (formEditar) formEditar.addEventListener('submit', manejarEnvioEdicion);

    const formCategoria = document.getElementById('form-categoria');
    const btnCancelarEliminar = document.getElementById('btn-cancelar-eliminacion');
    const btnConfirmarEliminar = document.getElementById('btn-confirmar-eliminacion');

    if (formCategoria) {
        formCategoria.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('categoria-nombre')?.value.trim();
            const id = document.getElementById('categoria-editar-id')?.value;
            const mensajeCategorias = document.getElementById('mensaje-categorias');

            if (!nombre) {
                if (mensajeCategorias) mensajeCategorias.textContent = 'Escribe un nombre para la categoría.';
                return;
            }
            try {
                const esEdicion = !!id;
                const response = await fetch(
                    esEdicion ? `${API_BASE}/api/categorias/${id}` : `${API_BASE}/api/categorias`,
                    {
                        method: esEdicion ? 'PUT' : 'POST',
                        headers: setAuthHeader({ 'Content-Type': 'application/json' }),
                        body: JSON.stringify({ nombre })
                    }
                );
                const data = await response.json();
                if (!response.ok) {
                    if (mensajeCategorias) mensajeCategorias.textContent = data.error || 'No se pudo guardar la categoría.';
                    return;
                }
                if (mensajeCategorias) mensajeCategorias.textContent = 'Categoría guardada correctamente.';
                document.getElementById('categoria-editar-id').value = '';
                document.getElementById('categoria-nombre').value = '';
                document.getElementById('btn-guardar-categoria').textContent = 'Agregar';
                await refrescarCategorias();
            } catch (error) {
                if (mensajeCategorias) mensajeCategorias.textContent = 'Error de conexión con el servidor.';
            }
        });
    }

    if (btnCancelarEliminar) {
        btnCancelarEliminar.addEventListener('click', () => {
            document.getElementById('panel-confirmacion').classList.add('oculto');
            categoriaPendienteEliminar = null;
        });
    }

    if (btnConfirmarEliminar) {
        btnConfirmarEliminar.addEventListener('click', confirmarEliminacionCategoria);
    }

    if (document.getElementById('lista-categorias')) {
        cargarCategoriasGestion();
    }

    const btnDescargarReporte = document.getElementById('btn-descargar-reporte');
    if (btnDescargarReporte) {
        btnDescargarReporte.addEventListener('click', () => {
            const formato = document.getElementById('formato-reporte').value;
            const url = formato === 'pdf'
                ? `${API_BASE}/api/reportes/productos/pdf`
                : `${API_BASE}/api/reportes/productos/excel`;
            window.location.href = url;
        });
    }

    const formLogin = document.getElementById('form-login');
    if (formLogin) {
        const message = document.getElementById('login-message');
        const registered = new URLSearchParams(window.location.search).get('registered');
        if (registered === '1') {
            showAuthMessage(message, 'Usuario registrado. Inicia sesión.', true);
            history.replaceState(null, '', window.location.pathname);
        }
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const correo = document.getElementById('login-correo').value.trim();
            const contraseña = document.getElementById('login-password').value;
            try {
                const loginUrl = `${API_BASE}/api/auth/login`;
                console.log('Login URL:', loginUrl);
                const response = await fetch(loginUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ correo, contraseña })
                });
                const data = await response.json();
                if (!response.ok) {
                    showAuthMessage(message, data.error || 'No se pudo iniciar sesión.', false);
                    return;
                }
                localStorage.setItem('finca_token', data.token);
                currentUser = data.usuario;
                updateNavForAuth();
                window.location.href = '../index.html';
            } catch (error) {
                if (message) message.textContent = 'Error de conexión.';
            }
        });
    }

    const formRegistro = document.getElementById('form-registro');
    if (formRegistro) {
        formRegistro.addEventListener('submit', async (e) => {
            e.preventDefault();
            const message = document.getElementById('registro-message');
            const payload = {
                nombre: document.getElementById('registro-nombre').value.trim(),
                apellido: document.getElementById('registro-apellido').value.trim(),
                correo: document.getElementById('registro-correo').value.trim(),
                telefono: document.getElementById('registro-telefono').value.trim(),
                contraseña: document.getElementById('registro-password').value,
                rol: 'usuario'
            };
            try {
                const response = await fetch(`${API_BASE}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (!response.ok) {
                    if (message) showAuthMessage(message, data.error || 'No se pudo registrar.', false);
                    return;
                }
                formRegistro.reset();
                window.location.href = 'login.html?registered=1';
            } catch (error) {
                if (message) message.textContent = 'Error de conexión.';
            }
        });
    }

async function cargarCategorias() {
    const selects = Array.from(document.querySelectorAll('#categoria_id, #editar-categoria_id'));
    if (!selects.length) return;
    try {
        const response = await fetch(`${API_BASE}/api/categorias`);
        if (!response.ok) {
            throw new Error('No se pudo cargar las categorías');
        }
        const categorias = await response.json();
        categoriaMap = {};
        categorias.forEach(categoria => {
            categoriaMap[categoria.nombre] = categoria.id;
            categoriaMap[categoria.id] = categoria.id;
        });
        selects.forEach(select => {
            select.innerHTML = '<option value="">Selecciona categoría...</option>';
            categorias.forEach(categoria => {
                const option = document.createElement('option');
                option.value = categoria.id;
                option.textContent = categoria.nombre;
                select.appendChild(option);
            });
        });
    } catch (error) {
        console.error('Error al cargar categorías', error);
    }
}

async function cargarReporteProductos() {
    const tbody = document.getElementById('tabla-productos');
    if (!tbody) return;
    try {
        const response = await fetch(`${API_BASE}/api/productos`);
        const productos = await response.json();
        tbody.innerHTML = '';
        productos.forEach(producto => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${producto.id}</td>
                <td>${producto.nombre}</td>
                <td>${producto.categoria}</td>
                <td>${producto.precio}</td>
                <td>${producto.stock}</td>
                <td>${producto.estado}</td>
                <td></td>
            `;
            const actions = tr.querySelector('td:last-child');
            
            if (currentUser && currentUser.rol === 'admin') {
                const editButton = document.createElement('button');
                editButton.type = 'button';
                editButton.textContent = 'Editar';
                editButton.addEventListener('click', () => openEditModal(producto));
                const deleteButton = document.createElement('button');
                deleteButton.type = 'button';
                deleteButton.textContent = 'Eliminar';
                deleteButton.addEventListener('click', () => eliminarProducto(producto.id));
                actions.appendChild(editButton);
                actions.appendChild(deleteButton);
            } else {
                actions.textContent = 'Solo lectura';
            }
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
    }
}

async function cargarUsuarios() {
    const tbody = document.getElementById('tabla-usuarios');
    if (!tbody) return;

    try {
        const response = await fetch(`${API_BASE}/api/usuarios`, {
            headers: setAuthHeader()
        });

        if (!response.ok) {
            tbody.innerHTML = '<tr><td colspan="5">No se pudo cargar la lista de usuarios.</td></tr>';
            return;
        }

        const usuarios = await response.json();
        tbody.innerHTML = '';

        if (!usuarios.length) {
            tbody.innerHTML = '<tr><td colspan="5">No hay usuarios registrados.</td></tr>';
            return;
        }

        usuarios.forEach(usuario => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${usuario.id_usuario}</td>
                <td>${escapeHtml(usuario.nombre)}</td>
                <td>${escapeHtml(usuario.apellido)}</td>
                <td>${escapeHtml(usuario.correo)}</td>
                <td>${escapeHtml(usuario.rol)}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error al cargar usuarios', error);
        tbody.innerHTML = '<tr><td colspan="5">Error al cargar usuarios. Intenta nuevamente.</td></tr>';
    }
}

async function eliminarProducto(id) {
    try {
        const response = await fetch(`${API_BASE}/api/productos/${id}`, { method: 'DELETE', headers: setAuthHeader() });
        if (response.ok) {
            cargarReporteProductos();
        }
    } catch (error) {
        console.error(error);
    }
}

function openEditModal(producto) {
    const modal = document.getElementById('modal-editar');
    if (!modal) return;
    document.getElementById('editar-id').value = producto.id;
    document.getElementById('editar-nombre').value = producto.nombre || '';
    document.getElementById('editar-descripcion').value = producto.descripcion || '';
    document.getElementById('editar-precio').value = producto.precio || '';
    document.getElementById('editar-stock').value = producto.stock || '';
    document.getElementById('editar-estado').value = producto.estado || 'Activo';
    const categoriaSelect = document.getElementById('editar-categoria_id');
    const categoriaId = producto.categoria_id || categoriaMap[producto.categoria] || '';
    categoriaSelect.value = categoriaId;
    modal.classList.add('active');
    const innerModal = modal.querySelector('.modal');
    if (innerModal) {
        innerModal.classList.remove('active-animation');
        void innerModal.offsetWidth;
        innerModal.classList.add('active-animation');
    }
}

function closeEditModal() {
    const modal = document.getElementById('modal-editar');
    if (!modal) return;
    modal.classList.remove('active');
}

async function manejarEnvioEdicion(event) {
    event.preventDefault();
    const id = document.getElementById('editar-id').value;
    const nombre = document.getElementById('editar-nombre').value.trim();
    const descripcion = document.getElementById('editar-descripcion').value.trim();
    const precio = parseFloat(document.getElementById('editar-precio').value);
    const stockValue = document.getElementById('editar-stock').value;
    const stock = parseInt(stockValue, 10);
    const estado = document.getElementById('editar-estado').value;
    const categoria_id = parseInt(document.getElementById('editar-categoria_id').value, 10);
    if (!nombre || Number.isNaN(precio) || stockValue === '' || Number.isNaN(stock) || !estado || Number.isNaN(categoria_id)) {
        return;
    }
    try {
        const payload = { nombre, descripcion, precio, stock, estado, categoria_id };
        console.log('Actualizar producto', id, payload);
        const response = await fetch(`${API_BASE}/api/productos/${id}`, {
            method: 'PATCH',
            headers: setAuthHeader({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            closeEditModal();
            cargarReporteProductos();
        } else {
            console.error('Error al actualizar producto', response.status, data);
        }
    } catch (error) {
        console.error('Error de red al actualizar producto', error);
    }
}

async function logout() {
    try {
        await fetch(`${API_BASE}/api/auth/logout`, {
            method: 'POST',
            headers: setAuthHeader()
        });
    } catch (error) {
        console.error('Error en logout:', error);
    }
    
    localStorage.removeItem('finca_token');
    currentUser = null;
    window.location.href = '../index.html';
}

function escapeHtml(text) {
    return String(text ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

async function cargarCategoriasGestion() {
    const contenedor = document.getElementById('lista-categorias');
    if (!contenedor) return;

    try {
        const response = await fetch(`${API_BASE}/api/categorias`);
        const categorias = await response.json();

        contenedor.innerHTML = '';

        if (!categorias.length) {
            contenedor.innerHTML = '<p>No hay categorías registradas.</p>';
            return;
        }

        categorias.forEach(categoria => {
            const item = document.createElement('div');
            item.className = 'categoria-item';

            item.innerHTML = `
                <div class="categoria-item-top">
                    <div class="categoria-info">
                        <strong>${escapeHtml(categoria.nombre)}</strong>
                        <small>${categoria.productos_count || 0} producto(s)</small>
                    </div>

                    <div class="categoria-acciones">
                        <button type="button" class="btn-desplegar-productos" aria-label="Ver productos">▼</button>
                        <button type="button" class="btn-editar-categoria">Editar</button>
                        <button type="button" class="btn-eliminar-categoria">Eliminar</button>
                    </div>
                </div>

                <div class="productos-categoria">
                    <strong>Productos de esta categoría</strong>
                    <div class="productos-lista">Cargando...</div>
                </div>
            `;

            const btnDesplegar = item.querySelector('.btn-desplegar-productos');
            const panelProductos = item.querySelector('.productos-categoria');
            const listaProductos = item.querySelector('.productos-lista');
            let cargado = false;

            btnDesplegar.addEventListener('click', async () => {
                const activo = panelProductos.classList.contains('activo');

                if (!activo && !cargado) {
                    try {
                        const resp = await fetch(`${API_BASE}/api/categorias/${categoria.id}/productos`);
                        const productos = await resp.json();

                        if (!productos.length) {
                            listaProductos.innerHTML = '<p>Esta categoría no tiene productos.</p>';
                        } else {
                            listaProductos.innerHTML = `
                                <ul>
                                    ${productos.map(p => `
                                        <li>${escapeHtml(p.nombre)} — Stock: ${p.stock} — $${p.precio}</li>
                                    `).join('')}
                                </ul>
                            `;
                        }

                        cargado = true;
                    } catch (error) {
                        listaProductos.innerHTML = '<p>Error al cargar productos.</p>';
                    }
                }

                panelProductos.classList.toggle('activo');
                btnDesplegar.textContent = panelProductos.classList.contains('activo') ? '▲' : '▼';
            });

            item.querySelector('.btn-editar-categoria').addEventListener('click', () => {
                document.getElementById('categoria-editar-id').value = categoria.id;
                document.getElementById('categoria-nombre').value = categoria.nombre;
                document.getElementById('btn-guardar-categoria').textContent = 'Actualizar';
            });

            item.querySelector('.btn-eliminar-categoria').addEventListener('click', async () => {
                try {
                    const response = await fetch(`${API_BASE}/api/categorias/${categoria.id}`, {
                        method: 'DELETE',
                        headers: setAuthHeader()
                    });
                    const data = await response.json();

                    if (response.status === 409) {
                        categoriaPendienteEliminar = categoria;
                        const panel = document.getElementById('panel-confirmacion');
                        const lista = document.getElementById('lista-productos-afectados');
                        lista.innerHTML = '';
                        data.productos.forEach(producto => {
                            const li = document.createElement('li');
                            li.textContent = `${producto.nombre} — Stock: ${producto.stock} — $${producto.precio}`;
                            lista.appendChild(li);
                        });
                        panel.classList.remove('oculto');
                        return;
                    }

                    if (!response.ok) {
                        document.getElementById('mensaje-categorias').textContent = data.error || 'No se pudo eliminar la categoría.';
                        return;
                    }

                    document.getElementById('mensaje-categorias').textContent = 'Categoría eliminada correctamente.';
                    await refrescarCategorias();
                } catch (error) {
                    document.getElementById('mensaje-categorias').textContent = 'Error de conexión con el servidor.';
                }
            });

            contenedor.appendChild(item);
        });
    } catch (error) {
        console.error(error);
    }
}

async function refrescarCategorias() {
    await cargarCategorias();
    await cargarCategoriasGestion();
    await cargarReporteProductos();
}

async function confirmarEliminacionCategoria() {
    if (!categoriaPendienteEliminar) return;

    try {
        const response = await fetch(
            `${API_BASE}/api/categorias/${categoriaPendienteEliminar.id}?confirm=true`,
            { method: 'DELETE' }
        );
        const data = await response.json();

        if (!response.ok) {
            document.getElementById('mensaje-categorias').textContent = data.error || 'No se pudo eliminar la categoría.';
            return;
        }

        document.getElementById('panel-confirmacion').classList.add('oculto');
        categoriaPendienteEliminar = null;
        document.getElementById('mensaje-categorias').textContent = 'Categoría eliminada. Los productos quedaron sin categoría.';
        await refrescarCategorias();
    } catch (error) {
        document.getElementById('mensaje-categorias').textContent = 'Error de conexión con el servidor.';
    }
}