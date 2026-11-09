// Modo demo: responde con las mismas formas que la API real (/api/v1) para ver el panel sin backend.
import { ymd, addDays } from './util.js';

const servicios = [
  { id: 1, nombre: 'Corte de cabello', descripcion: 'Incluye lavado y peinado', precio: 25000, duracion_min: 40 },
  { id: 2, nombre: 'Corte + Barba', descripcion: 'Lavado, barba y perfilado', precio: 35000, duracion_min: 60 },
  { id: 3, nombre: 'Barba', descripcion: 'Perfilado y diseño de barba', precio: 20000, duracion_min: 30 },
  { id: 4, nombre: 'Diseño', descripcion: 'Líneas y diseños a navaja', precio: 10000, duracion_min: 20 },
  { id: 5, nombre: 'Cejas', descripcion: 'Perfilado de cejas', precio: 8000, duracion_min: 15 },
];
const empleados = [{ id: 1, nombre: 'Carlos' }, { id: 2, nombre: 'Andrés' }, { id: 3, nombre: 'Jhon' }];
const clientes = [
  { id: 1, nombre: 'Juan Pérez', telefono: '300 123 4567' },
  { id: 2, nombre: 'Luis Martínez', telefono: '301 555 0192' },
  { id: 3, nombre: 'Pedro Gómez', telefono: '310 222 8841' },
  { id: 4, nombre: 'Kevin Rojas', telefono: '312 444 1020' },
  { id: 5, nombre: 'Andrés Díaz', telefono: '315 880 3321' },
];
const sellos = { 1: 7, 2: 4, 3: 9, 4: 2, 5: 0 };
const programa = { nombre: 'LEVEL CARD', meta_sellos: 10, recompensa_descripcion: 'Corte gratis', vigencia_sellos_dias: 30, vigencia_recompensa_dias: 30, activo: true, servicios: [] };

const hoy = ymd(new Date());
const cita = (id, hora, cli, srv, emp, estado) => ({
  id, estado, inicio_local: `${hoy} ${hora}:00`, fin_local: `${hoy} ${hora}:00`,
  cliente: clientes[cli], empleado: empleados[emp], servicios: srv.map((i) => servicios[i - 1]),
});
const citas = [
  cita(1, '10:00', 0, [2], 0, 'completada'), cita(2, '11:30', 1, [1], 1, 'completada'),
  cita(3, '13:00', 2, [1, 4], 0, 'confirmada'), cita(4, '14:30', 4, [3], 1, 'pendiente'),
  cita(5, '16:00', 3, [1], 2, 'confirmada'), cita(6, '17:30', 0, [2], 0, 'pendiente'),
  cita(7, '18:30', 1, [5], 2, 'pendiente'),
];

// Ventas: historial de la semana con valores repetibles
const ventas = [];
let vid = 1;
const metodos = ['efectivo', 'efectivo', 'efectivo', 'transferencia', 'nequi'];
const venta = (dia, hora, srvIds, cli, emp, metodo) => {
  const items = srvIds.map((i) => ({ servicio_id: i, descripcion: servicios[i - 1].nombre, cantidad: 1, precio_unitario: servicios[i - 1].precio, descuento: 0 }));
  const total = items.reduce((s, i) => s + i.precio_unitario, 0);
  const f = new Date(`${dia}T${hora}:00-05:00`).toISOString();
  ventas.push({ id: vid++, fecha: f, estado: 'pagada', items, pagos: [{ metodo, monto: total }], cliente: clientes[cli], empleado: empleados[emp] });
};
const conteo = [18, 22, 19, 26, 24, 31, 0]; // servicios por día, de hace 6 días a hoy (hoy se completa abajo)
for (let d = 6; d >= 1; d--) {
  const dia = ymd(addDays(new Date(), -d));
  for (let k = 0; k < conteo[6 - d]; k++) {
    venta(dia, `${String(9 + (k % 11)).padStart(2, '0')}:${k % 2 ? '45' : '15'}`, [[1], [2], [3], [1, 4]][(k + d) % 4], (k + d) % 5, (k + d) % 3, metodos[(k + d) % 5]);
  }
}
venta(hoy, '10:00', [2], 0, 0, 'efectivo');
venta(hoy, '11:30', [1], 1, 1, 'nequi');
venta(hoy, '12:10', [1, 3], 2, 2, 'transferencia');
for (let k = 0; k < 30; k++) venta(hoy, `${String(9 + (k % 4)).padStart(2, '0')}:${k % 2 ? '40' : '10'}`, [[1], [2], [3], [1, 4]][k % 4], k % 5, k % 3, metodos[k % 5]);

