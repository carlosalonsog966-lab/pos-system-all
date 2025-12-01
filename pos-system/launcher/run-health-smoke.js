#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.includes('=') ? a.split('=') : [a, ''];
      const key = k.replace(/^--/, '');
      if (v) args[key] = v;
      else args[key] = '1';
    }
  }
  return args;
}

function readFrontendUrlFromEnv() {
  const envPath = path.resolve(__dirname, '..', 'backend', '.env');
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*FRONTEND_URL\s*=\s*(.+)\s*$/i);
      if (m) {
        return m[1].trim();
      }
    }
  } catch (e) {
    // ignore
  }
  return '';
}

function main() {
  const args = parseArgs(process.argv);
  const once = !!args.once;
  const strictArg = args.strict;
  const expectedArg = args.expected || args.expectedOrigin;
  const refundArg = args.refund;

  const envExpected = process.env.EXPECTED_ORIGIN || process.env.ExpectedOrigin;
  const fromEnvFile = readFrontendUrlFromEnv();

  const expectedOrigin = expectedArg || envExpected || fromEnvFile || 'http://localhost:5175';
  const strictCors = typeof strictArg !== 'undefined' ? String(strictArg) : (process.env.STRICT_CORS_CHECK || '1');
  const refundSmoke = typeof refundArg !== 'undefined' ? String(refundArg) : (process.env.REFUND_SMOKE || '1');

  const childEnv = { ...process.env, EXPECTED_ORIGIN: expectedOrigin, STRICT_CORS_CHECK: strictCors, REFUND_SMOKE: refundSmoke };

  const scriptPath = path.resolve(__dirname, 'health-e2e.js');
  const childArgs = [scriptPath];
  if (once) childArgs.push('--once');

  console.log(`[run-health-smoke] EXPECTED_ORIGIN=${expectedOrigin} STRICT_CORS_CHECK=${strictCors} REFUND_SMOKE=${refundSmoke}`);
  const child = spawn(process.execPath, childArgs, { stdio: 'inherit', env: childEnv });
  child.on('exit', (code) => {
    process.exitCode = code;
  });
}

main();

