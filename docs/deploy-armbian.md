# CyberStore Deployment di Armbian + Auto Run Service

Panduan ini fokus ke Armbian (ARM64) dan termasuk `systemd` service agar server otomatis jalan setelah reboot.

## 1) Prasyarat

- Armbian 64-bit aktif
- MariaDB/MySQL aktif
- Domain (opsional, untuk Nginx + SSL)

## 2) Update sistem

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx build-essential
```

## 3) Install Node.js 20 LTS (ARM)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 4) Siapkan folder aplikasi

```bash
sudo mkdir -p /opt/cyberstore
sudo chown -R $USER:$USER /opt/cyberstore
cd /opt/cyberstore
git clone <REPO_URL> .
```

## 5) Buat file `.env`

```bash
cp .env.example .env
nano .env
```

Contoh untuk MariaDB lokal tanpa password root (sesuaikan dengan setup kamu):

```env
DATABASE_URL="mysql://root@127.0.0.1:3306/cyberstore"
NEXTAUTH_URL="https://cyberstore.domainkamu.com"
NEXTAUTH_SECRET="ganti-random-string-panjang"
BREVO_API_KEY="isi-api-key"
BREVO_SENDER_EMAIL="noreply@domainkamu.com"
TASKER_SECRET="ganti-tasker-secret"
TASKER_PROFILE_TOKEN="ganti-token-callback-tasker"
TRUST_PROXY="true"
BASE_QRIS_STRING="000201010211...ISI_BASE_QRIS_STATIS_MERCHANT..."
```

`BASE_QRIS_STRING` dipakai sebagai base QRIS merchant, lalu nominal unik transaksi di-inject otomatis saat checkout.

Sangat disarankan pakai user DB khusus production, bukan root.

## 6) Install dependency + Prisma + build

```bash
npm ci
npx prisma generate
npx prisma migrate deploy --schema prisma/schema.prisma
npm run build
```

Seed data (opsional):

```bash
npm run prisma:seed
```

## 7) Buat user service khusus

```bash
sudo useradd -r -s /usr/sbin/nologin cyberstore || true
sudo chown -R cyberstore:cyberstore /opt/cyberstore
```

## 8) Buat systemd service (AUTO RUN)

```bash
sudo nano /etc/systemd/system/cyberstore.service
```

Isi file:

```ini
[Unit]
Description=CyberStore Next.js Service
After=network.target mariadb.service mysql.service
Wants=network.target

[Service]
Type=simple
User=cyberstore
Group=cyberstore
WorkingDirectory=/opt/cyberstore
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/opt/cyberstore/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Aktifkan service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable cyberstore
sudo systemctl start cyberstore
sudo systemctl status cyberstore
```

## 9) Cek log service

```bash
sudo journalctl -u cyberstore -f
```

## 10) Nginx reverse proxy

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

Aktifkan:

```bash
sudo ln -s /etc/nginx/sites-available/cyberstore /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 11) SSL Let's Encrypt (opsional tapi direkomendasikan)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d cyberstore.domainkamu.com
```

## 12) Alur update release (aman)

```bash
cd /opt/cyberstore
git pull origin main
npm ci
npx prisma generate
npx prisma migrate deploy --schema prisma/schema.prisma
npm run build
sudo systemctl restart cyberstore
sudo systemctl status cyberstore
```

Jika kena error P3009/P3018:

```bash
chmod +x deploy/prisma-recover.sh
./deploy/prisma-recover.sh 20260320150100_parallel_collision_guard
```

Catatan: script ini bisa dijalankan dari direktori mana pun di dalam repo, karena path schema dihitung otomatis.

## 13) Validasi auto-run setelah reboot

```bash
sudo reboot
```

Setelah online lagi:

```bash
sudo systemctl status cyberstore
sudo systemctl is-enabled cyberstore
```

Jika status `active (running)` dan `enabled`, auto-run berhasil.

## 14) Bootstrap admin pertama

```bash
node -e "const {PrismaClient}=require('@prisma/client'); const {hashSync}=require('bcryptjs'); const prisma=new PrismaClient(); (async()=>{ const email='admin@cyberstore.local'; const password='Admin#12345'; const password_hash=hashSync(password,10); await prisma.user.upsert({ where:{email}, update:{ password_hash, role:'ADMIN', is_verified:true }, create:{ email, password_hash, role:'ADMIN', is_verified:true } }); await prisma.$disconnect(); })().catch(async(e)=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });"
```

## 15) Referensi fitur aplikasi

Lihat `docs/application.md` untuk detail fitur terbaru aplikasi.

Integrasi notifikasi DANA via Tasker: lihat `docs/tasker-dana-integration.md`.
