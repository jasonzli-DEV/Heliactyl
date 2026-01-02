# Enderactyl

Modern game server dashboard for Pterodactyl Panel with prepaid hourly billing.

## Quick Deploy

```bash
curl -sSL https://raw.githubusercontent.com/jasonzli-DEV/Enderactyl/main/deploy.sh | sudo bash
```

This will install everything automatically.

## Features

- Prepaid Hourly Billing (RAM/CPU/Disk)
- Discord OAuth Authentication
- Admin Dashboard
- Store & Coupons
- One-Click Updates
- Maintenance Mode
- Footer Customization

## Documentation

See [INSTALL.md](INSTALL.md) for detailed installation instructions.

## Management

```bash
# Service control
sudo systemctl status enderactyl
sudo systemctl restart enderactyl
sudo journalctl -u enderactyl -f

# Update
cd /var/www/enderactyl
sudo bash update.sh
```

## Support

- GitHub: https://github.com/jasonzli-DEV/Enderactyl

## License

MIT © EnderBit Hosting 2026
