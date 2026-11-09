import { api, sesion } from './api.js';
import { $, aviso, modal, intentar } from './ui.js';
import { flujoReserva } from './reserva.js';
import { esc, money, hora, ymd, addDays, initials, totalCita, lista, etiquetaMetodo } from './util.js';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const COLOR_METODO = { efectivo: '#d6a84c', transferencia: '#f1d28a', nequi: '#7a5a1e' };
const ESTADOS = { pendiente: 'Pendiente', confirmada: 'Confirmada', completada: 'Completada', cancelada: 'Cancelada', no_asistio: 'No asistió' };
const esDueno = () => sesion.usuario?.rol === 'dueno';
const encabezado = (eyebrow, titulo, sub = '', acciones = '') => `<div class="top"><div><div class="eyebrow">${eyebrow}</div><h1>${titulo}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div>${acciones}</div></div>`;
const delta = (hoy, ayer, fmt = (n) => n) => {
  if (!ayer) return '<div class="hint">sin datos de ayer</div>';
  const d = hoy - ayer;
  return `<div class="hint ${d >= 0 ? 'up' : ''}">${d >= 0 ? '+' : ''}${fmt(d)} vs ayer</div>`;
};

/* ───────── PANEL ───────── */
export async function panel() {
  const hoy = new Date();
  const [r, ayer, sem, citas] = await Promise.all([
    api.get('reportes/resumen', { desde: ymd(hoy), hasta: ymd(hoy) }),
    api.get('reportes/resumen', { desde: ymd(addDays(hoy, -1)), hasta: ymd(addDays(hoy, -1)) }),
    api.get('reportes/resumen', { desde: ymd(addDays(hoy, -6)), hasta: ymd(hoy) }),
    api.get('citas', { desde: ymd(hoy), hasta: ymd(hoy) }),
  ]);

  const dias = Array.from({ length: 7 }, (_, i) => { const d = addDays(hoy, i - 6); return { k: ymd(d), n: i === 6 ? 'Hoy' : DIAS[d.getDay()], v: Number(sem.por_dia?.[ymd(d)] || 0) }; });
  const max = Math.max(...dias.map((d) => d.v), 1);
  const top = (sem.servicios_mas_pedidos || []).slice(0, 5);
  const maxTop = Math.max(...top.map((t) => Number(t.cantidad)), 1);
  const metodos = Object.entries(sem.por_metodo || {});
  const totMet = metodos.reduce((t, [, v]) => t + v, 0) || 1;
  const proximas = lista(citas).filter((c) => !['completada', 'cancelada', 'no_asistio'].includes(c.estado)).slice(0, 4);

  return `${encabezado('Panel del dueño', 'Dashboard general', 'Resumen de hoy en LEVEL.')}
  <div class="grid g4">
    <div class="glass card stat"><span class="lbl">Ingresos hoy</span><span class="val">${money(r.ingresos)}</span>${delta(r.ingresos, ayer.ingresos, money)}</div>
    <div class="glass card stat"><span class="lbl">Servicios hoy</span><span class="val">${r.ventas}</span>${delta(r.ventas, ayer.ventas)}</div>
    <div class="glass card stat"><span class="lbl">Clientes hoy</span><span class="val">${r.clientes}</span>${delta(r.clientes, ayer.clientes)}</div>
    <div class="glass card stat"><span class="lbl">Ganancia neta</span><span class="val">${money(r.ganancia_neta)}</span><div class="hint">después de gastos</div></div>
  </div>
  <div class="grid g2">
    <div class="glass card"><div class="card-head"><h2>Ingresos de la semana</h2><span class="sub" style="margin:0">Miles de pesos por día</span></div>
      <div class="bars">${dias.map((d, i) => `<div class="bar ${i === 6 ? 'today' : ''}"><span class="v">${Math.round(d.v / 1000)}</span><div class="col" style="height:${Math.max(6, (d.v / max) * 100)}%"></div><span class="d">${d.n}</span></div>`).join('')}</div></div>
    <div class="glass card"><div class="card-head"><h2>Más solicitados</h2><span class="sub" style="margin:0">7 días</span></div>
      <div class="rank">${top.map((t) => `<div class="rank-row"><span>${esc(t.descripcion)}</span><div class="track"><i style="width:${(t.cantidad / maxTop) * 100}%"></i></div><b>${t.cantidad}</b></div>`).join('') || '<p class="empty">Aún no hay servicios.</p>'}</div>
      <h2 style="margin-top:24px">Métodos de pago</h2>
      <div class="stack">${metodos.map(([m, v]) => `<i style="flex:${v};background:${COLOR_METODO[m] || '#555'}"></i>`).join('')}</div>
      <div class="legend">${metodos.map(([m, v]) => `<span style="--c:${COLOR_METODO[m] || '#555'}">${etiquetaMetodo(m)} ${Math.round((v / totMet) * 100)}%</span>`).join('')}</div></div>
  </div>
  <div class="glass card"><div class="card-head"><h2>Próximas citas</h2><a class="btn sm" href="#/citas">Ver todas</a></div>
    <div class="citas">${proximas.map(tarjetaCita(false)).join('') || '<p class="empty">No quedan citas por atender hoy.</p>'}</div></div>`;
}

