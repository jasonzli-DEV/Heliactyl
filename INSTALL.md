# Enderactyl v13 Installation Guide

## Quick Installation (Recommended)

We provide an automated installation script for Ubuntu/Debian servers:

```bash
# Download and run the installer
bash <(curl -s https://raw.githubusercontent.com/jasonzli-DEV/Enderactyl/main/install.sh)
```

The script will:
- Install Node.js 20.x if not present
- Clone the repository to `/var/www/enderactyl`
- Install dependencies
- Set up the database
- Build the application
- Create systemd service
- Set proper permissions

After installation, visit your domain and complete the setup wizard.

---

## Manual Installation

### Prerequisites

- Ubuntu 20.04+ or Debian 11+
- Node.js 18+ (Node.js 20 recommended)
- Pterodactyl Panel with Application API key
- Discord Application (OAuth2)
- Domain name with SSL certificate (optional but recommended)

### Step 1: Install Node.js

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 2: Clone Repository

```bash
# Create directory and clone
sudo mkdir -p /var/www/enderactyl
cd /var/www/enderactyl
sudo git clone https://github.com/jasonzli-DEV/Enderactyl.git .
```

### Step 3: Install Dependencies

```bash
sudo npm install
```

### Step 4: Setup Database

```bash
# Generate Prisma client
sudo npx prisma generate

# Create database schema
sudo npx prisma db push
```

### Step 5: Build Application

```bash
sudo npm run build
```

### Step 6: Set Permissions

```bash
# Create www-data user if not exists
sudo useradd -r -s /bin/false www-data 2>/dev/null || true

# Set ownership
sudo chown -R www-data:www-data /var/www/enderactyl
```

### Step 7: Create Systemd Service

Create `/etc/systemd/system/enderactyl.service`:

```ini
[Unit]
Description=Enderactyl Dashboard
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/enderactyl
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3005

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable enderactyl
sudo systemctl start enderactyl
```

Check status:

```bash
sudo systemctl status enderactyl
```

### Step 8: Setup Nginx (Optional)

Install Nginx:

```bash
sudo apt install nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/enderactyl.conf`:

```nginx
server {
    listen 80;
    server_name dash.example.com;
    
    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and get SSL certificate:

```bash
sudo ln -s /etc/nginx/sites-available/enderactyl.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d dash.example.com
```

---

## First-Time Setup

1. Visit your domain (e.g., `https://dash.example.com`)
2. Complete the setup wizard:
   - **Discord OAuth**: Create app at https://discord.com/developers/applications
     - Set redirect URL: `https://dash.example.com/auth/discord/callback`
   - **Pterodactyl API**: Enter panel URL and Application API key
   - **Admin Account**: Enter your Discord ID
3. Login with Discord
4. Configure settings in Admin Panel

---

## Updating

### Using Admin Panel (Easiest)

1. Go to Admin → Settings
2. Click "Check for Updates"
3. Click "Install Update Now"
4. Wait for restart

### Using Command Line

```bash
cd /var/www/enderactyl
sudo bash update.sh
```

Or manually:

```bash
cd /var/www/enderactyl
sudo git pull origin main
sudo npm ci
sudo npx prisma generate
sudo npx prisma db push
sudo npm run build
sudo systemctl restart enderactyl
```

---

## Troubleshooting

### Check Logs

```bash
# Service logs
sudo journalctl -u enderactyl -f

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Database Issues

```bash
# Reset database (WARNING: Deletes all data)
cd /var/www/enderactyl
sudo rm prisma/enderactyl.db
sudo npx prisma db push
```

### Permission Issues

```bash
# Fix permissions
sudo chown -R www-data:www-data /var/www/enderactyl
```

### Port Already in Use

```bash
# Check what's using port 3005
sudo lsof -i :3005

# Change port in systemd service
sudo systemctl edit enderactyl
# Add: Environment=PORT=3006
sudo systemctl restart enderactyl
```

---

## Support

- GitHub Issues: https://github.com/jasonzli-DEV/Enderactyl/issues
- Discord: Contact server owner

---

## Security Recommendations

1. **Use HTTPS** - Always use SSL/TLS certificates
2. **Firewall** - Only allow ports 80, 443, and SSH
3. **Updates** - Keep system and Node.js updated
4. **Backups** - Regularly backup `/var/www/enderactyl/prisma/enderactyl.db`
5. **Strong Passwords** - Use strong Discord bot tokens and API keys

---

## License

MIT License - © EnderBit Hosting 2025
