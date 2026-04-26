// ============================================================
// admin.js — Panel de administración con CRM y trazabilidad
// ============================================================

let adminKey = '';
let tabActual = 'pedidos';

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('form-login')?.addEventListener('submit', manejarLogin);
});

// ── Login ────────────────────────────────────────────────────
async function manejarLogin(e) {
  e.preventDefault();
  const clave  = document.getElementById('input-clave')?.value;
  const btn    = document.getElementById('btn-login');
  const errorEl = document.getElementById('error-login');
  if (!clave) return;

  btn.disabled    = true;
  btn.textContent = 'Verificando...';
  errorEl?.classList.add('hidden');

  const { error, status } = await workerFetch('/admin/pedidos?limit=1', 'GET', null, clave);
  btn.disabled    = false;
  btn.textContent = 'Ingresar';

  if (error) {
    if (errorEl) {
      errorEl.textContent = status === 401 ? 'Clave incorrecta.' : `Error: ${error}`;
      errorEl.classList.remove('hidden');
    }
    return;
  }

  adminKey = clave;
  document.getElementById('pantalla-login')?.classList.add('hidden');
  document.getElementById('pantalla-admin')?.classList.remove('hidden');
  inicializarAdmin();
}

// ── Admin ────────────────────────────────────────────────────
function inicializarAdmin() {
  document.querySelectorAll('[data-tab]').forEach(btn =>
    btn.addEventListener('click', () => cambiarTab(btn.dataset.tab))
  );
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    adminKey = '';
    location.reload();
  });
  document.getElementById('filtro-estado')?.addEventListener('change', cargarPedidos);
  document.getElementById('filtro-fecha')?.addEventListener('change', cargarPedidos);
  document.getElementById('buscar-email')?.addEventListener('input', debounce(cargarPedidos, 500));

  // Modal detalle pedido
  document.getElementById('btn-cerrar-detalle')?.addEventListener('click', () => {
    document.getElementById('modal-detalle')?.classList.add('hidden');
  });
  document.getElementById('overlay-detalle')?.addEventListener('click', () => {
    document.getElementById('modal-detalle')?.classList.add('hidden');
  });

  // Modal historial cliente
  document.getElementById('btn-cerrar-cliente')?.addEventListener('click', () => {
    document.getElementById('modal-cliente')?.classList.add('hidden');
  });

  cargarStats();
  cambiarTab('pedidos');
}

function cambiarTab(tab) {
  tabActual = tab;
  document.querySelectorAll('[data-tab]').forEach(btn => {
    const activo = btn.dataset.tab === tab;
    btn.classList.toggle('border-b-2', activo);
    btn.classList.toggle('border-amber-600', activo);
    btn.classList.toggle('text-amber-700', activo);
    btn.classList.toggle('font-semibold', activo);
    btn.classList.toggle('text-gray-500', !activo);
  });
  document.querySelectorAll('[data-panel]').forEach(p =>
    p.classList.toggle('hidden', p.dataset.panel !== tab)
  );
  const acciones = { pedidos: cargarPedidos, suscriptores: cargarSuscriptores, contactos: cargarContactos, productos: cargarProductosAdmin, tortas: cargarTortasOpciones };
  acciones[tab]?.();
}

// ── Stats ────────────────────────────────────────────────────
async function cargarStats() {
  const [pedidos, sus, con] = await Promise.all([
    workerFetch('/admin/pedidos'),
    workerFetch('/admin/suscriptores'),
    workerFetch('/admin/contactos'),
  ]);

  const todos       = pedidos.data || [];
  const hoy         = new Date().toDateString();
  const pedidosHoy  = todos.filter(p => new Date(p.created_at).toDateString() === hoy).length;
  const pendientes  = todos.filter(p => p.estado === 'pendiente').length;
  const ingresos    = todos.filter(p => p.estado !== 'cancelado').reduce((s, p) => s + Number(p.total), 0);
  const abonosPend  = todos.filter(p => !p.abono_confirmado && p.estado !== 'cancelado').length;

  setText('stat-pedidos',   pedidosHoy);
  setText('stat-pendientes', pendientes);
  setText('stat-ingresos',  formatearPrecio(ingresos));
  setText('stat-abonos',    abonosPend);
  setText('stat-suscriptores', (sus.data || []).length);
  setText('stat-contactos',    (con.data || []).length);
}