const gastos = [
  { id: 1, categoria: 'Productos', concepto: 'Cera y shampoo', valor: 120000, fecha: hoy },
  { id: 2, categoria: 'Suministros', concepto: 'Toallas y cuchillas', valor: 50000, fecha: hoy },
  { id: 3, categoria: 'Otros', concepto: 'Aseo', valor: 40000, fecha: hoy },
];

const total = (v) => v.items.reduce((s, i) => s + i.cantidad * i.precio_unitario - i.descuento, 0);
const diaLocal = (iso) => ymd(new Date(iso));
const enRango = (v, d, h) => { const x = diaLocal(v.fecha); return x >= d && x <= h && v.estado === 'pagada'; };

function resumen(desde, hasta) {
  const vs = ventas.filter((v) => enRango(v, desde, hasta));
  const ingresos = vs.reduce((s, v) => s + total(v), 0);
  const g = gastos.filter((x) => x.fecha >= desde && x.fecha <= hasta).reduce((s, x) => s + x.valor, 0);
  const porMetodo = {}; const top = {}; const porDia = {};
  vs.forEach((v) => {
    v.pagos.forEach((p) => { porMetodo[p.metodo] = (porMetodo[p.metodo] || 0) + p.monto; });
    v.items.forEach((i) => { top[i.servicio_id] = top[i.servicio_id] || { servicio_id: i.servicio_id, descripcion: i.descripcion, cantidad: 0 }; top[i.servicio_id].cantidad += i.cantidad; });
    porDia[diaLocal(v.fecha)] = (porDia[diaLocal(v.fecha)] || 0) + total(v);
  });
  return {
    desde, hasta, ingresos, gastos: g, ganancia_neta: ingresos - g, ventas: vs.length,
    clientes: new Set(vs.map((v) => v.cliente?.id)).size, ticket_promedio: vs.length ? Math.round(ingresos / vs.length) : 0,
    por_metodo: porMetodo, servicios_mas_pedidos: Object.values(top).sort((a, b) => b.cantidad - a.cantidad), por_dia: porDia,
  };
}

const err = (m) => { throw new Error(m); };
const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 120));