/* ───────── CITAS ───────── */
let citasEstado = { fecha: ymd(new Date()), filtro: 'todas' };

const tarjetaCita = (acciones) => (c) => `<article class="glass cita" data-id="${c.id}">
  <div class="row-top"><span class="hora">${hora(c.inicio_local)}</span><span class="tag ${c.estado}">${ESTADOS[c.estado] || c.estado}</span></div>
  <div class="who"><div class="avatar">${esc(initials(c.cliente?.nombre))}</div><div><b>${esc(c.cliente?.nombre)}</b><span>${esc((c.servicios || []).map((s) => s.nombre).join(' + '))} · ${esc(c.empleado?.nombre)}</span></div></div>
  ${acciones ? `<div class="acts">${c.estado === 'pendiente' ? '<button class="btn sm gold" data-confirmar>Confirmar</button>' : ''}
    ${c.estado === 'confirmada' ? '<a class="btn sm gold" href="#/registro?cita=' + c.id + '">Cobrar</a><button class="btn sm" data-noasistio>No asistió</button>' : ''}
    ${['pendiente', 'confirmada'].includes(c.estado) ? '<button class="btn sm danger" data-cancelar>Cancelar</button>' : ''}</div>` : ''}
</article>`;

export async function citas() {
  const lst = lista(await api.get('citas', { desde: citasEstado.fecha, hasta: citasEstado.fecha }));
  const cuenta = (e) => lst.filter((c) => c.estado === e).length;
  const filtros = [['todas', `Hoy · ${lst.length}`], ['pendiente', `Pendientes · ${cuenta('pendiente')}`], ['confirmada', `Confirmadas · ${cuenta('confirmada')}`], ['completada', `Completadas · ${cuenta('completada')}`]];
  const visibles = lst.filter((c) => citasEstado.filtro === 'todas' || c.estado === citasEstado.filtro);
  return `${encabezado('Gestión de citas', 'Citas', '', '<button class="btn gold" data-nueva>+ Nueva cita</button>')}
  <div class="top"><div class="chips">${filtros.map(([k, t]) => `<button class="chip ${citasEstado.filtro === k ? 'on' : ''}" data-filtro="${k}">${t}</button>`).join('')}</div>
    <div style="display:flex;gap:8px;align-items:center"><button class="btn sm" data-dia="-1" aria-label="Día anterior">‹</button><input type="date" id="dia" value="${citasEstado.fecha}" style="width:auto"><button class="btn sm" data-dia="1" aria-label="Día siguiente">›</button></div></div>
  <div class="citas">${visibles.map(tarjetaCita(true)).join('') || '<p class="empty glass card" style="grid-column:1/-1">No hay citas con este filtro.</p>'}</div>`;
}

