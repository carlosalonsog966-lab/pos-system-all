#!/usr/bin/env bash
set -e

APT_GET="apt-get"
$APT_GET update
$APT_GET -y install git nginx ufw nodejs npm curl

ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw --force enable || true

REPO_DIR="/opt/pos-system-all"
if [ ! -d "$REPO_DIR" ]; then
  git clone https://github.com/carlosalonsog966-lab/pos-system-all.git "$REPO_DIR"
fi

BACKEND_PORT="${BACKEND_PORT:-7000}"
HOST="${HOST:-0.0.0.0}"
HTTPS="${HTTPS:-false}"
JWT_SECRET="${JWT_SECRET:-}"
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -base64 32)
fi

ORIGIN_URL="${PUBLIC_ORIGIN:-}"
if [ -z "$ORIGIN_URL" ]; then
  IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')
  ORIGIN_URL="http://${IP}"
fi

FRONTEND_URL="${FRONTEND_URL:-$ORIGIN_URL}"

ENV_PATH="$REPO_DIR/pos-system/.env"
rm -f "$ENV_PATH"
echo "BACKEND_PORT=$BACKEND_PORT" >> "$ENV_PATH"
echo "HOST=$HOST" >> "$ENV_PATH"
echo "HTTPS=$HTTPS" >> "$ENV_PATH"
echo "JWT_SECRET=$JWT_SECRET" >> "$ENV_PATH"
echo "PUBLIC_ORIGIN=$ORIGIN_URL" >> "$ENV_PATH"
echo "FRONTEND_URL=$FRONTEND_URL" >> "$ENV_PATH"
cp "$ENV_PATH" "$REPO_DIR/pos-system/backend/.env"

cd "$REPO_DIR/pos-system/backend"
npm ci
systemctl stop pos-backend 2>/dev/null || true
pkill -f "src/server.ts" 2>/dev/null || true
pkill -f "dist/server.js" 2>/dev/null || true

SERVICE_FILE="/etc/systemd/system/pos-backend.service"
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=POS Backend
After=network.target

[Service]
WorkingDirectory=$REPO_DIR/pos-system/backend
EnvironmentFile=$REPO_DIR/pos-system/.env
ExecStart=/usr/bin/node $REPO_DIR/pos-system/backend/dist/server.js
Restart=always
User=root
Group=root

[Install]
WantedBy=multi-user.target
EOF

npx ts-node --transpile-only src/server.ts &
sleep 3
curl -s "http://127.0.0.1:$BACKEND_PORT/api/test-health" || true

cd "$REPO_DIR/pos-system/frontend"
npm ci
VITE_API_URL="$ORIGIN_URL/api" npm run build
mkdir -p /var/www/pos
rm -rf /var/www/html/* 2>/dev/null || true
cp -r dist/* /var/www/pos/

NGINX_SITE="/etc/nginx/sites-available/pos.conf"
cat > "$NGINX_SITE" <<EOF
server {
  listen 80;
  server_name _;
  root /var/www/pos;
  index index.html;
  location /api/ {
    proxy_pass http://127.0.0.1:$BACKEND_PORT/;
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

ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/pos.conf
nginx -t
systemctl reload nginx

cd "$REPO_DIR/pos-system/backend"
npx ts-node src/scripts/create_admin.ts || true
npx ts-node src/scripts/reset_admin_password.ts || true

systemctl daemon-reload
systemctl enable pos-backend || true

echo "APP_URL=$ORIGIN_URL"
echo "BACKEND_HEALTH=$ORIGIN_URL/api/test-health"
echo "LOGIN: admin / admin123"
