#!/bin/sh
set -eu
# Start API sidecar (feed proxy + GitHub idea-loop queue), then nginx.
node /opt/thinker/feed-proxy-server.mjs &
exec /docker-entrypoint.sh nginx -g 'daemon off;'