export function eventosCitas(raiz, recargar) {
  raiz.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const id = b.closest('[data-id]')?.dataset.id;
    const accion = { confirmar: 'confirmar', cancelar: 'cancelar', noasistio: 'no-asistio' };
    const clave = Object.keys(accion).find((k) => k in b.dataset);
    if (clave) {
      if (clave === 'cancelar' && !confirm('¿Cancelar esta cita?')) return;
      if (await intentar(() => api.post(`citas/${id}/${accion[clave]}`), b)) { aviso('Cita actualizada'); recargar(); }
    } else if (b.dataset.filtro) { citasEstado.filtro = b.dataset.filtro; recargar(); }
    else if (b.dataset.dia) { citasEstado.fecha = ymd(addDays(new Date(citasEstado.fecha + 'T12:00'), Number(b.dataset.dia))); recargar(); }
    else if ('nueva' in b.dataset) {
      const m = modal('<div id="flujo"></div>', 'Nueva cita');
      flujoReserva($('#flujo', m), { publico: false, alTerminar: () => { m.cerrar(); aviso('Cita creada'); recargar(); } });
    }
  };
  raiz.onchange = (e) => { if (e.target.id === 'dia' && e.target.value) { citasEstado.fecha = e.target.value; recargar(); } };
}

/* ───────── REGISTRO DE SERVICIO ───────── */
let reg = null;
export async function registro(params) {
  const [servicios, empleados, clientes] = await Promise.all([api.get('servicios'), api.get('empleados'), api.get('clientes')]);
  const cat = { servicios: lista(servicios), empleados: lista(empleados), clientes: lista(clientes) };
  if (!reg || params.cita) {
    reg = { servicios: new Set(), cliente: '', nombre: '', telefono: '', empleado: '', metodo: 'efectivo', notas: '', citaId: null };
    if (params.cita) {
      const c = lista(await api.get('citas', { desde: ymd(addDays(new Date(), -1)), hasta: ymd(addDays(new Date(), 30)) })).find((x) => String(x.id) === params.cita);
      if (c) { reg.citaId = c.id; reg.servicios = new Set((c.servicios || []).map((s) => s.id)); reg.nombre = c.cliente?.nombre || ''; reg.telefono = c.cliente?.telefono || ''; reg.empleado = c.empleado?.id || ''; reg.cliente = cat.clientes.find((x) => x.telefono === c.cliente?.telefono)?.id || ''; }
    }
    if (params.cliente) reg.cliente = params.cliente;
  }
  reg.cat = cat;
  return pintarRegistro();
}

