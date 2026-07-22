#!/bin/sh
set -eu
# Start CORS-safe RSS proxy, then nginx (forwards /api/feed-proxy).
node /opt/thinker/feed-proxy-server.mjs &
exec /docker-entrypoint.sh nginx -g 'daemon off;'
