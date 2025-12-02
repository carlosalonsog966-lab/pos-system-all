#!/usr/bin/env bash
set -e
apt update && apt -y upgrade
apt -y install curl git nginx ufw
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt -y install nodejs
fi
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
if [ ! -d /opt/pos-system-all ]; then
  git clone https://github.com/carlosalonsog966-lab/pos-system-all.git /opt/pos-system-all
fi
SECRET=$(openssl rand -base64 32)
IP=$(hostname -I | awk '{print $1}')
cat >/opt/pos-system-all/pos-system/.env <<EOF
BACKEND_PORT=7000
HOST=0.0.0.0
HTTPS=false
JWT_SECRET=$SECRET
PUBLIC_ORIGIN=http://$IP
FRONTEND_URL=http://$IP
EOF
cp /opt/pos-system-all/pos-system/.env /opt/pos-system-all/pos-system/backend/.env
cd /opt/pos-system-all/pos-system/backend
npm ci
npm run build
cat >/etc/systemd/system/pos-backend.service <<EOF
[Unit]
Description=POS Backend
After=network.target
[Service]
WorkingDirectory=/opt/pos-system-all/pos-system/backend
EnvironmentFile=/opt/pos-system-all/pos-system/.env
ExecStart=/usr/bin/node /opt/pos-system-all/pos-system/backend/dist/server.js
Restart=always
User=root
Group=root
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now pos-backend
cd /opt/pos-system-all/pos-system/frontend
npm ci
VITE_API_URL="http://$IP/api" npm run build
mkdir -p /var/www/pos
rm -rf /var/www/pos/*
cp -r dist/* /var/www/pos/
cat >/etc/nginx/sites-available/pos.conf <<EOF
server {
  listen 80;
  server_name _;
  root /var/www/pos;
  index index.html;
  location /api/ {
    proxy_pass http://127.0.0.1:7000/;
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
ln -sf /etc/nginx/sites-available/pos.conf /etc/nginx/sites-enabled/pos.conf
nginx -t
systemctl reload nginx
cd /opt/pos-system-all/pos-system/backend
npx ts-node src/scripts/create_admin.ts || true
npx ts-node src/scripts/reset_admin_password.ts || true
curl -s http://127.0.0.1:7000/api/test-health || true
echo "Ready: open http://$IP/ and login with admin/admin123"
