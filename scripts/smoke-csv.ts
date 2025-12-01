// Simple smoke test to validate CSV exports have BOM and headers
// Run with: npm run test:csv:ts

type CsvCheckResult = {
  name: string;
  url: string;
  ok: boolean;
  status: number;
  headers: Record<string, string | null>;
  hasBOM: boolean;
  lengthMatches: boolean | null;
  note?: string;
};

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5656/api';
const USERNAME = process.env.TEST_USER || 'admin';
const PASSWORD = process.env.TEST_PASS || 'admin123';

async function login(): Promise<string | null> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD })
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error(`Login failed: ${res.status} ${res.statusText}\n${txt}`);
    return null;
  }
  const json: any = await res.json();
  // Try common token shapes
  const token = json?.token || json?.accessToken || json?.access_token || json?.data?.token;
  if (!token) {
    console.error('Token not found in login response');
    return null;
  }
  return token;
}

async function fetchCsv(name: string, path: string, token?: string): Promise<CsvCheckResult> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  const status = res.status;
  const ct = res.headers.get('content-type');
  const cl = res.headers.get('content-length');
  const cc = res.headers.get('cache-control');
  const pragma = res.headers.get('pragma');
  const expires = res.headers.get('expires');
  const xcto = res.headers.get('x-content-type-options');

  const buf = new Uint8Array(await res.arrayBuffer());
  const hasBOM = buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;

  // When Content-Length exists, compare to actual bytes
  let lengthMatches: boolean | null = null;
  if (cl) {
    const expected = parseInt(cl, 10);
    if (!Number.isNaN(expected)) lengthMatches = expected === buf.length;
  }

  const headersOut: Record<string, string | null> = {
    'content-type': ct,
    'content-length': cl,
    'cache-control': cc,
    'pragma': pragma,
    'expires': expires,
    'x-content-type-options': xcto,
    'content-disposition': res.headers.get('content-disposition'),
  };

  const ok = res.ok && ct?.toLowerCase().startsWith('text/csv') === true && hasBOM === true && cc?.includes('no-cache') === true && xcto === 'nosniff';

  return { name, url, ok, status, headers: headersOut, hasBOM, lengthMatches };
}

async function run() {
  console.log(`CSV Smoke: base=${API_BASE_URL}`);
  const token = await login();
  if (!token) {
    process.exitCode = 1;
    return;
  }
  console.log(`Token acquired: ${token.substring(0, 12)}...`);

  // Discover a cash-register session to test denomination counts export
  let cashSessionId: string | null = null;
  try {
    const res = await fetch(`${API_BASE_URL}/cash-register/sessions`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const json: any = await res.json();
      const list = json?.data || json;
      const first = Array.isArray(list) ? list[0] : null;
      cashSessionId = first?.id || first?.sessionId || null;
    }
  } catch (_) { /* ignore */ }

  const tests: Array<Promise<CsvCheckResult>> = [
    fetchCsv('Audit refunds CSV', '/audit/refunds/export.csv', token),
    fetchCsv('Sales export CSV', '/sales/export/csv', token),
    fetchCsv('Inventory report (summary) CSV', '/inventory/report?format=csv&dataset=summary', token),
    fetchCsv('Files integrity CSV', '/files/integrity/export/csv', token),
    fetchCsv('Endpoints catalog CSV', '/meta/endpoints?format=csv&download=1'),
  ];

  if (cashSessionId) {
    tests.push(fetchCsv('Cash denomination counts CSV', `/cash-register/denomination-counts/${cashSessionId}/export`, token));
  } else {
    console.warn('No cash-register session found, skipping denomination counts export.');
  }

  const results = await Promise.all(tests);
  let failures = 0;
  for (const r of results) {
    const statusEmoji = r.ok ? '✅' : '❌';
    console.log(`\n${statusEmoji} ${r.name} (${r.status})\nURL: ${r.url}`);
    console.log(`- BOM: ${r.hasBOM ? 'present (EF BB BF)' : 'missing'}`);
    console.log(`- Content-Type: ${r.headers['content-type']}`);
    console.log(`- Content-Length: ${r.headers['content-length']} ${r.lengthMatches === null ? '' : r.lengthMatches ? '(matches)' : '(mismatch)'}`);
    console.log(`- Cache-Control: ${r.headers['cache-control']}`);
    console.log(`- Pragma: ${r.headers['pragma']}`);
    console.log(`- Expires: ${r.headers['expires']}`);
    console.log(`- X-Content-Type-Options: ${r.headers['x-content-type-options']}`);
    console.log(`- Content-Disposition: ${r.headers['content-disposition']}`);
    if (!r.ok) failures++;
  }

  if (failures > 0) {
    console.error(`\nCSV Smoke completed with ${failures} failure(s).`);
    process.exitCode = 1;
  } else {
    console.log('\nCSV Smoke passed: all checks OK.');
  }
}

run().catch((err) => {
  console.error('Smoke error:', err);
  process.exitCode = 1;
});

