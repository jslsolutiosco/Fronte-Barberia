// Flujo de reserva: sitio público (publico/{slug}/…) y "Nueva cita" del panel (misma lógica, otras rutas).
import { api, sesion, entrarDemo } from './api.js';
import { $, aviso, intentar } from './ui.js';
import { esc, money, hora, ymd, addDays, lista } from './util.js';

export async function flujoReserva(el, { publico, alTerminar }) {
  const leer = (p, q) => (publico ? api.publico(`/${p}`, q) : api.get(p, q));
  const s = { paso: 1, servicios: new Set(), empleado: '', fecha: ymd(new Date()), slot: null, horas: null, nombre: '', telefono: '', autoriza: false };
  let catalogo;
  try {
    const [servicios, empleados] = await Promise.all([leer('servicios'), leer('empleados')]);
    catalogo = { servicios: lista(servicios), empleados: lista(empleados) };
  } catch (e) {
    // Sin backend a la vista: ofrecer el modo demo en vez de dejar la página vacía
    el.innerHTML = `<p class="empty">${esc(e.message)}</p>${publico && !sesion.demo ? '<div style="text-align:center"><button class="btn gold" id="demo-pub">Ver con datos de ejemplo</button></div>' : ''}`;
    $('#demo-pub', el)?.addEventListener('click', () => { entrarDemo(); flujoReserva(el, { publico, alTerminar }); });
    return;
  }

  const total = () => catalogo.servicios.filter((x) => s.servicios.has(x.id)).reduce((t, x) => t + Number(x.precio), 0);
  const minutos = () => catalogo.servicios.filter((x) => s.servicios.has(x.id)).reduce((t, x) => t + Number(x.duracion_min), 0);

  async function cargarHoras() {
    s.horas = null; s.slot = null; pintar();
    try { s.horas = lista(await leer('disponibilidad', { fecha: s.fecha, servicios: [...s.servicios], empleado_id: s.empleado || undefined })); }
    catch (e) { aviso(e.message, true); s.horas = []; }
    pintar();
  }

  function pintar() {
    const barra = `<div class="steps">${[1, 2, 3, 4].map((n) => `<i class="${n <= s.paso ? 'on' : ''}"></i>`).join('')}</div>`;
    let html = '';
    if (s.paso === 1) {
      html = `<div class="lbl-s" style="margin-bottom:12px">1 · Elige tus servicios</div>
        <div class="opts">${catalogo.servicios.map((x) => `<button class="opt ${s.servicios.has(x.id) ? 'on' : ''}" data-srv="${x.id}">${esc(x.nombre)}<small>${money(x.precio)} · ${x.duracion_min} min</small></button>`).join('')}</div>
        <div class="total-row"><span>${minutos()} min</span><span>${money(total())}</span></div>
        <div style="margin-top:16px;text-align:right"><button class="btn gold" data-sig ${s.servicios.size ? '' : 'disabled'}>Continuar</button></div>`;
    } else if (s.paso === 2) {
      html = `<div class="lbl-s" style="margin-bottom:12px">2 · ¿Con quién?</div>
        <div class="opts"><button class="opt ${s.empleado === '' ? 'on' : ''}" data-emp="">Cualquiera<small>El primero disponible</small></button>
        ${catalogo.empleados.map((x) => `<button class="opt ${String(s.empleado) === String(x.id) ? 'on' : ''}" data-emp="${x.id}">${esc(x.nombre)}</button>`).join('')}</div>
        <div style="margin-top:16px;display:flex;justify-content:space-between"><button class="btn" data-atras>Atrás</button><button class="btn gold" data-sig>Continuar</button></div>`;
    } else if (s.paso === 3) {
      const unicas = s.horas ? [...new Map(s.horas.map((h) => [h.inicio, h])).values()] : [];
      html = `<div class="lbl-s" style="margin-bottom:12px">3 · Día y hora</div>
        <div class="field"><input type="date" id="fecha" value="${s.fecha}" min="${ymd(new Date())}" max="${ymd(addDays(new Date(), 60))}"></div>
        ${s.horas === null ? '<p class="loading skel">Buscando horarios…</p>'
          : unicas.length ? `<div class="hours">${unicas.map((h) => `<button class="opt ${s.slot?.inicio === h.inicio ? 'on' : ''}" data-slot="${esc(h.inicio)}">${hora(h.inicio)}</button>`).join('')}</div>`
          : '<p class="empty">No hay horarios libres ese día. Prueba con otra fecha.</p>'}
        <div style="margin-top:16px;display:flex;justify-content:space-between"><button class="btn" data-atras>Atrás</button><button class="btn gold" data-sig ${s.slot ? '' : 'disabled'}>Continuar</button></div>`;
    } else {
      html = `<div class="lbl-s" style="margin-bottom:12px">4 · Tus datos</div>
        <div class="field"><label for="nom">Nombre</label><input id="nom" maxlength="120" autocomplete="name" value="${esc(s.nombre)}"></div>
        <div class="field"><label for="tel">Teléfono</label><input id="tel" maxlength="20" inputmode="tel" autocomplete="tel" value="${esc(s.telefono)}"></div>
        ${publico ? `<label style="display:flex;gap:10px;font-size:13px;color:var(--muted);margin-bottom:12px"><input type="checkbox" id="aut" style="width:auto" ${s.autoriza ? 'checked' : ''}> Autorizo el tratamiento de mis datos para gestionar mi cita.</label>` : ''}
        <div class="total-row"><span>${hora(s.slot.inicio)} · ${esc(s.slot.empleado || '')}</span><span>${money(total())}</span></div>
        <div style="margin-top:16px;display:flex;justify-content:space-between"><button class="btn" data-atras>Atrás</button><button class="btn gold" data-fin>Confirmar cita</button></div>`;
    }
    el.innerHTML = barra + html;
  }

  el.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.srv) { const id = Number(b.dataset.srv); s.servicios.has(id) ? s.servicios.delete(id) : s.servicios.add(id); pintar(); }
    else if ('emp' in b.dataset) { s.empleado = b.dataset.emp; pintar(); }
    else if (b.dataset.slot) { s.slot = s.horas.find((h) => h.inicio === b.dataset.slot); pintar(); }
    else if ('sig' in b.dataset) { s.paso++; s.paso === 3 ? cargarHoras() : pintar(); }
    else if ('atras' in b.dataset) { s.paso--; pintar(); }
    else if ('fin' in b.dataset) {
      s.nombre = $('#nom', el).value.trim(); s.telefono = $('#tel', el).value.trim(); s.autoriza = $('#aut', el)?.checked ?? true;
      if (s.nombre.length < 2 || s.telefono.length < 7) return aviso('Escribe tu nombre y un teléfono válido.', true);
      if (publico && !s.autoriza) return aviso('Debes autorizar el tratamiento de datos.', true);
      const cuerpo = { servicios: [...s.servicios], empleado_id: s.slot.empleado_id, inicio: s.slot.inicio, cliente: { nombre: s.nombre, telefono: s.telefono } };
      const r = await intentar(() => (publico ? api.reservar({ ...cuerpo, autoriza_datos: true }) : api.post('citas', cuerpo)), b);
      if (r) alTerminar(r);
    }
  };
  el.onchange = (e) => { if (e.target.id === 'fecha') { s.fecha = e.target.value; cargarHoras(); } };
  pintar();
}
