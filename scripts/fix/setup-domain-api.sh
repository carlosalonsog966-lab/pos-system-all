#!/usr/bin/env bash
set -e

DOMAIN="opalandcosystem.com"
API_HOST="api.${DOMAIN}"
REPO_DIR="/opt/pos-system-all"

SITE="/etc/nginx/sites-available/api-pos.conf"
cat > "$SITE" <<'EOF'
server {
  listen 80;
  server_name api.opalandcosystem.com;
  location /api/ {
    proxy_pass http://127.0.0.1:7000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  location / { return 200 "API online"; add_header Content-Type text/plain; }
}
EOF

ln -sf "$SITE" /etc/nginx/sites-enabled/api-pos.conf
rm -f /etc/nginx/sites-enabled/default || true
nginx -t
systemctl reload nginx

apt -y install certbot python3-certbot-nginx
certbot --nginx -d "$API_HOST" --redirect

sed -i "s|^PUBLIC_ORIGIN=.*$|PUBLIC_ORIGIN=https://$DOMAIN|" "$REPO_DIR/pos-system/.env" || true
sed -i "s|^FRONTEND_URL=.*$|FRONTEND_URL=https://$DOMAIN|" "$REPO_DIR/pos-system/.env" || true
cp "$REPO_DIR/pos-system/.env" "$REPO_DIR/pos-system/backend/.env" || true

pkill -f "src/server.ts" || true
cd "$REPO_DIR/pos-system/backend" && npx ts-node --transpile-only src/server.ts &
sleep 3

echo "API Health (HTTPS):" && curl -s "https://$API_HOST/api/test-health" || true
echo "Set Vercel VITE_API_URL=https://$API_HOST/api and redeploy"
