#!/usr/bin/env bash
set -e

REPO_DIR="/opt/pos-system-all"
IP=$(hostname -I | awk '{print $1}')

SITE="/etc/nginx/sites-available/pos.conf"
cat > "$SITE" <<'EOF'
server {
  listen 80;
  server_name _;
  root /var/www/pos;
  index index.html;
  location /api/ {
    proxy_pass http://127.0.0.1:7000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  location / {
    try_files $uri $uri/ /index.html;
  }
}
EOF

ln -sf "$SITE" /etc/nginx/sites-enabled/pos.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

cd "$REPO_DIR/pos-system/frontend"
npm ci
VITE_API_URL="http://$IP/api" npm run build
mkdir -p /var/www/pos
rm -rf /var/www/pos/*
cp -r dist/* /var/www/pos/

cd "$REPO_DIR/pos-system/backend"
HEALTH_URL_LOCAL="http://127.0.0.1:7000/api/test-health"
if ! curl -fs "$HEALTH_URL_LOCAL" > /dev/null; then
  npm ci
  pkill -f "src/server.ts" || true
  pkill -f "dist/server.js" || true
  npx ts-node --transpile-only src/server.ts &
  sleep 3
fi

curl -s "$HEALTH_URL_LOCAL" || true
curl -s "http://$IP/api/test-health" || true

if curl -fs "http://$IP/api/test-health" > /dev/null; then
  ufw delete allow 7000/tcp || true
fi

echo "APP_URL=http://$IP/"
echo "PROXY_HEALTH=http://$IP/api/test-health"
echo "LOGIN=admin/admin123"