function pintarRegistro() {
  const { cat } = reg;
  const sel = cat.servicios.filter((s) => reg.servicios.has(s.id));
  const total = sel.reduce((t, s) => t + Number(s.precio), 0);
  const cli = cat.clientes.find((c) => String(c.id) === String(reg.cliente));
  const nombre = cli?.nombre || reg.nombre;
  return `${encabezado('Registro de servicio', 'Registrar servicio', 'Cada servicio guardado suma a la caja y le da un sello al cliente.')}
  <div class="grid g2" id="registro">
    <div class="glass card">
      ${reg.citaId ? '<p class="tag completada" style="margin-bottom:16px">Cobrando la cita #' + reg.citaId + '</p>' : ''}
      <div class="field"><label for="r-cli">Cliente</label><select id="r-cli"><option value="">Cliente nuevo…</option>${cat.clientes.map((c) => `<option value="${c.id}" ${String(c.id) === String(reg.cliente) ? 'selected' : ''}>${esc(c.nombre)} · ${esc(c.telefono)}</option>`).join('')}</select></div>
      ${cli ? '' : `<div class="inline" style="grid-template-columns:1fr 1fr;margin-bottom:16px"><input id="r-nom" placeholder="Nombre" maxlength="120" value="${esc(reg.nombre)}"><input id="r-tel" placeholder="Teléfono" maxlength="20" inputmode="tel" value="${esc(reg.telefono)}"></div>`}
      <div class="field"><label>Servicios</label><div class="opts">${cat.servicios.map((s) => `<button class="opt ${reg.servicios.has(s.id) ? 'on' : ''}" data-srv="${s.id}">${esc(s.nombre)}<small>${money(s.precio)}</small></button>`).join('')}</div></div>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">
        <div class="field"><label for="r-emp">Barbero</label><select id="r-emp"><option value="">Sin asignar</option>${cat.empleados.map((e) => `<option value="${e.id}" ${String(e.id) === String(reg.empleado) ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}</select></div>
        <div class="field"><label for="r-met">Pago</label><select id="r-met">${['efectivo', 'transferencia', 'nequi'].map((m) => `<option value="${m}" ${reg.metodo === m ? 'selected' : ''}>${etiquetaMetodo(m)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label for="r-not">Notas</label><textarea id="r-not" rows="2" maxlength="500">${esc(reg.notas)}</textarea></div>
    </div>
    <div class="glass card"><div class="card-head"><h2>Resumen</h2></div>
      <div class="who" style="display:flex;gap:12px;align-items:center;margin-bottom:12px"><div class="avatar">${esc(initials(nombre || '?'))}</div><div><b>${esc(nombre || 'Sin cliente')}</b><div class="sub" style="margin:0">${esc(cli?.telefono || reg.telefono)}</div></div></div>
      <div class="list">${sel.map((s) => `<div class="item"><span>${esc(s.nombre)}</span><span>${money(s.precio)}</span></div>`).join('') || '<p class="empty">Elige al menos un servicio.</p>'}</div>
      <div class="total-row"><span>Total</span><span>${money(total)}</span></div>
      <button class="btn gold" style="width:100%;justify-content:center;margin-top:18px" data-guardar ${sel.length ? '' : 'disabled'}>Guardar servicio</button></div>
  </div>`;
}

export function eventosRegistro(raiz, _recargar, ir) {
  const refrescar = () => { $('#vista').innerHTML = pintarRegistro(); };
  raiz.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.srv) { const id = Number(b.dataset.srv); reg.servicios.has(id) ? reg.servicios.delete(id) : reg.servicios.add(id); refrescar(); }
    else if ('guardar' in b.dataset) {
      const cli = reg.cat.clientes.find((c) => String(c.id) === String(reg.cliente));
      const cliente = cli ? { nombre: cli.nombre, telefono: cli.telefono } : { nombre: reg.nombre.trim(), telefono: reg.telefono.trim() };
      if (!cliente.nombre || !cliente.telefono) return aviso('Falta el nombre y el teléfono del cliente.', true);
      const sel = reg.cat.servicios.filter((s) => reg.servicios.has(s.id));
      const total = sel.reduce((t, s) => t + Number(s.precio), 0);
      const venta = await intentar(() => api.post('ventas', {
        cita_id: reg.citaId || undefined, cliente, empleado_id: reg.empleado || undefined, notas: reg.notas || undefined,
        items: sel.map((s) => ({ servicio_id: s.id, cantidad: 1 })), pagos: [{ metodo: reg.metodo, monto: total }],
      }), b);
      if (venta) { aviso(`Servicio guardado · ${money(total)}`); reg = null; ir('#/caja'); }
    }
  };
  raiz.onchange = (e) => {
    const m = { 'r-cli': 'cliente', 'r-emp': 'empleado', 'r-met': 'metodo' }[e.target.id];
    if (m) { reg[m] = e.target.value; if (m === 'cliente') refrescar(); }
  };
  raiz.oninput = (e) => { const m = { 'r-nom': 'nombre', 'r-tel': 'telefono', 'r-not': 'notas' }[e.target.id]; if (m) reg[m] = e.target.value; };
}

