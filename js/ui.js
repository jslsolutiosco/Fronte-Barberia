import { esc } from './util.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const P = {
  panel: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  citas: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/>',
  registro: '<path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9"/>',
  caja: '<rect x="2" y="6" width="20" height="13" rx="3"/><circle cx="12" cy="12.5" r="3"/><path d="M6 10v.01M18 15v.01"/>',
  fidelizacion: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  clientes: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-7 7-7s7 3 7 7M17 4a4 4 0 0 1 0 8M22 21c0-3-1.5-5.500-4-6.500"/>',
  salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
};
export const icono = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

let timer;
export function aviso(msg, error = false) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.className = `toast glass show${error ? ' err' : ''}`;
  t.textContent = msg;
  clearTimeout(timer);
  timer = setTimeout(() => t.classList.remove('show'), 3200);
}

export function modal(html, titulo) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:40;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.65);backdrop-filter:blur(6px)';
  el.innerHTML = `<div class="glass card" role="dialog" aria-modal="true" style="width:min(560px,100%);max-height:92vh;overflow:auto;background:#101010ee">
    <div class="card-head"><h2>${esc(titulo)}</h2><button class="btn sm" data-cerrar aria-label="Cerrar">✕</button></div>${html}</div>`;
  const cerrar = () => el.remove();
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-cerrar]')) cerrar(); });
  document.body.append(el);
  el.cerrar = cerrar;
  return el;
}

/** Ejecuta una acción de botón mostrando el error de la API en un aviso. */
export async function intentar(fn, btn) {
  if (btn) btn.disabled = true;
  try { return await fn(); } catch (e) { aviso(e.message, true); } finally { if (btn) btn.disabled = false; }
}
