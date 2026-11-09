export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const money = (n) => { const v = Math.round(Number(n) || 0); return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('es-CO'); };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const initials = (n) => String(n || '?').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

/** "2026-11-04 13:00:00" o ISO → "1:00 PM" (la API entrega inicio_local ya en hora del negocio). */
export function hora(s) {
  const m = String(s || '').match(/(\d{2}):(\d{2})/);
  if (!m) return '--';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
}

export const precioServicio = (s) => Number(s?.pivot?.precio ?? s?.precio_unitario ?? s?.precio ?? 0);
export const totalCita = (c) => (c.servicios || []).reduce((t, s) => t + precioServicio(s), 0);
export const lista = (r) => (Array.isArray(r) ? r : r?.data || []);
export const etiquetaMetodo = (m) => ({ efectivo: 'Efectivo', transferencia: 'Transferencia', nequi: 'Nequi / Daviplata' }[m] || m);