// ── Pedidos ──────────────────────────────────────────────────
async function cargarPedidos() {
  const tabla  = document.getElementById('tabla-pedidos');
  const estado = document.getElementById('filtro-estado')?.value;
  const fecha  = document.getElementById('filtro-fecha')?.value;
  const email  = document.getElementById('buscar-email')?.value.trim();
  if (!tabla) return;

  tabla.innerHTML = '<tr><td colspan="9" class="text-center py-10 text-gray-400">Cargando...</td></tr>';

  const params = new URLSearchParams();
  if (estado && estado !== 'todos') params.set('estado', estado);
  if (fecha)  params.set('fecha', fecha);
  if (email)  params.set('email', email);

  const { data, error } = await workerFetch(`/admin/pedidos?${params}`);
  if (error) { tabla.innerHTML = `<tr><td colspan="9" class="text-center py-10 text-red-500">${esc(error)}</td></tr>`; return; }

  if (!data?.length) {
    tabla.innerHTML = '<tr><td colspan="9" class="text-center py-10 text-gray-400">No hay pedidos.</td></tr>';
    return;
  }

  tabla.innerHTML = data.map(p => `
    <tr class="border-b border-gray-100 hover:bg-amber-50/40 transition-colors">
      <td class="py-3 px-3 text-xs font-mono text-gray-400">${esc(p.numero_recibo || `#${p.id}`)}</td>
      <td class="py-3 px-3 text-xs text-gray-500">${formatFecha(p.created_at)}</td>
      <td class="py-3 px-3">
        <button onclick="verHistorialCliente('${esc(p.cliente_email)}')"
          class="font-medium text-sm text-gray-900 hover:text-amber-700 text-left transition-colors">
          ${esc(p.cliente_nombre)}
        </button>
        <div class="text-xs text-gray-400">${esc(p.cliente_email)}</div>
      </td>
      <td class="py-3 px-3 text-sm font-semibold text-amber-700">${formatearPrecio(p.total)}</td>
      <td class="py-3 px-3">
        <div class="text-xs font-semibold ${p.abono_confirmado ? 'text-green-600' : 'text-amber-600'}">
          ${formatearPrecio(p.monto_abono)}
        </div>
        ${!p.abono_confirmado && p.estado !== 'cancelado' ? `
          <button onclick="confirmarAbono(${p.id})"
            class="text-xs text-blue-600 hover:text-blue-800 underline mt-0.5 block transition-colors">
            Confirmar
          </button>` : `<span class="text-xs text-green-600">✓ Recibido</span>`}
      </td>
      <td class="py-3 px-3 text-xs text-gray-600">
        ${p.fecha_entrega ? `<span class="font-medium">${formatFechaSimple(p.fecha_entrega)}</span>` : '—'}
      </td>
      <td class="py-3 px-3">
        <span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colorEstado(p.estado)}">
          ${esc(p.estado)}
        </span>
      </td>
      <td class="py-3 px-3">
        <div class="flex items-center gap-1.5">
          <select id="estado-${p.id}"
            class="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300">
            ${['pendiente','pagado','preparando','enviado','completado','cancelado'].map(est =>
              `<option value="${est}" ${est === p.estado ? 'selected' : ''}>${est.charAt(0).toUpperCase() + est.slice(1)}</option>`
            ).join('')}
          </select>
          <button onclick="actualizarEstado(${p.id})"
            class="text-xs bg-gray-900 hover:bg-amber-700 text-white px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            Guardar
          </button>
        </div>
      </td>
      <td class="py-3 px-3">
        <button onclick="verDetallePedido(${p.id})"
          class="text-xs text-gray-500 hover:text-amber-700 flex items-center gap-1 transition-colors whitespace-nowrap">
          <span class="material-symbols-outlined" style="font-size:15px">open_in_new</span>
          Detalle
        </button>
      </td>
    </tr>`).join('');
}

async function actualizarEstado(id) {
  const select = document.getElementById(`estado-${id}`);
  if (!select) return;
  const nuevoEstado  = select.value;
  const notaAdmin    = prompt(`Nota para el cambio a "${nuevoEstado}" (opcional):`) || '';

  const btn = select.nextElementSibling;
  btn.disabled    = true;
  btn.textContent = '...';

  const { error } = await workerFetch(`/admin/pedidos/${id}`, 'PATCH', {
    estado:      nuevoEstado,
    notas_admin: notaAdmin,
  });

  btn.disabled    = false;
  btn.textContent = 'Guardar';

  if (error) { toast(`Error: ${error}`, 'error'); return; }
  toast(`Pedido #${id} → "${nuevoEstado}"`);
  await cargarPedidos();
  await cargarStats();
}

