#!/usr/bin/env sh
# Generate a self-signed certificate for local HTTPS with docker compose.
# For production, mount real certificates (e.g. from Let's Encrypt) at
# deploy/nginx/certs/fullchain.pem and deploy/nginx/certs/privkey.pem instead.
set -eu
DIR="$(cd "$(dirname "$0")" && pwd)/certs"
mkdir -p "$DIR"
if [ -f "$DIR/fullchain.pem" ] && [ -f "$DIR/privkey.pem" ]; then
  echo "Certificates already exist in $DIR. Delete them to regenerate."
  exit 0
fi
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "$DIR/privkey.pem" -out "$DIR/fullchain.pem" \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
echo "Wrote self-signed certificate to $DIR"
