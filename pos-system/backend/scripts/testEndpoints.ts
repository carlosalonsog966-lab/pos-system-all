import 'dotenv/config';

const BASE_URL = process.env.PORT ? `http://localhost:${process.env.PORT}/api` : 'http://localhost:5656/api';

async function login() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${res.statusText}`);
  const data: any = await res.json();
  const token = data.token || data.accessToken || data.access_token || data.data?.token;
  if (!token) throw new Error('No token in login response');
  return token;
}

async function getWithAuth(path: string, token: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  try {
    console.log('🚀 Testing endpoints...');
    const token = await login();
    console.log('🔑 Token acquired');

    const weekly = await getWithAuth('/rankings/weekly', token);
    console.log('✅ /rankings/weekly:', JSON.stringify(weekly).slice(0, 500));

    const productsPerf = await getWithAuth('/rankings/products/performance', token);
    console.log('✅ /rankings/products/performance:', JSON.stringify(productsPerf).slice(0, 500));

    console.log('🎉 Done');
  } catch (err) {
    console.error('❌ Error testing endpoints:', err);
    process.exit(1);
  }
}

main();

