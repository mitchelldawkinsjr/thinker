#!/usr/bin/env bash
# Add thinker.360web.cloud proxy host to Nginx Proxy Manager (SQLite).
# Run on VPS with sudo access to /data/nginx/database.sqlite
set -euo pipefail

DOMAIN="thinker.360web.cloud"
FORWARD_HOST="thinker-app"
FORWARD_PORT=80
DB="${NPM_DB:-/data/nginx/database.sqlite}"
LE_EMAIL="${LE_EMAIL:-mitchell.dawkinsjr@gmail.com}"
NOW=$(date "+%Y-%m-%d %H:%M:%S")

EXIST=$(sudo sqlite3 "$DB" "SELECT id FROM proxy_host WHERE domain_names LIKE '%${DOMAIN}%' AND is_deleted=0 LIMIT 1;" || true)
if [ -n "$EXIST" ]; then
  echo "Proxy host already exists: id=$EXIST"
  HOST_ID=$EXIST
  CERT_ID=$(sudo sqlite3 "$DB" "SELECT certificate_id FROM proxy_host WHERE id=$HOST_ID;")
else
  sudo sqlite3 "$DB" <<SQL
INSERT INTO certificate (created_on, modified_on, owner_user_id, is_deleted, provider, nice_name, domain_names, expires_on, meta)
VALUES ('$NOW', '$NOW', 1, 0, 'letsencrypt', '${DOMAIN}', '["${DOMAIN}"]', '2099-01-01 00:00:00', '{}');
SQL

  CERT_ID=$(sudo sqlite3 "$DB" "SELECT id FROM certificate WHERE nice_name='${DOMAIN}' ORDER BY id DESC LIMIT 1;")
  echo "Created certificate id=$CERT_ID"

  sudo sqlite3 "$DB" <<SQL
INSERT INTO proxy_host (
  created_on, modified_on, owner_user_id, is_deleted, domain_names,
  forward_host, forward_port, access_list_id, certificate_id, ssl_forced,
  caching_enabled, block_exploits, advanced_config, meta,
  allow_websocket_upgrade, http2_support, forward_scheme, enabled,
  locations, hsts_enabled, hsts_subdomains
) VALUES (
  '$NOW', '$NOW', 1, 0, '["${DOMAIN}"]',
  '${FORWARD_HOST}', ${FORWARD_PORT}, 0, $CERT_ID, 1,
  0, 0, '', '{"nginx_online":true,"nginx_err":null}',
  1, 0, 'http', 1,
  '[]', 0, 0
);
SQL

  HOST_ID=$(sudo sqlite3 "$DB" "SELECT id FROM proxy_host WHERE domain_names LIKE '%${DOMAIN}%' ORDER BY id DESC LIMIT 1;")
  echo "Created proxy_host id=$HOST_ID -> ${FORWARD_HOST}:${FORWARD_PORT}"

  docker restart nginx-proxy
  sleep 8
fi

write_http_conf() {
  docker exec nginx-proxy sh -c "cat > /data/nginx/proxy_host/${HOST_ID}.conf <<EOF
# ------------------------------------------------------------
# ${DOMAIN}
# ------------------------------------------------------------

server {
  set \\\$forward_scheme http;
  set \\\$server         \"${FORWARD_HOST}\";
  set \\\$port           ${FORWARD_PORT};

  listen 80;
  listen [::]:80;

  server_name ${DOMAIN};

  include conf.d/include/letsencrypt-acme-challenge.conf;

  access_log /data/logs/proxy-host-${HOST_ID}_access.log proxy;
  error_log /data/logs/proxy-host-${HOST_ID}_error.log warn;

  location / {
    include conf.d/include/proxy.conf;
  }

  include /data/nginx/custom/server_proxy[.]conf;
}
EOF"
}

write_ssl_conf() {
  docker exec nginx-proxy sh -c "cat > /data/nginx/proxy_host/${HOST_ID}.conf <<EOF
# ------------------------------------------------------------
# ${DOMAIN}
# ------------------------------------------------------------

map \\\$scheme \\\$hsts_header {
    https   \"max-age=63072000; preload\";
}

server {
  set \\\$forward_scheme http;
  set \\\$server         \"${FORWARD_HOST}\";
  set \\\$port           ${FORWARD_PORT};

  listen 80;
  listen [::]:80;
  listen 443 ssl;
  listen [::]:443 ssl;

  server_name ${DOMAIN};

  http2 on;

  include conf.d/include/letsencrypt-acme-challenge.conf;
  include conf.d/include/ssl-cache.conf;
  include conf.d/include/ssl-ciphers.conf;
  ssl_certificate /etc/letsencrypt/live/npm-${CERT_ID}/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/npm-${CERT_ID}/privkey.pem;

  include conf.d/include/assets.conf;
  include conf.d/include/block-exploits.conf;

  access_log /data/logs/proxy-host-${HOST_ID}_access.log proxy;
  error_log /data/logs/proxy-host-${HOST_ID}_error.log warn;

  location / {
    include conf.d/include/proxy.conf;
  }

  include /data/nginx/custom/server_proxy[.]conf;
}
EOF"
}

if docker exec nginx-proxy test -f "/etc/letsencrypt/live/npm-${CERT_ID}/fullchain.pem"; then
  write_ssl_conf
  docker exec nginx-proxy nginx -s reload
  echo "SSL certificate already present for ${DOMAIN}"
else
  write_http_conf
  docker exec nginx-proxy nginx -s reload

  echo "Requesting Let's Encrypt certificate..."
  if docker exec nginx-proxy certbot certonly \
    --webroot -w /data/letsencrypt-acme-challenge \
    -d "${DOMAIN}" \
    --non-interactive --agree-tos \
    -m "${LE_EMAIL}" \
    --cert-name "npm-${CERT_ID}"; then
    write_ssl_conf
    sudo sqlite3 "$DB" "UPDATE certificate SET provider='letsencrypt', expires_on='2027-07-21 00:00:00' WHERE id=${CERT_ID};"
    echo "SSL certificate issued for ${DOMAIN}"
  else
    echo "::warning::Certbot failed; HTTP-only proxy is active. Retry certbot after DNS propagates."
    sudo sqlite3 "$DB" "UPDATE proxy_host SET ssl_forced=0 WHERE id=${HOST_ID};"
  fi

  docker exec nginx-proxy nginx -s reload
fi

sudo sqlite3 "$DB" "SELECT id, domain_names, forward_host, forward_port, certificate_id, ssl_forced, enabled FROM proxy_host WHERE id=$HOST_ID;"
