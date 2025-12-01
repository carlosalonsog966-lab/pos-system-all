#!/usr/bin/env bash
set -e

SERVICE_PATH="/etc/systemd/system/pos-backend.service"
WORKDIR="/opt/pos-system-all/pos-system/backend"
ENV_FILE="/opt/pos-system-all/pos-system/.env"

cat > "$SERVICE_PATH" <<'EOF'
[Unit]
Description=POS Backend (ts-node transpile-only)
After=network.target

[Service]
WorkingDirectory=/opt/pos-system-all/pos-system/backend
EnvironmentFile=/opt/pos-system-all/pos-system/.env
ExecStart=/usr/bin/env bash -lc 'cd /opt/pos-system-all/pos-system/backend && /usr/bin/npx ts-node --transpile-only src/server.ts'
Restart=on-failure
RestartSec=3
User=root
Group=root
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now pos-backend
systemctl status pos-backend --no-pager || true
journalctl -u pos-backend -n 80 --no-pager || true

echo "Local health:" && curl -s http://127.0.0.1:7000/api/test-health || true
echo "Public health:" && curl -s https://api.opalandcosystem.com/api/test-health || true
