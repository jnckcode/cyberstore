# CyberStore Deployment Guide (Production)

Panduan ini untuk deploy `CyberStore` (Next.js + Prisma + MariaDB/MySQL) ke Linux server.

## 1) Prasyarat

- Domain sudah mengarah ke server (A record)
- OS Linux (Ubuntu/Debian)
- User non-root dengan sudo
- Port `80` dan `443` terbuka

## 2) Install dependency sistem

```bash
sudo apt update
sudo apt install -y git curl nginx
```

Install Node.js 20 LTS:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 3) Clone project

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone <REPO_URL> cyberstore
cd cyberstore
```

## 4) Setup environment production

Buat file `.env`:

```bash
cp .env.example .env
nano .env
```

Contoh nilai wajib:

```env
DATABASE_URL="mysql://dbuser:dbpassword@127.0.0.1:3306/cyberstore"
NEXTAUTH_URL="https://cyberstore.domainkamu.com"
NEXTAUTH_SECRET="ganti-dengan-random-string-panjang"
BREVO_API_KEY="isi-api-key"
BREVO_SENDER_EMAIL="noreply@domainkamu.com"
TASKER_SECRET="ganti-dengan-secret-webhook"
```

## 5) Install package + generate prisma

```bash
npm ci
npx prisma generate
```

## 6) Migrate database + seed (opsional)

```bash
npx prisma migrate deploy
npm run prisma:seed
```

Jika seed tidak dibutuhkan di production, skip langkah seed.

## 7) Build aplikasi

```bash
npm run build
```

## 8) Jalankan aplikasi (test manual)

```bash
npm run start
```

Default jalan di port `3000`.

## 9) Reverse proxy Nginx

Buat file konfigurasi:

```bash
sudo nano /etc/nginx/sites-available/cyberstore
```

Isi:

```nginx
server {
    listen 80;
    server_name cyberstore.domainkamu.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktifkan site:

```bash
sudo ln -s /etc/nginx/sites-available/cyberstore /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 10) SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d cyberstore.domainkamu.com
```

## 11) Menjalankan app otomatis saat boot

Gunakan panduan systemd lengkap di `docs/deploy-armbian.md` (konfigurasi service berlaku umum Linux juga).

## 12) Update rilis

```bash
cd /var/www/cyberstore
git pull origin main
npm ci
npx prisma migrate deploy
npm run build
sudo systemctl restart cyberstore
sudo systemctl status cyberstore
```

## 13) Troubleshooting cepat

- Cek log service:

```bash
sudo journalctl -u cyberstore -f
```

- Cek status Nginx:

```bash
sudo systemctl status nginx
```

- Cek koneksi DB dari Prisma:

```bash
npx prisma migrate status
```
