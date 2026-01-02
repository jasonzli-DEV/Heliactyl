#!/bin/bash
# Enderactyl - Quick Deploy Script
# Run this on your server to deploy or update Enderactyl

set -e

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
echo -e "${BLUE}║       Enderactyl Deploy Script           ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root (sudo)"
fi

INSTALL_DIR="/var/www/enderactyl"
GITHUB_REPO="https://github.com/jasonzli-DEV/Enderactyl.git"

# Detect if this is new installation or update
if [ -d "$INSTALL_DIR" ]; then
    info "Existing installation detected - running update"
    cd "$INSTALL_DIR"
    bash update.sh
    exit 0
fi

# New installation
info "New installation - deploying Enderactyl"

# Install dependencies
log "Installing system dependencies..."
apt update
apt install -y curl git nginx nodejs npm certbot python3-certbot-nginx

# Install Node 20
log "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Clone repository
log "Cloning Enderactyl..."
mkdir -p /var/www
cd /var/www
git clone "$GITHUB_REPO" enderactyl
cd enderactyl

# Install dependencies
log "Installing Node.js packages..."
npm install

# Generate Prisma client
log "Setting up database..."
npx prisma generate
npx prisma db push

# Build application
log "Building application..."
npm run build

# Set permissions
log "Setting permissions..."
chown -R www-data:www-data "$INSTALL_DIR"

# Create systemd service
log "Creating systemd service..."
cat > /etc/systemd/system/enderactyl.service <<EOF
[Unit]
Description=Enderactyl Dashboard
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3005

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable enderactyl
systemctl start enderactyl

log "Enderactyl deployed successfully!"
echo ""
info "Next steps:"
echo "1. Configure Nginx reverse proxy for your domain"
echo "2. Run: certbot --nginx -d yourdomain.com"
echo "3. Visit your domain and complete setup wizard"
echo ""
info "Service commands:"
echo "  - Status:  systemctl status enderactyl"
echo "  - Logs:    journalctl -u enderactyl -f"
echo "  - Restart: systemctl restart enderactyl"
echo ""
