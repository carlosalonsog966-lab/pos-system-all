#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 8080);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let reqPath = decodeURIComponent(url.pathname);
    if (reqPath.endsWith('/')) reqPath += 'index.html';
    const filePath = path.join(root, reqPath);

    // Prevent path traversal
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(root)) {
      return send(res, 403, { 'Content-Type': 'text/plain' }, 'Forbidden');
    }

    fs.stat(resolved, (err, stat) => {
      if (err || !stat.isFile()) {
        return send(res, 404, { 'Content-Type': 'text/plain' }, 'Not Found');
      }
      const ext = path.extname(resolved).toLowerCase();
      const type = types[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      fs.createReadStream(resolved).pipe(res);
    });
  } catch (e) {
    send(res, 500, { 'Content-Type': 'text/plain' }, 'Server Error');
  }
});

server.listen(port, () => {
  console.log(`[static-server] Serving`, root, 'on http://localhost:' + port + '/');
});

