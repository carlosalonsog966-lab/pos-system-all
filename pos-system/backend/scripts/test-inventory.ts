import 'dotenv/config';

const BASE_URL = process.env.PORT ? `http://localhost:${process.env.PORT}/api` : 'http://localhost:5656/api';

type Json = Record<string, any>;

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${res.statusText} -> ${JSON.stringify(data)}`);
  const token = data.token || data.accessToken || data.access_token || data.data?.token;
  if (!token) throw new Error('No token in login response');
  return token as string;
}

async function getWithAuth(path: string, token: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function postWithAuth(path: string, token: string, body?: Json): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function ensureTestProduct(token: string): Promise<string> {
  const list = await getWithAuth('/products?limit=1', token);
  const existing = Array.isArray(list?.data) && list.data.length > 0 ? list.data[0] : null;
  if (existing?.id) return existing.id as string;

  const codeSuffix = Date.now().toString().slice(-6);
  const body: Json = {
    code: `TEST-INV-${codeSuffix}`,
    name: 'Producto Inventario',
    description: 'Creado para pruebas automáticas de inventario',
    category: 'Otros',
    material: 'Plata',
    purchasePrice: 50,
    salePrice: 80,
    stock: 5,
    minStock: 2,
    gender: 'unisex',
  };
  const created = await postWithAuth('/products', token, body);
  const productId = created?.data?.id;
  if (!productId) throw new Error(`Product creation failed: ${JSON.stringify(created).slice(0, 500)}`);
  return productId as string;
}

async function main() {
  try {
    console.log('🚀 Iniciando pruebas de inventario...');
    const token = await login();
    console.log('🔑 Token obtenido');

    const productId = await ensureTestProduct(token);
    console.log('🆔 Producto de prueba:', productId);

    // 1) Stats
    const stats = await getWithAuth('/inventory/stats?period=30d', token);
    console.log('✅ /inventory/stats:', JSON.stringify(stats).slice(0, 500));

    // 2) Reporte
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date().toISOString();
    const report = await getWithAuth(`/inventory/report?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`, token);
    console.log('✅ /inventory/report:', JSON.stringify(report).slice(0, 500));

    // 3) Low stock
    const lowStock = await getWithAuth('/inventory/low-stock?limit=10', token);
    console.log('✅ /inventory/low-stock:', JSON.stringify(lowStock).slice(0, 500));

    // 4) Historial
    const history = await getWithAuth(`/inventory/products/${productId}/history?page=1&limit=10`, token);
    console.log('✅ /inventory/products/:id/history:', JSON.stringify(history).slice(0, 500));

    // 5) Movimientos IN y OUT
    const inBody: Json = {
      productId,
      type: 'in',
      quantity: 3,
      reason: 'Ingreso de prueba',
      reference: 'TEST-IN',
      notes: 'Prueba automática',
      idempotencyKey: `IN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    const updIn = await postWithAuth('/inventory/update-stock', token, inBody);
    console.log('✅ IN /inventory/update-stock:', JSON.stringify(updIn).slice(0, 500));

    const outBody: Json = {
      productId,
      type: 'out',
      quantity: 2,
      reason: 'Salida de prueba',
      reference: 'TEST-OUT',
      notes: 'Prueba automática',
      idempotencyKey: `OUT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    const updOut = await postWithAuth('/inventory/update-stock', token, outBody);
    console.log('✅ OUT /inventory/update-stock:', JSON.stringify(updOut).slice(0, 500));

    // 6) Balance
    const balance = await getWithAuth(`/inventory/products/${productId}/balance`, token);
    console.log('✅ /inventory/products/:id/balance:', JSON.stringify(balance).slice(0, 500));

    // 7) Reconciliar producto
    const reconcileProduct = await postWithAuth(`/inventory/products/${productId}/reconcile`, token);
    console.log('✅ POST /inventory/products/:id/reconcile:', JSON.stringify(reconcileProduct).slice(0, 500));

    // 8) Reconciliación global
    const reconcileAll = await postWithAuth('/inventory/reconcile', token);
    console.log('✅ POST /inventory/reconcile:', JSON.stringify(reconcileAll).slice(0, 500));

    console.log('🎉 Pruebas de inventario completadas');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Error en pruebas de inventario:', err?.message || String(err));
    process.exit(1);
  }
}

main();

