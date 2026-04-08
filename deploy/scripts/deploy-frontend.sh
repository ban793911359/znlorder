#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/var/www/wechat-order-h5"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

cd "$FRONTEND_DIR"

npm install
npm run build

sudo nginx -t
sudo systemctl reload nginx
