import { api, sesion, entrarDemo } from './api.js';
import { $, icono, aviso, intentar } from './ui.js';
import { flujoReserva } from './reserva.js';
import * as V from './views.js';
import { esc, initials, money, hora } from './util.js';

const app = $('#app');
const RUTAS = {
  panel: { t: 'Panel', f: V.panel },
  citas: { t: 'Citas', f: V.citas, ev: V.eventosCitas },
  registro: { t: 'Registro', f: V.registro, ev: V.eventosRegistro },
  caja: { t: 'Caja', f: V.caja, ev: V.eventosCaja },
  fidelizacion: { t: 'Fidelización', f: V.fidelizacion, ev: V.eventosFidelidad },
  clientes: { t: 'Clientes', f: V.clientes, ev: V.eventosClientes },
};
const FONDO = '<div class="glow" aria-hidden="true"><i></i><i></i><i></i></div>';
const ir = (h) => { location.hash = h; };

function parsear() {
  const [ruta, qs] = (location.hash.slice(2) || '').split('?');
  return { ruta: ruta || '', params: Object.fromEntries(new URLSearchParams(qs || '')) };
}

async function enrutar() {
  const { ruta, params } = parsear();
  if (ruta === 'reservar' || (!ruta && !sesion.token)) return publico();
  if (ruta === 'login') return login();
  if (!sesion.token) return ir('#/login');
  if (!sesion.usuario) {
    try { await api.yo(); } catch { sesion.cerrar(); return ir('#/login'); }
  }
  const def = RUTAS[ruta] || RUTAS.panel;
  const clave = RUTAS[ruta] ? ruta : 'panel';
  pintarShell(clave);
  const vista = $('#vista');
  const cargar = async () => {
    try {
      vista.innerHTML = await def.f(params);
      def.ev?.(vista, cargar, ir);
    } catch (e) {
      vista.innerHTML = `<div class="glass card"><p class="empty">${esc(e.message)}</p></div>`;
    }
  };
  vista.innerHTML = '<p class="loading skel">Cargando…</p>';
  vista.classList.add('anim');
  clearTimeout(vista.fin);
  vista.fin = setTimeout(() => vista.classList.remove('anim'), 1800);
  cargar();
}

function pintarShell(activa) {
  if (!$('#vista')) {
    const u = sesion.usuario;
    app.innerHTML = `${FONDO}<div class="shell">
      <aside class="side glass"><div class="logo">LEVEL<small>BARBERÍA</small></div>
        <nav class="nav" aria-label="Principal">${Object.entries(RUTAS).map(([k, r]) => `<a href="#/${k}" data-nav="${k}">${icono(k)}<span>${r.t}</span></a>`).join('')}</nav>
        <div class="side-foot"><a class="btn sm" href="#/reservar">Ver sitio de reservas</a>
          <div class="user"><div class="avatar">${esc(initials(u?.nombre))}</div><div style="flex:1;min-width:0"><b>${esc(u?.nombre)}</b><span>${u?.rol === 'dueno' ? 'Dueño' : 'Barbero'}${sesion.demo ? ' · demo' : ''}</span></div><button class="btn sm" id="salir" aria-label="Cerrar sesión" title="Cerrar sesión">${icono('salir').replace('<svg', '<svg width="16" height="16"')}</button></div></div></aside>
      <main class="main"><div id="vista"></div></main></div>`;
    $('#salir').onclick = async () => { await api.logout(); ir('#/login'); };
  }
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === activa));
}

/* ───────── Login ───────── */
function login() {
  app.innerHTML = `${FONDO}<div class="center"><form class="glass login" id="f-login">
    <div class="logo">LEVEL<small>BARBERÍA</small></div>
    <div class="field"><label for="em">Correo</label><input id="em" type="email" autocomplete="username" required maxlength="190" value="dueno@level.test"></div>
    <div class="field"><label for="pw">Contraseña</label><input id="pw" type="password" autocomplete="current-password" required maxlength="200"></div>
    <button class="btn gold" style="width:100%;justify-content:center">Entrar al panel</button>
    <button class="btn" type="button" id="demo" style="width:100%;justify-content:center;margin-top:10px">Ver demo con datos de ejemplo</button>
    <details style="margin-top:18px;font-size:12px;color:var(--muted)"><summary>Conexión con el servidor</summary>
      <div class="field" style="margin-top:10px"><label for="api">URL de la API</label><input id="api" value="${esc(sesion.base)}"></div>
      <div class="field"><label for="slug">Slug del negocio</label><input id="slug" value="${esc(sesion.slug)}"></div></details>
    <p class="demo-note"><a href="#/reservar" style="color:var(--gold-2)">← Ir al sitio de reservas</a></p></form></div>`;
  const guardarConexion = () => { sesion.base = $('#api').value.trim() || sesion.base; sesion.slug = $('#slug').value.trim() || sesion.slug; sesion.demo = false; };
  $('#f-login').onsubmit = async (e) => {
    e.preventDefault(); guardarConexion();
    if (await intentar(() => api.login($('#em').value, $('#pw').value), e.submitter)) ir('#/panel');
  };
  $('#demo').onclick = () => { entrarDemo(); ir('#/panel'); };
}

/* ───────── Sitio público ───────── */
async function publico() {
  app.innerHTML = `${FONDO}<div class="pub">
    <div class="pub-nav"><div class="logo" style="padding:0">LEVEL<small>BARBERÍA</small></div><a class="btn sm" href="#/login">Acceso del dueño</a></div>
    <section class="glass hero"><div class="eyebrow">Barbería en Maicao, La Guajira</div>
      <h1>Más que un corte, <em>es tu nivel.</em></h1>
      <p class="sub" style="max-width:520px;font-size:15px">Estilo, confianza y actitud. Reserva tu turno en un minuto y llega sin hacer fila.</p>
      <div><a class="btn gold" href="#reservar-ya" id="ir-reservar">Agendar cita</a></div></section>
    <section class="grid g3" id="info"></section>
    <section class="glass card" id="reservar-ya"><div class="card-head"><h2>Agenda tu cita</h2></div><div id="flujo"></div></section></div>`;
  $('#ir-reservar').onclick = (e) => { e.preventDefault(); $('#reservar-ya').scrollIntoView({ behavior: 'smooth' }); };
  $('#info').innerHTML = [['Ubicación', 'Calle 15 #24-56', 'Maicao, La Guajira'], ['Horario', 'Lunes a sábado', '9:00 AM – 8:00 PM · Domingo cerrado'], ['Instagram', '@carlosbarber_1', 'Escríbenos por DM']]
    .map(([a, b, c]) => `<div class="glass card stat"><span class="lbl">${a}</span><span class="val" style="font-size:20px">${b}</span><span class="hint">${c}</span></div>`).join('');
  const flujo = $('#flujo');
  flujo.innerHTML = '<p class="loading skel">Cargando servicios…</p>';
  flujoReserva(flujo, {
    publico: true,
    alTerminar: (r) => {
      flujo.innerHTML = `<div style="text-align:center;padding:20px 0"><div class="eyebrow">¡Listo!</div><h1 style="font-size:30px">Cita ${r.estado === 'confirmada' ? 'confirmada' : 'solicitada'}</h1>
        <p class="sub" style="font-size:15px;margin-top:12px">${esc((r.servicios || []).join(' + '))} con ${esc(r.empleado)}<br>${esc(hora(r.inicio))} · ${money(r.total)}</p></div>`;
      aviso('Reserva enviada');
    },
  });
}

addEventListener('hashchange', enrutar);
enrutar();
