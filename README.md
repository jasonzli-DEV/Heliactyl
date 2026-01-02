# Heliactyl v13

Modern game server dashboard for Pterodactyl Panel with prepaid hourly billing.

## Features

- **Modern UI** - Beautiful dark theme with React 18 + Tailwind CSS
- **Prepaid Hourly Billing** - Charge users per hour for server resources
- **Admin Dashboard** - Full admin panel for users, servers, packages, and more
- **Discord Authentication** - Secure OAuth2 login with Discord
- **Resource Management** - Coins, RAM, disk, CPU allocation system
- **Store & Coupons** - Built-in store for resource purchases and promo codes
- **AFK Rewards & Link Earnings** - Earn coins by staying on dashboard or completing links
- **Auto-Update** - One-click updates from GitHub in admin panel
- **Maintenance Mode** - Built-in maintenance page for downtime

## Quick Installation

```bash
# Download and run automated installer (Ubuntu/Debian)
bash <(curl -s https://raw.githubusercontent.com/jasonzli-DEV/Heliactyl/main/install.sh)
```

**For detailed installation instructions, see [INSTALL.md](INSTALL.md)**

## Requirements

- Node.js 18+ (20.x recommended)
- Pterodactyl Panel with Application API key
- Discord Application (for OAuth)
- Ubuntu/Debian server (for automated installer)

## First-Time Setup

1. Visit your domain
2. Complete the setup wizard:
   - Discord OAuth credentials
   - Pterodactyl API connection
   - Admin account (Discord ID)
3. Login with Discord
4. Configure billing rates and packages in Admin Panel

## Updating

### Admin Panel (Easiest)
1. Go to **Admin → Settings**
2. Click **"Check for Updates"**
3. Click **"Install Update Now"**

### Command Line
```bash
cd /var/www/heliactyl
sudo bash update.sh
```

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS
- **Backend**: Express.js, TypeScript, Prisma ORM
- **Database**: SQLite (default), supports PostgreSQL/MySQL
- **Auth**: Discord OAuth2, JWT sessions

## Documentation

- **[Installation Guide](INSTALL.md)** - Detailed setup instructions
- **[Update Script](update.sh)** - Automated update from GitHub
- **Admin Panel** - Built-in documentation and settings

## Support

- **Issues**: [GitHub Issues](https://github.com/jasonzli-DEV/Heliactyl/issues)
- **Discussions**: Use GitHub Discussions for questions

## License

MIT License - © EnderBit Hosting 2025
