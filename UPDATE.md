# Updating Heliactyl

This guide covers how to safely update Heliactyl to the latest version.

## Quick Update (Recommended)

### Via Admin Panel
1. Go to **Admin → Settings**
2. Scroll to "System Updates"
3. Click **Check for Updates**
4. If an update is available, click **Update Now**
5. Wait for the process to complete (the page will reload)

### Via SSH
```bash
ssh root@your-server
cd /var/www/heliactyl
bash update.sh
```

## What Gets Preserved

The update process automatically preserves:
- ✅ All user accounts and data
- ✅ All servers and their configurations
- ✅ All billing settings (rates, enabled state, etc.)
- ✅ Store settings and prices
- ✅ Packages and coupons
- ✅ Tickets and messages
- ✅ Audit logs
- ✅ Uploaded files (avatars, attachments)
- ✅ All other settings

## Manual Update

If the automatic update fails, you can update manually:

```bash
# Stop the service
systemctl stop heliactyl

# Navigate to install directory
cd /var/www/heliactyl

# Backup your database (IMPORTANT!)
cp prisma/heliactyl.db /root/heliactyl-backup-$(date +%Y%m%d).db

# Pull latest changes
git fetch origin
git reset --hard origin/main

# Install dependencies
npm ci

# Generate Prisma client
npx prisma generate

# Apply migrations (preserves data)
npx prisma db push

# Build the application
npm run build

# Fix permissions
chown -R www-data:www-data /var/www/heliactyl
chmod 664 prisma/heliactyl.db

# Start the service
systemctl start heliactyl
```

## Rollback

If something goes wrong, you can restore from backup:

```bash
# Stop the service
systemctl stop heliactyl

# Restore the database from backup
cp /root/heliactyl-backups/heliactyl_YYYYMMDD_HHMMSS.db prisma/heliactyl.db

# Fix permissions
chown www-data:www-data prisma/heliactyl.db
chmod 664 prisma/heliactyl.db

# Start the service
systemctl start heliactyl
```

Backups are stored in `/root/heliactyl-backups/` and the last 10 are kept automatically.

## Version Checking

To check your current version:

```bash
cd /var/www/heliactyl
grep '"version"' package.json
```

Or via the Admin Panel at **Admin → Settings** in the System Updates section.

## Troubleshooting

### Update fails with database errors
```bash
# Restore from backup
cp /root/heliactyl-backups/heliactyl_LATEST.db prisma/heliactyl.db
chown www-data:www-data prisma/heliactyl.db

# Try migration again
npx prisma db push --accept-data-loss
```

### Service won't start after update
```bash
# Check logs
journalctl -u heliactyl -n 50

# Common fix: permissions
chown -R www-data:www-data /var/www/heliactyl
chmod 664 prisma/heliactyl.db
```

### Settings reset after update
This should not happen with the current update script. If it does:
1. Restore from backup: `cp /root/heliactyl-backups/heliactyl_LATEST.db prisma/heliactyl.db`
2. Report the issue on GitHub

## Important Notes

- **Never delete** your database file (`prisma/heliactyl.db`) - it contains ALL your data
- Always ensure backups completed before updating
- The update script is safe to run multiple times
- Major version updates may require additional steps (check release notes)
