#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/var/www/wechat-order-h5"
BACKEND_DIR="$PROJECT_ROOT/backend"

cd "$BACKEND_DIR"

npm install
npm run prisma:generate
npm run prisma:deploy
npm run build

pm2 startOrReload "$PROJECT_ROOT/deploy/pm2/ecosystem.config.cjs"
pm2 save
