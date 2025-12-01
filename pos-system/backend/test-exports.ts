// Script de prueba de exportaciones (Excel, PDF) y PNG de gráficas
// Ejecutar con: npx ts-node test-exports.ts

import fs from 'fs';
import path from 'path';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5656/api';

async function authenticateUser(): Promise<string | null> {
  try {
    console.log('🔐 Autenticando usuario...');
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    if (!response.ok) {
      console.log(`❌ Login falló: ${response.status} ${response.statusText}`);
      const errText = await response.text();
      console.log(errText);
      return null;
    }
    const data: any = await response.json();
    const token = data.token || data.accessToken || data.access_token || data.data?.token;
    if (!token) {
      console.log('❌ Respuesta de login sin token');
      return null;
    }
    console.log('✅ Autenticación OK');
    return token;
  } catch (err) {
    console.log(`❌ Error autenticando: ${err}`);
    return null;
  }
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function saveFile(filePath: string, buf: Buffer) {
  await fs.promises.writeFile(filePath, buf);
  console.log(`💾 Guardado: ${filePath} (${buf.length} bytes)`);
}

async function testExportExcel(token: string, outDir: string) {
  console.log('\n📄 Probando exportación Excel...');
  const body = {
    format: 'excel',
    data: {
      filters: {
        reportType: 'sales',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
        groupBy: 'day',
      },
    },
  };
  const resp = await fetch(`${API_BASE_URL}/reports/export`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    console.log(`❌ Excel HTTP ${resp.status}: ${txt}`);
    return;
  }
  const arr = new Uint8Array(await resp.arrayBuffer());
  const buf = Buffer.from(arr);
  await saveFile(path.join(outDir, `sales_jan2024.xls`), buf);
}

async function testExportPDF(token: string, outDir: string) {
  console.log('\n📄 Probando exportación PDF...');
  const body = {
    format: 'pdf',
    data: {
      filters: {
        reportType: 'sales',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
        groupBy: 'day',
      },
    },
    frontendUrl: 'http://localhost:5177',
  };
  const resp = await fetch(`${API_BASE_URL}/reports/export`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    console.log(`❌ PDF HTTP ${resp.status}: ${txt}`);
    return;
  }
  const arr = new Uint8Array(await resp.arrayBuffer());
  const buf = Buffer.from(arr);
  await saveFile(path.join(outDir, `sales_jan2024.pdf`), buf);
}

async function testChartPNG(token: string, outDir: string) {
  console.log('\n🖼️ Probando exportación PNG (gráfica)...');
  const body = { chartType: 'sales', dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' }, frontendUrl: 'http://localhost:5177', width: 1200, height: 800 };
  const resp = await fetch(`${API_BASE_URL}/reports/chart/png`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    console.log(`❌ PNG HTTP ${resp.status}: ${txt}`);
    return;
  }
  const arr = new Uint8Array(await resp.arrayBuffer());
  const buf = Buffer.from(arr);
  await saveFile(path.join(outDir, `sales_jan2024.png`), buf);
}

async function run() {
  const token = await authenticateUser();
  if (!token) {
    console.log('🚫 Sin token, abortando.');
    process.exit(1);
  }
  const outDir = path.join(process.cwd(), '..', 'exports', 'test');
  ensureDir(outDir);

  await testExportExcel(token, outDir);
  await testExportPDF(token, outDir);
  await testChartPNG(token, outDir);

  console.log('\n✅ Pruebas de exportación completadas');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