export async function handle(method, path, { query = {}, body = {} } = {}) {
  let m;
  const dueno = { id: 1, nombre: 'Dueño Level', rol: 'dueno', negocio: { nombre: 'LEVEL Barbería', slug: 'level' } };
  if (path === 'auth/yo') return wait(dueno);
  if (path === 'auth/login') return wait({ token: 'demo', usuario: dueno });
  if (path === 'auth/logout') return wait({ ok: true });
  if (path === 'servicios' || path.endsWith('/servicios')) return wait(servicios);
  if (path === 'empleados' || path.endsWith('/empleados')) return wait(empleados);
  if (path === 'clientes' && method === 'GET') return wait(clientes);
  if (path === 'clientes' && method === 'POST') { const c = { id: clientes.length + 1, ...body }; clientes.push(c); return wait(c); }
  if (path === 'fidelidad/programa') return wait(programa);
  if ((m = path.match(/^clientes\/(\d+)\/fidelidad$/))) {
    const s = sellos[m[1]] || 0;
    return wait({ programa: programa.nombre, sellos: s, meta: programa.meta_sellos, recompensa: programa.recompensa_descripcion, recompensa_disponible: s >= programa.meta_sellos });
  }
  if ((m = path.match(/^clientes\/(\d+)\/fidelidad\/redimir$/))) { sellos[m[1]] = 0; return wait({ sellos: 0, meta: programa.meta_sellos, recompensa_disponible: false }); }
  if (path === 'citas' && method === 'GET') return wait(citas.filter((c) => c.inicio_local.slice(0, 10) >= query.desde && c.inicio_local.slice(0, 10) <= query.hasta));
  if (path === 'citas' && method === 'POST') {
    const c = { id: citas.length + 1, estado: 'pendiente', inicio_local: body.inicio.replace('T', ' '), cliente: body.cliente, empleado: empleados.find((e) => e.id == body.empleado_id) || empleados[0], servicios: body.servicios.map((i) => servicios.find((s) => s.id == i)) };
    citas.push(c); return wait(c);
  }
  if ((m = path.match(/^citas\/(\d+)\/(confirmar|cancelar|no-asistio)$/))) {
    const c = citas.find((x) => x.id == m[1]) || err('Cita no encontrada');
    c.estado = { confirmar: 'confirmada', cancelar: 'cancelada', 'no-asistio': 'no_asistio' }[m[2]];
    return wait(c);
  }
  if (path === 'ventas' && method === 'GET') return wait(ventas.filter((v) => diaLocal(v.fecha) === query.fecha).reverse());
  if (path === 'ventas' && method === 'POST') {
    const items = body.items.map((i) => ({ ...i, descripcion: i.descripcion || servicios.find((s) => s.id == i.servicio_id)?.nombre, descuento: 0, cantidad: i.cantidad || 1, precio_unitario: i.precio_unitario ?? servicios.find((s) => s.id == i.servicio_id)?.precio }));
    const cli = clientes.find((c) => c.telefono === body.cliente?.telefono) || (() => { const c = { id: clientes.length + 1, ...body.cliente }; clientes.push(c); return c; })();
    const v = { id: vid++, fecha: new Date().toISOString(), estado: 'pagada', items, pagos: body.pagos, cliente: cli, empleado: empleados.find((e) => e.id == body.empleado_id) };
    ventas.push(v); sellos[cli.id] = (sellos[cli.id] || 0) + 1; return wait(v);
  }
  if (path === 'gastos' && method === 'GET') return wait(gastos.filter((g) => g.fecha >= query.desde && g.fecha <= query.hasta));
  if (path === 'gastos' && method === 'POST') { const g = { id: gastos.length + 1, fecha: hoy, ...body }; gastos.push(g); return wait(g); }
  if (path === 'reportes/resumen') return wait(resumen(query.desde, query.hasta));
  if (path === 'caja/cierres') {
    const esperado = ventas.filter((v) => diaLocal(v.fecha) === body.fecha).flatMap((v) => v.pagos).filter((p) => p.metodo === 'efectivo').reduce((s, p) => s + p.monto, 0);
    return wait({ cierre: body, efectivo_esperado: esperado, diferencia: Number(body.efectivo_contado) - esperado });
  }
  if (/^publico\/[^/]+$/.test(path)) return wait({ nombre: 'LEVEL Barbería', slug: 'level', reglas: { cancelacion_horas: 2, anticipo: null } });
  if (path.endsWith('/disponibilidad') || path === 'disponibilidad') {
    const horas = [];
    empleados.filter((e) => !query.empleado_id || e.id == query.empleado_id).forEach((e) => {
      for (let h = 9; h < 20; h++) for (const mi of ['00', '30']) if ((h * 7 + Number(mi) + e.id) % 4) horas.push({ inicio: `${query.fecha} ${String(h).padStart(2, '0')}:${mi}:00`, empleado_id: e.id, empleado: e.nombre });
    });
    return wait(horas);
  }
  if (/^publico\/[^/]+\/citas$/.test(path)) return wait({ id: 99, estado: 'pendiente', inicio: body.inicio, empleado: empleados.find((e) => e.id == body.empleado_id)?.nombre || 'Carlos', servicios: body.servicios.map((i) => servicios.find((s) => s.id == i).nombre), total: body.servicios.reduce((s, i) => s + servicios.find((x) => x.id == i).precio, 0) });
  err('Ruta de demostración no disponible: ' + path);
}
