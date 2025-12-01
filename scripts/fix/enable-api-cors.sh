#!/usr/bin/env bash
set -e

SITE="/etc/nginx/sites-available/api-pos.conf"

if [ ! -f "$SITE" ]; then
  echo "api-pos.conf no existe en $SITE" >&2
  exit 1
fi

cat > "$SITE" <<'EOF'
server {
  listen 80;
  server_name api.opalandcosystem.com;

  # CORS básico para frontend en Vercel
  # Permite orígenes apex y www
  set $cors_origin "";
  if ($http_origin ~* ^https://(www\.)?opalandcosystem\.com$) {
    set $cors_origin $http_origin;
  }

  location /api/ {
    if ($request_method = OPTIONS) {
      add_header Access-Control-Allow-Origin $cors_origin;
      add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS";
      add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With";
      add_header Access-Control-Allow-Credentials "true";
      return 204;
    }

    add_header Access-Control-Allow-Origin $cors_origin;
    add_header Access-Control-Allow-Credentials "true";

    proxy_pass http://127.0.0.1:7000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    return 200 'API online';
    add_header Content-Type text/plain;
  }
}
EOF

ln -sf "$SITE" /etc/nginx/sites-enabled/api-pos.conf
nginx -t
systemctl reload nginx
echo "CORS habilitado para api.opalandcosystem.com"
