#!/bin/bash
# Heliactyl v13 Update Script
# This script updates Heliactyl to the latest version from GitHub

set -e

INSTALL_DIR="/var/www/heliactyl"
GITHUB_REPO="https://github.com/EnderBit/heliactyl.git"
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
echo -e "${BLUE}║      Heliactyl v13 Update Script         ║${NC}"
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

# Backup database
BACKUP_DIR="/root/heliactyl-backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/heliactyl_backup_$TIMESTAMP.db"

if [ -f "prisma/heliactyl.db" ]; then
    cp prisma/heliactyl.db "$BACKUP_FILE"
    log "Database backed up to: $BACKUP_FILE"
fi

# Enable maintenance mode (stop the service)
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
    # Not a git repo, backup and re-clone
    warn "Not a git repository, performing fresh clone..."
    cd /var/www
    mv heliactyl "heliactyl_backup_$TIMESTAMP"
    git clone "$GITHUB_REPO" heliactyl
    cd heliactyl
    
    # Restore database
    if [ -f "$BACKUP_FILE" ]; then
        cp "$BACKUP_FILE" prisma/heliactyl.db
        log "Database restored"
    fi
fi

# Install dependencies
log "Installing dependencies..."
npm ci --production=false

# Run database migrations
log "Running database migrations..."
npx prisma generate
npx prisma db push --accept-data-loss 2>/dev/null || npx prisma db push

# Build application
log "Building application..."
npm run build

# Set permissions
chown -R www-data:www-data "$INSTALL_DIR"

# Restart service
if systemctl is-enabled --quiet heliactyl 2>/dev/null; then
    log "Restarting Heliactyl service..."
    systemctl start heliactyl
fi

# Get new version
NEW_VERSION=$(grep '"version"' package.json | head -1 | cut -d '"' -f 4 || echo "unknown")

echo ""
log "Update complete!"
info "Previous version: $CURRENT_VERSION"
info "Current version: $NEW_VERSION"
echo ""

# Cleanup old backups (keep last 5)
find "$BACKUP_DIR" -name "heliactyl_backup_*.db" -type f | sort -r | tail -n +6 | xargs -r rm