/* ───────── CAJA ───────── */
export async function caja() {
  const hoy = ymd(new Date());
  const [ventas, gastos] = await Promise.all([api.get('ventas', { fecha: hoy }), api.get('gastos', { desde: hoy, hasta: hoy })]);
  const vs = lista(ventas).filter((v) => v.estado === 'pagada');
  const totalV = (v) => (v.items || []).reduce((t, i) => t + i.cantidad * i.precio_unitario - (i.descuento || 0), 0);
  const ingresos = vs.reduce((t, v) => t + totalV(v), 0);
  const gs = lista(gastos);
  const totalG = gs.reduce((t, g) => t + Number(g.valor), 0);
  return `${encabezado('Contabilidad', 'Caja del día', '', esDueno() ? '<button class="btn gold" data-cerrar-caja>Cerrar caja</button>' : '')}
  <div class="grid g3">
    <div class="glass card stat"><span class="lbl">Ingresos</span><span class="val pos">${money(ingresos)}</span></div>
    <div class="glass card stat"><span class="lbl">Gastos</span><span class="val neg">${money(totalG)}</span></div>
    <div class="glass card stat"><span class="lbl">Ganancia neta</span><span class="val">${money(ingresos - totalG)}</span></div>
  </div>
  <div class="grid" style="grid-template-columns:1fr 1fr">
    <div class="glass card"><div class="card-head"><h2>Últimos ingresos</h2></div><div class="list">
      ${vs.map((v) => `<div class="item"><div>${esc((v.items || []).map((i) => i.descripcion).join(' + '))}<small>${esc(v.cliente?.nombre || 'Sin cliente')} · ${esc((v.pagos || []).map((p) => etiquetaMetodo(p.metodo)).join(', '))} · ${hora(new Date(v.fecha).toLocaleTimeString('es-CO', { hour12: false, hour: '2-digit', minute: '2-digit' }))}</small></div><b class="pos">+${money(totalV(v))}</b></div>`).join('') || '<p class="empty">Todavía no hay ingresos hoy.</p>'}</div></div>
    <div class="glass card"><div class="card-head"><h2>Gastos del día</h2></div><div class="list">
      ${gs.map((g) => `<div class="item"><div>${esc(g.concepto)}<small>${esc(g.categoria)}</small></div><b class="neg">-${money(g.valor)}</b></div>`).join('') || '<p class="empty">Sin gastos registrados.</p>'}</div>
      <div class="total-row"><span>Total gastos</span><span>${money(totalG)}</span></div>
      ${esDueno() ? `<form id="f-gasto" style="margin-top:18px"><div class="inline"><input name="concepto" placeholder="Concepto" required maxlength="160" aria-label="Concepto"><input name="valor" type="number" min="1" max="99999999" placeholder="Valor" required aria-label="Valor"><button class="btn gold">Agregar</button></div>
        <select name="categoria" style="margin-top:10px" aria-label="Categoría"><option>Productos</option><option>Suministros</option><option>Servicios</option><option>Otros</option></select></form>` : ''}</div>
  </div>`;
}

