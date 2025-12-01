import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

type Expected = {
  ui?: string[];
  network?: { method: string; endpoint: string }[];
};
type Control = {
  testId?: string;
  role?: string;
  name?: string;
  optional?: boolean;
  expected?: Expected;
};
type RouteSpec = {
  route: string;
  controls: Control[];
  postCreate?: { verify?: any[] };
  rbac?: { role: 'seller'|'admin'; mustHide?: string[] };
};
type Spec = { routes: RouteSpec[] };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, '../../exports/reports/UI-AUDIT');
const SUMMARY = () => {
  const ts = new Date().toISOString().replace(/[:.]/g,'-');
  const dir = path.join(OUT_DIR, ts);
  fs.mkdirSync(dir, { recursive: true });
  return { dir, csv: path.join(dir, 'summary.csv') };
};

async function gotoRoute(page, baseURL: string, route: string) {
  await page.goto(`${baseURL}${route}`);
  await page.waitForLoadState('networkidle');
}

async function performLogin(page, baseURL: string) {
  // Navigate to login page
  await page.goto(`${baseURL}/login`);
  await page.waitForLoadState('networkidle');
  
  // Fill login form with demo credentials
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  
  // Submit login form
  await page.click('button[type="submit"]');
  
  // Wait for navigation to complete
  await page.waitForLoadState('networkidle');
  
  // Verify we're logged in by checking if we're on dashboard
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    throw new Error('Login failed - still on login page');
  }
}

function toCSVRow(obj: Record<string, any>) {
  const v = (x:any)=> typeof x==='string'? `"${x.replace(/"/g,'""')}"` : `"${JSON.stringify(x).replace(/"/g,'""')}"`;
  return [
    obj.module ?? '',
    obj.route ?? '',
    obj.testId ?? '',
    obj.action ?? '',
    obj.expected ?? '',
    obj.networkHit ?? '',
    obj.domChanged ?? '',
    obj.routeChanged ?? '',
    obj.modalChanged ?? '',
    obj.toast ?? '',
    obj.consoleErrors ?? '',
    obj.pageErrors ?? '',
    obj.result ?? '',
    obj.notes ?? ''
  ].map(v).join(',');
}

async function findControl(page, c: Control) {
  if (c.testId) {
    const el = page.getByTestId(c.testId);
    if (await el.count()) return el;
  }
  if (c.role) {
    const el = page.getByRole(c.role as any, c.name? { name: c.name } : undefined);
    if (await el.count()) return el;
  }
  if (c.name) {
    const el = page.getByText(c.name);
    if (await el.count()) return el;
  }
  // fallback: first button present
  const btns = page.getByRole('button');
  if (await btns.count()) return btns.first();
  return null;
}

async function performActionAndObserve(page, locator, expected: Expected|undefined) {
  const urlBefore = page.url();
  const htmlBefore = await page.content();

  let networkHit = false;
  const endpoints = (expected?.network ?? []).map(n => n.endpoint);
  page.on('response', (resp) => {
    try {
      const ok = endpoints.some(e => resp.url().includes(e));
      if (ok) networkHit = true;
    } catch {}
  });

  let consoleErrors = 0;
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors++; });
  let pageErrors = 0;
  page.on('pageerror', () => { pageErrors++; });

  // Try click and keyboard activation
  try { await locator.click({ timeout: 3000 }); } catch {}
  try { await locator.press('Enter'); } catch {}
  try { await locator.press(' '); } catch {}

  // Wait a short time for effects
  await page.waitForTimeout(600);

  const urlAfter = page.url();
  const htmlAfter = await page.content();

  // Heurísticas UI
  const routeChanged = urlBefore !== urlAfter;
  const domChanged = htmlBefore.length !== htmlAfter.length;
  // Modal: buscar role dialog
  const modalChanged = (await page.getByRole('dialog').count()) > 0;
  // Toast: buscar role status o textos comunes
  const toast = (await page.getByRole('status').count()) > 0
             || (await page.getByText(/(éxito|guardad[oa]|actualizad[oa]|error|fall[a|ó])/i).count()) > 0;

  // Persistencia opcional: si expected incluye reloadPersist
  if (expected?.ui?.includes('reloadPersist')) {
    await page.reload();
    await page.waitForLoadState('networkidle');
  }

  return {
    networkHit,
    domChanged,
    routeChanged,
    modalChanged,
    toast,
    consoleErrors,
    pageErrors
  };
}

test.describe('UI Auditor (joyería POS)', () => {
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173'; // ajustar según app
  const { dir, csv } = SUMMARY();
  fs.writeFileSync(csv, 'module,route,testId,action,expected,networkHit,domChanged,routeChanged,modalChanged,toast,consoleErrors,pageErrors,result,notes\n');

  const spec: Spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/ui-actions-map.json'), 'utf-8'));

  for (const r of spec.routes) {
    test.describe(`Route ${r.route}`, () => {
      test(`visit ${r.route}`, async ({ page }) => {
        await performLogin(page, baseURL);
        await gotoRoute(page, baseURL, r.route);
        await expect(page).toHaveURL(new RegExp(r.route.replace(/\//g,'\\/')));
      });

      for (const c of r.controls) {
        test(`${r.route} • ${c.testId || c.role || c.name}`, async ({ page }, testInfo) => {
          let result: 'PASS'|'FAIL'|'SKIP' = 'FAIL'; let notes = '';
          try {
            await performLogin(page, baseURL);
            await gotoRoute(page, baseURL, r.route);
            const locator = await findControl(page, c);
            if (!locator) {
              result = c.optional ? 'SKIP' : 'FAIL';
              notes = 'control no encontrado';
            } else {
              const obs = await performActionAndObserve(page, locator, c.expected);
              const criticalFail =
                 (!c.optional && !obs.domChanged && !obs.routeChanged && !obs.modalChanged && !obs.networkHit) ||
                 obs.pageErrors > 0 || obs.consoleErrors > 0;
              result = criticalFail ? 'FAIL' : 'PASS';
              notes = JSON.stringify(obs);
            }
          } catch (e:any) {
            result = c.optional ? 'SKIP' : 'FAIL';
            notes = `excepción: ${e?.message||e}`;
          } finally {
            fs.appendFileSync(csv, toCSVRow({
              module: 'POS',
              route: r.route,
              testId: c.testId || c.role || c.name,
              action: 'activate',
              expected: c.expected || {},
              result,
              notes
            })+'\n');
            if (result !== 'PASS') {
              await testInfo.attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' });
            }
            expect(result).toBe('PASS');
          }
        });
      }
    });
  }
});
