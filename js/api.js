import { handle } from './mock.js';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: la sesión dura lo que dure la pestaña */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* idem */ } },
};

export const sesion = {
  base: store.get('level.api') || 'http://localhost:8000/api/v1',
  slug: store.get('level.slug') || 'level',
  token: store.get('level.token'),
  demo: store.get('level.demo') === '1',
  usuario: null,
  guardar() {
    store.set('level.api', this.base); store.set('level.slug', this.slug);
    this.token ? store.set('level.token', this.token) : store.del('level.token');
    store.set('level.demo', this.demo ? '1' : '0');
  },
  cerrar() { this.token = null; this.demo = false; this.usuario = null; this.guardar(); },
};

async function llamar(method, path, { query, body } = {}) {
  if (sesion.demo) return handle(method, path, { query, body });

  const url = new URL(`${sesion.base.replace(/\/$/, '')}/${path}`);
  Object.entries(query || {}).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(`${k}[]`, x));
    else if (v != null && v !== '') url.searchParams.set(k, v);
  });

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(sesion.token ? { Authorization: `Bearer ${sesion.token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('No hay conexión con el servidor. Revisa que el backend esté encendido.');
  }

  const datos = await res.json().catch(() => null);
  if (res.status === 401 && sesion.token) { sesion.cerrar(); location.hash = '#/login'; }
  if (!res.ok) {
    const primero = datos?.errors && Object.values(datos.errors)[0]?.[0];
    throw new Error(primero || datos?.message || `Error ${res.status}`);
  }
  return datos;
}

export const api = {
  get: (p, query) => llamar('GET', p, { query }),
  post: (p, body) => llamar('POST', p, { body: body ?? {} }),
  put: (p, body) => llamar('PUT', p, { body }),
  del: (p) => llamar('DELETE', p),

  async login(email, password) {
    const r = await llamar('POST', 'auth/login', { body: { email, password, dispositivo: 'panel-web' } });
    sesion.token = r.token; sesion.usuario = r.usuario; sesion.guardar();
    return r;
  },
  async yo() {
    sesion.usuario = await llamar('GET', 'auth/yo');
    return sesion.usuario;
  },
  async logout() {
    try { await llamar('POST', 'auth/logout', { body: {} }); } catch { /* el token ya no sirve */ }
    sesion.cerrar();
  },
  publico: (p, query) => llamar('GET', `publico/${sesion.slug}${p}`, { query }),
  reservar: (body) => llamar('POST', `publico/${sesion.slug}/citas`, { body }),
};

export function entrarDemo() {
  sesion.demo = true; sesion.token = 'demo';
  sesion.usuario = { id: 1, nombre: 'Dueño Level', rol: 'dueno', negocio: { nombre: 'LEVEL Barbería', slug: 'level' } };
  sesion.guardar();
}
