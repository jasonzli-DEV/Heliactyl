# Uninstalling Heliactyl

This guide covers how to completely remove Heliactyl from your server.

## Before Uninstalling

⚠️ **Warning**: Uninstalling will NOT automatically delete servers from Pterodactyl. You should:

1. Delete or transfer ownership of all servers in Pterodactyl
2. Backup any important data you want to keep
3. Inform your users if this is a production system

## Quick Uninstall

Run the uninstall script:

```bash
ssh root@your-server
cd /var/www/heliactyl
bash uninstall.sh
```

Or manually:

```bash
# Stop and disable the service
systemctl stop heliactyl
systemctl disable heliactyl

# Remove systemd service file
rm /etc/systemd/system/heliactyl.service
systemctl daemon-reload

# Remove nginx configuration (if using nginx)
rm /etc/nginx/sites-enabled/heliactyl.conf
rm /etc/nginx/sites-available/heliactyl.conf
nginx -t && systemctl reload nginx

# Remove the application
rm -rf /var/www/heliactyl

# Remove backups (optional)
rm -rf /root/heliactyl-backups

echo "Heliactyl has been removed."
```

## Create Uninstall Script

If the uninstall script doesn't exist, create it:

```bash
cat > /var/www/heliactyl/uninstall.sh << 'EOF'
#!/bin/bash
# Heliactyl Uninstall Script

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${RED}╔══════════════════════════════════════════╗${NC}"
echo -e "${RED}║       Heliactyl Uninstall Script         ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════╝${NC}"
echo ""

read -p "Are you sure you want to uninstall Heliactyl? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Uninstall cancelled."
    exit 0
fi

echo ""
echo -e "${YELLOW}[!]${NC} Creating final backup..."
BACKUP_DIR="/root/heliactyl-final-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -f "prisma/heliactyl.db" ]; then
    cp prisma/heliactyl.db "$BACKUP_DIR/"
fi
if [ -d "uploads" ]; then
    cp -r uploads "$BACKUP_DIR/"
fi
if [ -f ".env" ]; then
    cp .env "$BACKUP_DIR/"
fi

echo -e "${GREEN}[✓]${NC} Backup saved to: $BACKUP_DIR"

echo -e "${YELLOW}[!]${NC} Stopping service..."
systemctl stop heliactyl 2>/dev/null || true
systemctl disable heliactyl 2>/dev/null || true

echo -e "${YELLOW}[!]${NC} Removing systemd service..."
rm -f /etc/systemd/system/heliactyl.service
systemctl daemon-reload

echo -e "${YELLOW}[!]${NC} Removing nginx configuration..."
rm -f /etc/nginx/sites-enabled/heliactyl.conf 2>/dev/null || true
rm -f /etc/nginx/sites-available/heliactyl.conf 2>/dev/null || true
nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true

echo -e "${YELLOW}[!]${NC} Removing application files..."
cd /var/www
rm -rf heliactyl

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       Uninstall Complete!                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "Your data backup is at: $BACKUP_DIR"
echo ""
echo "To restore in the future:"
echo "  1. Reinstall Heliactyl"
echo "  2. Copy heliactyl.db to prisma/heliactyl.db"
echo "  3. Copy uploads/* to uploads/"
echo ""
EOF
chmod +x /var/www/heliactyl/uninstall.sh
```

## What Gets Removed

- ✅ Heliactyl application files (`/var/www/heliactyl/`)
- ✅ Systemd service (`heliactyl.service`)
- ✅ Nginx configuration (if present)

## What Gets Preserved

- ✅ Final backup created in `/root/heliactyl-final-backup-*/`
- ✅ Pterodactyl servers (must be deleted separately)
- ✅ Pterodactyl user accounts (must be deleted separately)
- ✅ Previous backups in `/root/heliactyl-backups/`

## Cleaning Up Pterodactyl

After uninstalling Heliactyl, you may want to clean up Pterodactyl:

### Delete All Heliactyl-Created Servers
```bash
# Via Pterodactyl admin panel:
# Admin → Servers → Delete each server

# Or via API (careful!):
# This requires scripting against the Pterodactyl API
```

### Delete All Heliactyl-Created Users
```bash
# Via Pterodactyl admin panel:
# Admin → Users → Delete each user created by Heliactyl
```

## Complete System Cleanup

To remove all traces including dependencies (only if not used by other apps):

```bash
# Remove Node.js (if only used by Heliactyl)
# apt remove nodejs npm

# Remove nginx (if only used by Heliactyl)
# apt remove nginx

# Remove all backups
rm -rf /root/heliactyl-backups
rm -rf /root/heliactyl-final-backup-*

# Remove any leftover config
rm -rf ~/.npm/_cacache/
```

## Reinstalling Later

If you want to reinstall Heliactyl later with your old data:

1. Follow the installation guide
2. After installation but before running setup:
   ```bash
   cp /root/heliactyl-final-backup-*/heliactyl.db /var/www/heliactyl/prisma/
   cp -r /root/heliactyl-final-backup-*/uploads/* /var/www/heliactyl/uploads/
   chown -R www-data:www-data /var/www/heliactyl
   ```
3. Start the service: `systemctl start heliactyl`
4. Your old data will be restored!
