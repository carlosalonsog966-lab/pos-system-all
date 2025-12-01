// Utilidades simples para manejar hash y enlaces compartibles
// Compatibles con formatos: "#GET" y "#method=GET&module=ventas&q=clientes&sort=path&page=1&limit=20"

function parseHashParams() {
  const raw = String(window.location.hash || '').replace(/^#/, '');
  const out = { method: '', module: '', q: '', sort: '', dir: 'asc', page: 1, limit: 20 };
  const allowed = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const upper = raw.toUpperCase();
  if (allowed.includes(upper)) {
    out.method = upper;
    return out;
  }
  if (raw.includes('=')) {
    const params = new URLSearchParams(raw);
    const m = (params.get('method') || '').toUpperCase();
    const mod = params.get('module') || '';
    const q = params.get('q') || '';
    const sort = params.get('sort') || '';
    const dir = (params.get('dir') || 'asc').toLowerCase();
    const page = parseInt(params.get('page') || '1', 10) || 1;
    const limit = parseInt(params.get('limit') || '20', 10) || 20;
    if (allowed.includes(m)) out.method = m;
    if (mod) out.module = mod;
    if (q) out.q = q;
    if (sort) out.sort = sort;
    out.dir = (dir === 'desc') ? 'desc' : 'asc';
    out.page = Math.max(1, page);
    out.limit = Math.max(1, limit);
  }
  return out;
}

function buildHashFromParams(params) {
  const p = new URLSearchParams();
  if (params.method) p.set('method', params.method);
  if (params.module) p.set('module', params.module);
  if (params.q) p.set('q', params.q);
  if (params.sort) p.set('sort', params.sort);
  if (params.dir && params.dir !== 'asc') p.set('dir', params.dir);
  if (params.page && params.page !== 1) p.set('page', String(params.page));
  if (params.limit && params.limit !== 20) p.set('limit', String(params.limit));
  const s = p.toString();
  return s ? '#' + s : '';
}

function setHashFromParams(params) {
  window.location.hash = buildHashFromParams(params);
}

function copyUrlWithParams(params) {
  const href = window.location.origin + window.location.pathname + buildHashFromParams(params);
  return navigator.clipboard.writeText(href);
}

// Exponer en window para uso desde páginas estáticas sin bundler
window.URLUtils = {
  parseHashParams,
  buildHashFromParams,
  setHashFromParams,
  copyUrlWithParams,
};
