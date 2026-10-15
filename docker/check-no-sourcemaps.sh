#!/bin/sh
# Falla si la imagen del frontend contiene algún archivo .map (docs/sentry.md).
# Uso: sh docker/check-no-sourcemaps.sh <imagen>
set -eu
image="$1"

echo "Carpeta servida por Nginx (/usr/share/nginx/html):"
docker run --rm --entrypoint sh "$image" -c 'find /usr/share/nginx/html -type f | sort'

maps=$(docker run --rm --entrypoint sh "$image" -c 'find / -xdev -type f -name "*.map" 2>/dev/null || true')
if [ -n "$maps" ]; then
  echo "::error::La imagen contiene source maps:"
  echo "$maps"
  exit 1
fi
echo "Sin archivos .map en la imagen."
