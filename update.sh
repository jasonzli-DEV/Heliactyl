#!/bin/bash
# Heliactyl Update Script
# This script safely updates Heliactyl while preserving all settings and data

set -e

INSTALL_DIR="/var/www/heliactyl"
GITHUB_REPO="https://github.com/jasonzli-DEV/Heliactyl.git"
BRANCH="main"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Heliactyl Update Script          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root"
fi

# Check if Heliactyl is installed
if [ ! -d "$INSTALL_DIR" ]; then
    error "Heliactyl not found at $INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Get current version
CURRENT_VERSION=$(grep '"version"' package.json | head -1 | cut -d '"' -f 4 || echo "unknown")
info "Current version: $CURRENT_VERSION"

# Check for updates
log "Checking for updates..."

# Create backup directory
BACKUP_DIR="/root/heliactyl-backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Backup database (CRITICAL - preserves all settings including billing rates)
if [ -f "prisma/heliactyl.db" ]; then
    cp prisma/heliactyl.db "$BACKUP_DIR/heliactyl_$TIMESTAMP.db"
    log "Database backed up to: $BACKUP_DIR/heliactyl_$TIMESTAMP.db"
fi

# Backup uploads directory
if [ -d "uploads" ] && [ "$(ls -A uploads 2>/dev/null)" ]; then
    cp -r uploads "$BACKUP_DIR/uploads_$TIMESTAMP"
    log "Uploads backed up"
fi

# Backup .env file
if [ -f ".env" ]; then
    cp .env "$BACKUP_DIR/.env_$TIMESTAMP"
    log ".env backed up"
fi

# Stop the service
if systemctl is-active --quiet heliactyl; then
    log "Stopping Heliactyl service..."
    systemctl stop heliactyl
fi

# Pull latest changes
log "Pulling latest changes from GitHub..."
if [ -d ".git" ]; then
    git fetch origin
    git reset --hard origin/$BRANCH
else
    warn "Not a git repository, performing fresh clone..."
    cd /var/www
    mv heliactyl "heliactyl_backup_$TIMESTAMP" 2>/dev/null || true
    git clone "$GITHUB_REPO" heliactyl
    cd heliactyl
    
    # Restore database (PRESERVES ALL SETTINGS)
    if [ -f "$BACKUP_DIR/heliactyl_$TIMESTAMP.db" ]; then
        cp "$BACKUP_DIR/heliactyl_$TIMESTAMP.db" prisma/heliactyl.db
        log "Database restored - all settings preserved"
    fi
    
    # Restore uploads
    if [ -d "$BACKUP_DIR/uploads_$TIMESTAMP" ]; then
        cp -r "$BACKUP_DIR/uploads_$TIMESTAMP"/* uploads/ 2>/dev/null || mkdir -p uploads
        log "Uploads restored"
    fi
    
    # Restore .env
    if [ -f "$BACKUP_DIR/.env_$TIMESTAMP" ]; then
        cp "$BACKUP_DIR/.env_$TIMESTAMP" .env
        log ".env restored"
    fi
fi

# Install dependencies
log "Installing dependencies..."
npm ci --production=false 2>/dev/null || npm install

# Generate Prisma client
log "Generating Prisma client..."
npx prisma generate

# Apply database migrations WITHOUT data loss
log "Applying database migrations (preserving data)..."
npx prisma db push --skip-generate 2>/dev/null || npx prisma db push

# Build application
log "Building application..."
npm run build

# Set permissions
chown -R www-data:www-data "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/uploads"
chmod 755 "$INSTALL_DIR/uploads"
chmod 755 "$INSTALL_DIR/prisma"
chmod 664 "$INSTALL_DIR/prisma/heliactyl.db" 2>/dev/null || true

# Restart service
if systemctl is-enabled --quiet heliactyl 2>/dev/null; then
    log "Restarting Heliactyl service..."
    systemctl start heliactyl
fi

# Get new version
NEW_VERSION=$(grep '"version"' package.json | head -1 | cut -d '"' -f 4 || echo "unknown")

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Update Complete!               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
info "Previous version: $CURRENT_VERSION"
info "Current version:  $NEW_VERSION"
echo ""
log "All your settings, billing rates, and user data have been preserved."
log "Backup location: $BACKUP_DIR"
echo ""

# Cleanup old backups (keep last 10)
find "$BACKUP_DIR" -name "heliactyl_*.db" -type f | sort -r | tail -n +11 | xargs -r rm 2>/dev/null || true
