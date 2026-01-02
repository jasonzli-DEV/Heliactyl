# Heliactyl v13

Modern game server dashboard for Pterodactyl Panel.

## Features

- **Modern UI** - Beautiful dark theme with React 18 + Tailwind CSS
- **No Config Files** - All settings stored in database, configured via setup wizard
- **Admin Dashboard** - Full admin panel for users, servers, packages, and more
- **Discord Authentication** - Secure OAuth2 login with Discord
- **Resource Management** - Coins, RAM, disk, CPU allocation system
- **Store & Coupons** - Built-in store for resource purchases and promo codes
- **AFK Rewards** - Earn coins by staying on the dashboard

## Requirements

- Node.js 18+
- Pterodactyl Panel with Application API key
- Discord Application (for OAuth)

## Installation

```bash
# Clone the repository
git clone https://github.com/EnderBit/heliactyl.git
cd heliactyl

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate
npx prisma db push

# Build for production
npm run build

# Start the server
npm start
```

On first visit, you'll be guided through the setup wizard to configure:
- Discord OAuth credentials
- Pterodactyl API connection
- Admin account

## Development

```bash
npm run dev
```

## Updating

```bash
# Run the update script (as root on your server)
sudo bash update.sh
```

Or manually:
```bash
git pull
npm ci
npx prisma generate
npx prisma db push
npm run build
# Restart your service
```

## Production Deployment

### Using systemd

Create `/etc/systemd/system/heliactyl.service`:
```ini
[Unit]
Description=Heliactyl Dashboard
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/heliactyl
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

Then:
```bash
systemctl enable heliactyl
systemctl start heliactyl
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name dash.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dash.example.com;

    ssl_certificate /etc/letsencrypt/live/dash.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dash.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
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

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS
- **Backend**: Express.js, TypeScript, Prisma ORM
- **Database**: SQLite (default), supports PostgreSQL/MySQL
- **Auth**: Discord OAuth2, JWT sessions

## License

MIT License - © EnderBit Hosting 2025
