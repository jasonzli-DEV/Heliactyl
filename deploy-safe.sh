#!/bin/bash
# Safe deployment script that preserves uploads, .env, and database

set -e

SERVER="root@bisect.tx"
REMOTE_DIR="/var/www/heliactyl"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

echo ""
info "Starting safe deployment to $SERVER..."
echo ""

# Build locally
log "Building application..."
cd "$LOCAL_DIR"
npm run build

# Backup uploads on server
log "Backing up uploads on server..."
ssh $SERVER "mkdir -p /tmp/heliactyl-backup && \
    cp -r $REMOTE_DIR/uploads /tmp/heliactyl-backup/ 2>/dev/null || true && \
    cp $REMOTE_DIR/.env /tmp/heliactyl-backup/ 2>/dev/null || true && \
    cp $REMOTE_DIR/prisma/heliactyl.db /tmp/heliactyl-backup/ 2>/dev/null || true"

# Deploy files (excluding sensitive files and database)
log "Deploying files..."
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'uploads' \
    --exclude '.env' \
    --exclude 'prisma/heliactyl.db' \
    --exclude 'prisma/heliactyl.db-journal' \
    --exclude 'prisma/enderactyl.db' \
    --exclude 'prisma/enderactyl.db-journal' \
    "$LOCAL_DIR/" "$SERVER:$REMOTE_DIR/"

# Restore uploads on server
log "Restoring uploads..."
ssh $SERVER "cp -r /tmp/heliactyl-backup/uploads/* $REMOTE_DIR/uploads/ 2>/dev/null || mkdir -p $REMOTE_DIR/uploads && \
    cp /tmp/heliactyl-backup/.env $REMOTE_DIR/.env 2>/dev/null || echo 'DATABASE_URL=\"file:./heliactyl.db\"' > $REMOTE_DIR/.env && \
    cp /tmp/heliactyl-backup/heliactyl.db $REMOTE_DIR/prisma/ 2>/dev/null || true && \
    rm -rf /tmp/heliactyl-backup"

# Install dependencies and apply migrations
log "Installing dependencies..."
ssh $SERVER "cd $REMOTE_DIR && npm ci --omit=dev"

log "Applying database migrations..."
ssh $SERVER "cd $REMOTE_DIR && npx prisma generate && npx prisma db push"

# Fix permissions
log "Fixing permissions..."
ssh $SERVER "chown -R www-data:www-data $REMOTE_DIR && \
    chmod 755 $REMOTE_DIR/uploads && \
    chmod 644 $REMOTE_DIR/.env"

# Restart service
log "Restarting service..."
ssh $SERVER "systemctl restart heliactyl"

sleep 2

# Check status
if ssh $SERVER "systemctl is-active --quiet heliactyl"; then
    log "Deployment successful!"
    ssh $SERVER "systemctl status heliactyl --no-pager -l | head -20"
else
    warn "Service may have issues, checking logs..."
    ssh $SERVER "journalctl -u heliactyl -n 30"
fi

echo ""
log "Deployment complete!"
echo ""
