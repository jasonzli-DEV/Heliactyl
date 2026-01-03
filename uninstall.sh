#!/bin/bash
# Heliactyl Uninstall Script

set -e

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
echo -e "${RED}╔══════════════════════════════════════════╗${NC}"
echo -e "${RED}║       Heliactyl Uninstall Script         ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root"
fi

echo -e "${YELLOW}WARNING: This will completely remove Heliactyl from your system.${NC}"
echo ""
echo "This will:"
echo "  - Stop and disable the Heliactyl service"
echo "  - Remove all application files"
echo "  - Remove nginx configuration"
echo "  - Create a final backup of your data"
echo ""
echo "This will NOT:"
echo "  - Delete servers from Pterodactyl"
echo "  - Delete users from Pterodactyl"
echo "  - Remove previous backups"
echo ""

read -p "Are you sure you want to continue? Type 'yes' to confirm: " confirm
if [ "$confirm" != "yes" ]; then
    echo ""
    info "Uninstall cancelled."
    exit 0
fi

echo ""

# Create final backup
BACKUP_DIR="/root/heliactyl-final-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

warn "Creating final backup..."
cd /var/www/heliactyl 2>/dev/null || error "Heliactyl not found at /var/www/heliactyl"

if [ -f "prisma/heliactyl.db" ]; then
    cp prisma/heliactyl.db "$BACKUP_DIR/"
    log "Database backed up"
fi

if [ -d "uploads" ] && [ "$(ls -A uploads 2>/dev/null)" ]; then
    cp -r uploads "$BACKUP_DIR/"
    log "Uploads backed up"
fi

if [ -f ".env" ]; then
    cp .env "$BACKUP_DIR/"
    log ".env backed up"
fi

log "Backup saved to: $BACKUP_DIR"

# Stop service
warn "Stopping Heliactyl service..."
systemctl stop heliactyl 2>/dev/null || true
systemctl disable heliactyl 2>/dev/null || true
log "Service stopped"

# Remove systemd service
warn "Removing systemd service..."
rm -f /etc/systemd/system/heliactyl.service
systemctl daemon-reload
log "Systemd service removed"

# Remove nginx configuration
warn "Removing nginx configuration..."
rm -f /etc/nginx/sites-enabled/heliactyl.conf 2>/dev/null || true
rm -f /etc/nginx/sites-available/heliactyl.conf 2>/dev/null || true
if nginx -t 2>/dev/null; then
    systemctl reload nginx 2>/dev/null || true
fi
log "Nginx configuration removed"

# Remove application files
warn "Removing application files..."
cd /var/www
rm -rf heliactyl
log "Application files removed"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       Uninstall Complete!                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
info "Your data backup is at: $BACKUP_DIR"
echo ""
echo "To restore in the future:"
echo "  1. Reinstall Heliactyl"
echo "  2. Copy heliactyl.db to prisma/heliactyl.db"
echo "  3. Copy uploads/* to uploads/"
echo "  4. Restart the service"
echo ""