export function eventosCaja(raiz, recargar) {
  raiz.onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (await intentar(() => api.post('gastos', { categoria: f.categoria, concepto: f.concepto, valor: Number(f.valor) }), e.submitter)) { aviso('Gasto agregado'); recargar(); }
  };
  raiz.onclick = (e) => {
    if (!e.target.closest('[data-cerrar-caja]')) return;
    const m = modal(`<form><div class="field"><label for="ef">Efectivo contado en caja</label><input id="ef" type="number" min="0" max="99999999" required></div>
      <div class="field"><label for="nt">Notas</label><input id="nt" maxlength="255"></div><button class="btn gold" style="width:100%;justify-content:center">Cerrar caja</button><p id="res" class="sub" style="margin-top:14px"></p></form>`, 'Cerrar caja');
    $('form', m).onsubmit = async (ev) => {
      ev.preventDefault();
      const r = await intentar(() => api.post('caja/cierres', { fecha: ymd(new Date()), efectivo_contado: Number($('#ef', m).value), notas: $('#nt', m).value || undefined }), ev.submitter);
      if (r) $('#res', m).innerHTML = `Esperado: <b>${money(r.efectivo_esperado)}</b> · Diferencia: <b class="${r.diferencia < 0 ? 'neg' : 'pos'}">${money(r.diferencia)}</b>`;
    };
  };
}

/* ───────── FIDELIZACIÓN ───────── */
let fidSel = null;
export async function fidelizacion() {
  const [programa, clientes] = await Promise.all([api.get('fidelidad/programa'), api.get('clientes')]);
  const cls = lista(clientes).slice(0, 12);
  const estados = await Promise.all(cls.map((c) => api.get(`clientes/${c.id}/fidelidad`).catch(() => null)));
  const filas = cls.map((c, i) => ({ c, e: estados[i] })).filter((x) => x.e);
  const sel = filas.find((x) => x.c.id === fidSel) || filas[0];
  fidSel = sel?.c.id;
  const meta = programa?.meta_sellos || 10;
  if (!programa) return `${encabezado('Fidelización', 'Level Card')}<p class="empty glass card">Aún no hay un programa activo.${esDueno() ? ' Configúralo abajo.' : ''}</p>`;
  return `${encabezado('Fidelización', 'Level Card', 'Cada servicio suma un sello. Al completar la tarjeta, el cliente gana su premio.')}
  <div class="grid g2">
    <div class="glass card">${sel ? `<div class="level-card"><div class="brand">LEVEL<small>CARD</small></div><div class="nm">${esc(sel.c.nombre)}</div>
      <div class="sub" style="margin:2px 0 0">${sel.e.sellos} de ${sel.e.meta} · ${sel.e.recompensa_disponible ? '¡premio disponible!' : `faltan ${Math.max(0, sel.e.meta - sel.e.sellos)}`}</div>
      <div class="stamps">${Array.from({ length: sel.e.meta }, (_, i) => `<div class="stamp ${i < sel.e.sellos ? 'on' : ''}">${i + 1}</div>`).join('')}</div></div>
      <p class="sub" style="margin:14px 0">${meta} servicios = ${esc(programa.recompensa_descripcion.toLowerCase())} · vigencia ${programa.vigencia_sellos_dias} días</p>
      <div class="acts" style="display:flex;gap:10px"><a class="btn gold" href="#/registro?cliente=${sel.c.id}">Registrar servicio</a>${sel.e.recompensa_disponible ? '<button class="btn" data-redimir>Redimir premio</button>' : ''}</div>` : '<p class="empty">Aún no hay clientes en el programa.</p>'}</div>
    <div class="glass card"><div class="card-head"><h2>Clientes del programa</h2></div><div class="list">
      ${filas.map(({ c, e }) => `<button class="item" data-cli="${c.id}" style="background:none;border:0;border-bottom:1px solid var(--line);width:100%;text-align:left"><span>${esc(c.nombre)}</span><span style="display:flex;gap:10px;align-items:center;min-width:120px"><span class="track" style="flex:1"><i style="width:${Math.min(100, (e.sellos / e.meta) * 100)}%"></i></span><b style="font-weight:500;font-size:12px">${e.sellos}/${e.meta}</b></span></button>`).join('')}</div></div>
  </div>
  ${esDueno() ? `<div class="glass card"><div class="card-head"><h2>Configuración del programa</h2></div>
    <form id="f-prog" class="grid g4" style="align-items:end"><div class="field"><label for="p-meta">Sellos para el premio</label><input id="p-meta" name="meta_sellos" type="number" min="1" max="50" value="${programa.meta_sellos}"></div>
    <div class="field"><label for="p-rec">Premio</label><input id="p-rec" name="recompensa_descripcion" maxlength="120" value="${esc(programa.recompensa_descripcion)}"></div>
    <div class="field"><label for="p-vs">Vigencia sellos (días)</label><input id="p-vs" name="vigencia_sellos_dias" type="number" min="1" max="730" value="${programa.vigencia_sellos_dias}"></div>
    <div class="field"><label for="p-vr">Vigencia premio (días)</label><input id="p-vr" name="vigencia_recompensa_dias" type="number" min="1" max="365" value="${programa.vigencia_recompensa_dias}"></div>
    <div><button class="btn gold" style="margin-bottom:16px">Guardar programa</button></div></form></div>` : ''}`;
}