async function confirmarAbono(id) {
  if (!confirm('¿Confirmar recepción del abono?')) return;
  const { error } = await workerFetch(`/admin/pedidos/${id}/abono`, 'PATCH', {});
  if (error) { toast(`Error: ${error}`, 'error'); return; }
  toast('Abono confirmado');
  await cargarPedidos();
}

// ── Detalle / CRM de un pedido ───────────────────────────────
async function verDetallePedido(id) {
  const modal   = document.getElementById('modal-detalle');
  const contenido = document.getElementById('detalle-contenido');
  if (!modal || !contenido) return;

  contenido.innerHTML = '<p class="text-center py-8 text-gray-400">Cargando...</p>';
  modal.classList.remove('hidden');

  const { data: p, error } = await workerFetch(`/admin/pedidos/${id}`);
  if (error || !p) { contenido.innerHTML = `<p class="text-red-500">${esc(error || 'Error')}</p>`; return; }

  const historial = Array.isArray(p.historial_estados) ? p.historial_estados : [];
  const items     = Array.isArray(p.items) ? p.items : [];

  contenido.innerHTML = `
    <div class="space-y-5">
      <!-- Encabezado -->
      <div class="flex items-start justify-between">
        <div>
          <p class="font-mono font-bold text-lg text-gray-900">${esc(p.numero_recibo)}</p>
          <p class="text-sm text-gray-500">${formatFecha(p.created_at)}</p>
        </div>
        <span class="px-3 py-1 rounded-full text-sm font-medium border ${colorEstado(p.estado)}">${esc(p.estado)}</span>
      </div>

      <!-- Cliente -->
      <div class="bg-amber-50 rounded-xl p-4 space-y-1">
        <p class="text-xs font-medium text-amber-700 uppercase tracking-wide mb-2">Cliente</p>
        <p class="font-semibold text-gray-900">${esc(p.cliente_nombre)}</p>
        <p class="text-sm text-gray-600">${esc(p.cliente_email)}</p>
        ${p.cliente_telefono ? `<p class="text-sm text-gray-600">📞 ${esc(p.cliente_telefono)}</p>` : ''}
        <p class="text-sm text-gray-600">📍 ${esc(p.cliente_direccion)}</p>
        <button onclick="verHistorialCliente('${esc(p.cliente_email)}'); document.getElementById('modal-detalle').classList.add('hidden');"
          class="text-xs text-amber-700 hover:text-amber-900 underline mt-1">
          Ver todos los pedidos de este cliente →
        </button>
      </div>

      <!-- Pedido -->
      <div>
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Items</p>
        <div class="space-y-1.5 text-sm">
          ${items.map(i => `
            <div class="flex justify-between">
              <span class="text-gray-700">${esc(i.nombre)} <span class="text-gray-400">×${i.cantidad}</span></span>
              <span class="font-medium">${formatearPrecio(i.precio * i.cantidad)}</span>
            </div>`).join('')}
          <div class="flex justify-between border-t pt-2 mt-2 font-semibold">
            <span>Total</span>
            <span class="text-amber-700">${formatearPrecio(p.total)}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">Abono (50%)</span>
            <span class="${p.abono_confirmado ? 'text-green-600' : 'text-amber-600'} font-medium">
              ${formatearPrecio(p.monto_abono)} ${p.abono_confirmado ? '✓' : '(pendiente)'}
            </span>
          </div>
        </div>
      </div>

      <!-- Detalles logística -->
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div class="bg-gray-50 rounded-lg p-3">
          <p class="text-xs text-gray-400 mb-0.5">Pago</p>
          <p class="font-medium capitalize">${esc(p.metodo_pago)}</p>
        </div>
        <div class="bg-gray-50 rounded-lg p-3">
          <p class="text-xs text-gray-400 mb-0.5">Entrega</p>
          <p class="font-medium">${p.fecha_entrega ? formatFechaSimple(p.fecha_entrega) : 'Inmediata'}</p>
        </div>
      </div>

      ${p.notas ? `
      <div class="bg-blue-50 rounded-xl p-3 text-sm">
        <p class="text-xs font-medium text-blue-600 mb-1">Nota del cliente</p>
        <p class="text-gray-700">${esc(p.notas)}</p>
      </div>` : ''}

      ${p.notas_admin ? `
      <div class="bg-purple-50 rounded-xl p-3 text-sm">
        <p class="text-xs font-medium text-purple-600 mb-1">Nota interna</p>
        <p class="text-gray-700">${esc(p.notas_admin)}</p>
      </div>` : ''}

      <!-- Trazabilidad / historial de estados -->
      ${historial.length ? `
      <div>
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Trazabilidad</p>
        <div class="space-y-3">
          ${[...historial].reverse().map((h, i) => `
            <div class="flex gap-3 items-start">
              <div class="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${i === 0 ? 'bg-amber-500' : 'bg-gray-100'}">
                <span class="material-symbols-outlined ${i === 0 ? 'text-white' : 'text-gray-400'}" style="font-size:14px">
                  ${estadoIcono(h.estado)}
                </span>
              </div>
              <div>
                <p class="text-sm font-semibold text-gray-800 capitalize">${esc(h.estado)}</p>
                <p class="text-xs text-gray-400">${formatFecha(h.fecha)}</p>
                ${h.nota ? `<p class="text-xs text-gray-600 italic mt-0.5">"${esc(h.nota)}"</p>` : ''}
              </div>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Acciones rápidas -->
      <div class="flex gap-2 flex-wrap pt-2">
        <a href="pedido.html?recibo=${esc(p.numero_recibo)}" target="_blank"
          class="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-amber-400 px-3 py-2 rounded-lg transition-colors">
          <span class="material-symbols-outlined" style="font-size:14px">receipt</span>
          Ver recibo
        </a>
        <a href="https://wa.me/57${(p.cliente_telefono || '').replace(/\D/g,'')}?text=Hola%20${encodeURIComponent(p.cliente_nombre)}%2C%20tu%20pedido%20${encodeURIComponent(p.numero_recibo)}"
          target="_blank"
          class="flex items-center gap-1.5 text-xs bg-[#25D366] hover:bg-[#1ebe5a] text-white px-3 py-2 rounded-lg transition-colors">
          <span class="material-symbols-outlined" style="font-size:14px">chat</span>
          WhatsApp
        </a>
      </div>
    </div>
  `;
}

// ── Historial CRM de cliente ─────────────────────────────────
async function verHistorialCliente(email) {
  const modal    = document.getElementById('modal-cliente');
  const contenido = document.getElementById('cliente-contenido');
  if (!modal || !contenido) return;

  contenido.innerHTML = '<p class="text-center py-8 text-gray-400">Cargando...</p>';
  modal.classList.remove('hidden');

  const { data, error } = await workerFetch(`/admin/clientes/${encodeURIComponent(email)}`);
  if (error) { contenido.innerHTML = `<p class="text-red-500">${esc(error)}</p>`; return; }

  const pedidos = data.pedidos || [];

  contenido.innerHTML = `
    <div class="space-y-4">
      <!-- Resumen CRM -->
      <div class="grid grid-cols-3 gap-3">
        <div class="bg-amber-50 rounded-xl p-3 text-center">
          <p class="text-2xl font-bold text-amber-700">${data.total_pedidos}</p>
          <p class="text-xs text-gray-500 mt-0.5">Pedidos</p>
        </div>
        <div class="bg-green-50 rounded-xl p-3 text-center">
          <p class="text-lg font-bold text-green-700">${formatearPrecio(data.total_gastado)}</p>
          <p class="text-xs text-gray-500 mt-0.5">Total gastado</p>
        </div>
        <div class="bg-blue-50 rounded-xl p-3 text-center">
          <p class="text-2xl font-bold text-blue-700">
            ${pedidos.filter(p => p.estado === 'completado').length}
          </p>
          <p class="text-xs text-gray-500 mt-0.5">Completados</p>
        </div>
      </div>

      <p class="text-sm font-medium text-gray-700">${esc(email)}</p>

      <!-- Lista de pedidos del cliente -->
      <div class="space-y-2">
        ${pedidos.map(p => `
          <div class="flex items-center justify-between bg-gray-50 hover:bg-amber-50 rounded-xl px-4 py-3 transition-colors cursor-pointer"
            onclick="document.getElementById('modal-cliente').classList.add('hidden'); verDetallePedido(${p.id})">
            <div>
              <p class="text-sm font-mono font-semibold text-gray-800">${esc(p.numero_recibo || `#${p.id}`)}</p>
              <p class="text-xs text-gray-400">${formatFecha(p.created_at)}</p>
            </div>
            <div class="text-right">
              <p class="text-sm font-semibold text-amber-700">${formatearPrecio(p.total)}</p>
              <span class="text-xs px-1.5 py-0.5 rounded-full ${colorEstado(p.estado)}">${esc(p.estado)}</span>
            </div>
          </div>`).join('')}
      </div>
    </div>
  `;
}

// ── Suscriptores ─────────────────────────────────────────────
async function cargarSuscriptores() {
  const cont = document.getElementById('lista-suscriptores');
  if (!cont) return;
  cont.innerHTML = '<p class="text-center py-8 text-gray-400">Cargando...</p>';
  const { data, error } = await workerFetch('/admin/suscriptores');
  if (error) { cont.innerHTML = `<p class="text-red-500 text-center py-8">${esc(error)}</p>`; return; }
  setText('total-suscriptores', `${(data||[]).length} suscriptores`);
  if (!data?.length) { cont.innerHTML = '<p class="text-center py-8 text-gray-400">Sin suscriptores.</p>'; return; }
  cont.innerHTML = `
    <table class="w-full text-sm">
      <thead><tr class="border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide text-left">
        <th class="py-3 px-4">#</th><th class="py-3 px-4">Email</th><th class="py-3 px-4">Fecha</th>
      </tr></thead>
      <tbody>${data.map((s,i) => `
        <tr class="border-b border-gray-100 hover:bg-gray-50">
          <td class="py-3 px-4 text-gray-400">${i+1}</td>
          <td class="py-3 px-4 font-medium">${esc(s.email)}</td>
          <td class="py-3 px-4 text-gray-500">${formatFecha(s.fecha_suscripcion)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── Contactos ────────────────────────────────────────────────
async function cargarContactos() {
  const cont = document.getElementById('lista-contactos');
  if (!cont) return;
  cont.innerHTML = '<p class="text-center py-8 text-gray-400">Cargando...</p>';
  const { data, error } = await workerFetch('/admin/contactos');
  if (error) { cont.innerHTML = `<p class="text-red-500 text-center py-8">${esc(error)}</p>`; return; }
  if (!data?.length) { cont.innerHTML = '<p class="text-center py-8 text-gray-400">Sin mensajes.</p>'; return; }
  cont.innerHTML = data.map(c => `
    <div class="border border-gray-200 hover:border-amber-200 rounded-xl p-4 transition-colors">
      <div class="flex justify-between items-start mb-2 gap-2 flex-wrap">
        <div>
          <span class="font-semibold text-gray-900 text-sm">${esc(c.nombre)}</span>
          <span class="text-gray-400 text-xs ml-2">— ${esc(c.email)}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">${formatFecha(c.fecha)}</span>
          <a href="mailto:${esc(c.email)}?subject=Re: Tu mensaje a La Maison Sucrée"
            class="text-xs bg-gray-100 hover:bg-amber-100 px-2 py-1 rounded-lg transition-colors">
            Responder
          </a>
        </div>
      </div>
      <p class="text-sm text-gray-700 leading-relaxed">${esc(c.mensaje)}</p>
    </div>`).join('');
}

// ── Productos (admin) ────────────────────────────────────────
async function cargarProductosAdmin() {
  const cont = document.getElementById('lista-productos-admin');
  if (!cont) return;
  cont.innerHTML = '<p class="text-center py-8 text-gray-400">Cargando...</p>';
  const { data, error } = await workerFetch('/api/productos');
  if (error) { cont.innerHTML = `<p class="text-red-500 text-center py-8">${esc(error)}</p>`; return; }
  if (!data?.length) { cont.innerHTML = '<p class="text-center py-8 text-gray-400">Sin productos.</p>'; return; }

  cont.innerHTML = `
    <table class="w-full text-sm min-w-[600px]">
      <thead><tr class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide text-left">
        <th class="py-3 px-4">ID</th><th class="py-3 px-4">Nombre</th>
        <th class="py-3 px-4">Cat.</th><th class="py-3 px-4">Precio</th>
        <th class="py-3 px-4">Días</th><th class="py-3 px-4">Hoy</th>
        <th class="py-3 px-4">Estado</th><th class="py-3 px-4">Acciones</th>
      </tr></thead>
      <tbody>${data.map(p => `
        <tr class="border-b border-gray-100 hover:bg-gray-50">
          <td class="py-3 px-4 font-mono text-gray-400">${p.id}</td>
          <td class="py-3 px-4 font-medium text-gray-900">${esc(p.nombre)}</td>
          <td class="py-3 px-4 capitalize text-gray-600 text-xs">${esc(p.categoria)}</td>
          <td class="py-3 px-4 text-amber-700 font-semibold">${formatearPrecio(p.precio)}</td>
          <td class="py-3 px-4 text-center text-gray-500">${p.dias_anticipacion || 0}</td>
          <td class="py-3 px-4 text-center">
            <button onclick="toggleDisponibleHoy(${p.id}, ${!p.disponible_hoy})"
              class="text-xs px-2 py-1 rounded-full ${p.disponible_hoy ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
              ${p.disponible_hoy ? '✓ Sí' : '—'}
            </button>
          </td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded-full text-xs ${p.disponible ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}">
              ${p.disponible ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td class="py-3 px-4">
            <button onclick="toggleDisponible(${p.id}, ${!p.disponible})"
              class="text-xs border border-gray-200 hover:border-amber-400 px-2.5 py-1.5 rounded-lg transition-colors">
              ${p.disponible ? 'Desactivar' : 'Activar'}
            </button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

async function toggleDisponible(id, val) {
  const { error } = await workerFetch('/admin/productos', 'POST', { id, disponible: val });
  if (error) { toast(`Error: ${error}`, 'error'); return; }
  toast('Producto actualizado');
  await cargarProductosAdmin();
}

async function toggleDisponibleHoy(id, val) {
  const { error } = await workerFetch('/admin/productos', 'POST', { id, disponible_hoy: val });
  if (error) { toast(`Error: ${error}`, 'error'); return; }
  toast(val ? 'Marcado como disponible hoy' : 'Quitado de disponibles hoy');
  await cargarProductosAdmin();
}

// ── Tortas a Pedido (opciones) ───────────────────────────────
async function cargarTortasOpciones() {
  const cont = document.getElementById('tortas-opciones-admin');
  if (!cont) return;
  cont.innerHTML = '<p class="text-center py-8 text-gray-400">Cargando...</p>';

  const { data, error } = await workerFetch('/admin/torta-opciones');
  if (error) { cont.innerHTML = `<p class="text-red-500 text-center py-8">${esc(error)}</p>`; return; }

  const ETIQUETAS = { categoria: 'Categorías', bizcocho: 'Bizcochos', relleno: 'Rellenos', decoracion: 'Decoraciones' };
  const orden = ['categoria', 'bizcocho', 'relleno', 'decoracion'];

  cont.innerHTML = orden.map(tipo => {
    const opciones = data[tipo];
    if (!opciones?.length) return '';
    return `
      <div>
        <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">${ETIQUETAS[tipo] || tipo}</h3>
        <div class="rounded-xl border border-gray-100 overflow-hidden">
          ${opciones.map(op => `
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
              <div class="flex items-center gap-3">
                <span class="w-2 h-2 rounded-full flex-shrink-0 ${op.disponible ? 'bg-green-400' : 'bg-gray-300'}"></span>
                <span class="text-sm font-medium text-gray-800">${esc(op.nombre)}</span>
              </div>
              <button
                onclick="toggleTortaOpcion(${op.id}, ${!op.disponible})"
                class="text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${op.disponible
                    ? 'border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600'
                    : 'border-green-200 text-green-700 hover:bg-green-50'}">
                ${op.disponible ? 'Desactivar' : 'Activar'}
              </button>
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');
}

async function toggleTortaOpcion(id, disponible) {
  const { error } = await workerFetch(`/admin/torta-opciones/${id}`, 'PATCH', { disponible });
  if (error) { toast(`Error: ${error}`, 'error'); return; }
  toast(disponible ? 'Opción activada' : 'Opción desactivada');
  await cargarTortasOpciones();
}

// ── Worker fetch ─────────────────────────────────────────────
async function workerFetch(endpoint, method = 'GET', body = null, clave = null) {
  const key = clave || adminKey;
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key } };
    if (body !== null) opts.body = JSON.stringify(body);
    const res  = await fetch(`${WORKER_URL}${endpoint}`, opts);
    const data = await res.json();
    if (!res.ok) return { error: data.error || `Error ${res.status}`, status: res.status };
    return { data };
  } catch (e) {
    return { error: `Sin conexión: ${e.message}` };
  }
}

// ── Utilidades ───────────────────────────────────────────────
function formatearPrecio(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);
}
function formatFecha(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-CO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(iso));
}
function formatFechaSimple(str) {
  if (!str) return '—';
  const [y,m,d] = str.split('-');
  return `${d}/${m}/${y}`;
}
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function colorEstado(e) {
  const m = { pendiente:'bg-yellow-100 text-yellow-700 border-yellow-200', pagado:'bg-blue-100 text-blue-700 border-blue-200', preparando:'bg-purple-100 text-purple-700 border-purple-200', enviado:'bg-indigo-100 text-indigo-700 border-indigo-200', completado:'bg-green-100 text-green-700 border-green-200', cancelado:'bg-red-100 text-red-700 border-red-200' };
  return m[e] || 'bg-gray-100 text-gray-700 border-gray-200';
}
function estadoIcono(e) {
  const m = { pendiente:'schedule', pagado:'paid', preparando:'bakery_dining', enviado:'local_shipping', completado:'check_circle', cancelado:'cancel' };
  return m[e] || 'circle';
}
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function toast(msg, tipo = 'success') {
  const el = document.getElementById('toast-admin') || (() => {
    const d = document.createElement('div'); d.id = 'toast-admin'; document.body.appendChild(d); return d;
  })();
  const c = { success:'bg-green-600', error:'bg-red-600', info:'bg-blue-600' };
  el.className = `fixed bottom-6 right-6 z-50 ${c[tipo]||c.success} text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 transition-all duration-300`;
  el.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px">${tipo==='error'?'error':'check_circle'}</span>${esc(msg)}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = el.className.replace('flex','hidden'), 3500);
}
