# Safe Deployment Guide

## Important Files to Preserve

The following files must NEVER be deleted during updates:

1. **uploads/** - Contains user-uploaded files (favicons, logos, etc.)
2. **.env** - Contains environment configuration
3. **prisma/heliactyl.db** - The database file
4. **prisma/heliactyl.db-journal** - Database journal file

## Deployment Methods

### Method 1: Safe Deployment Script (Recommended for Development)

Use the `deploy-safe.sh` script for safe deployments that preserve all user data:

```bash
./deploy-safe.sh
```

This script:
- Backs up uploads, .env, and database before deployment
- Deploys only code changes
- Restores all preserved files
- Applies database migrations
- Restarts the service

### Method 2: Server Update Script

On the server, use the update.sh script:

```bash
cd /var/www/heliactyl
sudo bash update.sh
```

This script:
- Backs up database, uploads, and .env
- Pulls latest changes from GitHub
- Restores all preserved files
- Applies migrations
- Restarts the service

## Manual Deployment (Not Recommended)

If you must deploy manually, use this rsync command:

```bash
rsync -avz \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'uploads' \
    --exclude '.env' \
    --exclude 'prisma/heliactyl.db' \
    --exclude 'prisma/heliactyl.db-journal' \
    /path/to/local/heliactyl/ root@bisect.tx:/var/www/heliactyl/
```

**WARNING:** Never use `--delete` flag in rsync as it will remove user uploads!

## After Deployment

Always check:
1. Service status: `systemctl status heliactyl`
2. Uploads directory exists: `ls -la /var/www/heliactyl/uploads/`
3. .env file exists: `cat /var/www/heliactyl/.env`
4. Database is intact: `ls -la /var/www/heliactyl/prisma/heliactyl.db`

## Recovering Lost Files

If uploads were accidentally deleted:

1. Check backups:
```bash
ls -la /root/enderactyl-backups/
```

2. Restore uploads:
```bash
cp -r /root/enderactyl-backups/uploads_<timestamp>/* /var/www/heliactyl/uploads/
chown -R www-data:www-data /var/www/heliactyl/uploads/
```

3. Restore .env:
```bash
cp /root/enderactyl-backups/.env_<timestamp> /var/www/heliactyl/.env
```

## Database References

If favicon/logo files are missing but still referenced in the database:

1. Check database settings:
```bash
sqlite3 /var/www/heliactyl/prisma/heliactyl.db "SELECT logo, favicon FROM Settings;"
```

2. Either:
   - Re-upload the files through the admin panel
   - Or clear the database references:
```bash
sqlite3 /var/www/heliactyl/prisma/heliactyl.db "UPDATE Settings SET logo=NULL, favicon=NULL;"
```