export function eventosFidelidad(raiz, recargar) {
  raiz.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.cli) { fidSel = Number(b.dataset.cli); recargar(); }
    else if ('redimir' in b.dataset && confirm('¿Redimir el premio y reiniciar la tarjeta?')) {
      if (await intentar(() => api.post(`clientes/${fidSel}/fidelidad/redimir`), b)) { aviso('Premio redimido'); recargar(); }
    }
  };
  raiz.onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const cuerpo = { ...f, meta_sellos: +f.meta_sellos, vigencia_sellos_dias: +f.vigencia_sellos_dias, vigencia_recompensa_dias: +f.vigencia_recompensa_dias };
    if (await intentar(() => api.put('fidelidad/programa', cuerpo), e.submitter)) { aviso('Programa guardado'); recargar(); }
  };
}

/* ───────── CLIENTES ───────── */
export async function clientes() {
  const cls = lista(await api.get('clientes'));
  return `${encabezado('Directorio', 'Clientes', `${cls.length} clientes registrados`, '<button class="btn gold" data-nuevo>+ Nuevo cliente</button>')}
  <div class="glass card"><div class="field"><input id="buscar" placeholder="Buscar por nombre o teléfono" aria-label="Buscar"></div>
    <table class="tbl"><thead><tr><th>Cliente</th><th>Teléfono</th><th></th></tr></thead><tbody id="filas">
    ${cls.map((c) => `<tr data-q="${esc((c.nombre + ' ' + c.telefono).toLowerCase())}"><td><span style="display:flex;gap:10px;align-items:center"><span class="avatar">${esc(initials(c.nombre))}</span>${esc(c.nombre)}</span></td><td>${esc(c.telefono)}</td><td style="text-align:right"><a class="btn sm" href="#/registro?cliente=${c.id}">Registrar servicio</a></td></tr>`).join('')}</tbody></table></div>`;
}

export function eventosClientes(raiz, recargar) {
  raiz.oninput = (e) => {
    if (e.target.id !== 'buscar') return;
    const q = e.target.value.trim().toLowerCase();
    raiz.querySelectorAll('#filas tr').forEach((tr) => { tr.hidden = !tr.dataset.q.includes(q); });
  };
  raiz.onclick = (e) => {
    if (!e.target.closest('[data-nuevo]')) return;
    const m = modal(`<form><div class="field"><label for="c-n">Nombre</label><input id="c-n" required maxlength="120"></div><div class="field"><label for="c-t">Teléfono</label><input id="c-t" required maxlength="20" inputmode="tel"></div><button class="btn gold" style="width:100%;justify-content:center">Guardar cliente</button></form>`, 'Nuevo cliente');
    $('form', m).onsubmit = async (ev) => {
      ev.preventDefault();
      if (await intentar(() => api.post('clientes', { nombre: $('#c-n', m).value.trim(), telefono: $('#c-t', m).value.trim() }), ev.submitter)) { m.cerrar(); aviso('Cliente guardado'); recargar(); }
    };
  };
}

export { totalCita };
