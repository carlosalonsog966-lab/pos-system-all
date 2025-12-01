import fetch from 'node-fetch';

const url = process.env.E2E_HEALTH_URL || 'http://localhost:3000/health';
const timeoutMs = 30_000;
const start = Date.now();

(async () => {
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log('HEALTH OK', url);
        process.exit(0);
      }
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  console.error('HEALTH TIMEOUT', url);
  process.exit(1);
})();
