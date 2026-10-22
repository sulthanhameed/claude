#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Seed the Khang database
# Usage:  ./database/scripts/seed.sh [mongo-uri]
# ─────────────────────────────────────────────────────────────
set -euo pipefail

MONGO_URI="${1:-mongodb://localhost:27017/khang}"

echo "🌱 Seeding database at $MONGO_URI"
echo ""

# Use the Node-based seed in backend (handles bcrypt for admin password)
cd "$(dirname "$0")/../../backend"

if [ ! -d node_modules ]; then
  echo "→ Installing backend dependencies..."
  npm install
fi

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@khang.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

MONGO_URI="$MONGO_URI" \
ADMIN_EMAIL="$ADMIN_EMAIL" \
ADMIN_PASSWORD="$ADMIN_PASSWORD" \
npm run seed

echo ""
echo "✅ Done!"
echo "   Admin login: $ADMIN_EMAIL"
echo "   (Change ADMIN_PASSWORD before going live!)"
