# CyberStore Production Deploy (Armbian + Apache2 + Auto Service)

Panduan ini adalah jalur cepat deploy production CyberStore di Armbian, reverse proxy Apache2, dan auto-run lewat systemd.

## Opsi tercepat (script interaktif)

Gunakan script interaktif universal:

```bash
chmod +x deploy/universal-deploy.sh
./deploy/universal-deploy.sh
```

Script akan menanyakan domain, port Apache, kredensial MySQL, nilai `.env`, setup service systemd, dan konfigurasi Apache2 otomatis.

Catatan mode source:
- Jika dijalankan dari folder hasil clone, pilih `current` agar tidak diminta URL repo dan install path lagi.
- Jika ingin deploy ke path baru dari repo lain, pilih `clone`.

Catatan mode network:
- Pilih `cloudflared` jika domain dikelola Cloudflare Tunnel (tanpa SSL/domain termination langsung di server).
- Mode `cloudflared` menyediakan:
  - `origin app` -> tunnel pointing langsung ke `http://localhost:<APP_PORT>` (Apache dilewati)
  - `origin apache` -> tunnel pointing ke `http://localhost:<APACHE_HTTP_PORT>` (pakai vhost Apache lokal)
- Pada mode `cloudflared`, script tidak akan men-disable `000-default.conf` otomatis (aman untuk skenario multi-subdomain/vhost).
- Pada mode `cloudflared`, certbot otomatis di-skip.

Catatan mode database:
- Pilih `existing` jika user/password/database MySQL sudah kamu siapkan sendiri (script tidak buat user/profile baru).
- Pilih `provision` jika kamu ingin script membuat database + app user otomatis.

## 0. Checklist sebelum mulai

- Domain sudah pointing ke IP server
- Akses SSH + sudo
- MariaDB/MySQL tersedia
- Port 80/443 terbuka

## 1. Install dependency server

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl apache2 build-essential
```

Install Node.js 20 LTS:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 2. Clone project

```bash
sudo mkdir -p /opt/cyberstore
sudo chown -R $USER:$USER /opt/cyberstore
cd /opt/cyberstore
git clone <REPO_URL> .
```

## 3. Siapkan database production

Masuk MariaDB/MySQL lalu buat database + user khusus app:

```sql
CREATE DATABASE IF NOT EXISTS cyberstore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'cyberstore_user'@'localhost' IDENTIFIED BY 'ganti_password_kuat';
GRANT ALL PRIVILEGES ON cyberstore.* TO 'cyberstore_user'@'localhost';
FLUSH PRIVILEGES;
```

## 4. Buat `.env` production

```bash
cp .env.example .env
nano .env
```

Contoh minimal:

```env
DATABASE_URL="mysql://cyberstore_user:ganti_password_kuat@127.0.0.1:3306/cyberstore"
NEXTAUTH_URL="https://cyberstore.domainkamu.com"
NEXTAUTH_SECRET="ganti-dengan-random-string-panjang"
BREVO_API_KEY="isi-api-key"
BREVO_SENDER_EMAIL="noreply@domainkamu.com"
TASKER_SECRET="ganti-tasker-secret"
TASKER_PROFILE_TOKEN="ganti-token-callback-tasker"
TRUST_PROXY="true"
BASE_QRIS_STRING="000201010211...ISI_BASE_QRIS_STATIS_MERCHANT..."
```

Catatan: `BASE_QRIS_STRING` adalah base payload QRIS merchant. Sistem akan inject nominal unik (`total_price`) ke payload QRIS setiap transaksi, jadi QR final tiap user berbeda.

## 5. Install app + migrate + build

```bash
npm ci
npx prisma generate
npx prisma migrate deploy --schema prisma/schema.prisma
npm run build
```

Opsional isi data awal:

```bash
npm run prisma:seed
```

## 6. Buat user service + pasang systemd

```bash
sudo useradd -r -s /usr/sbin/nologin cyberstore || true
sudo chown -R cyberstore:cyberstore /opt/cyberstore
sudo cp /opt/cyberstore/deploy/cyberstore.service /etc/systemd/system/cyberstore.service
sudo systemctl daemon-reload
sudo systemctl enable cyberstore
sudo systemctl start cyberstore
sudo systemctl status cyberstore
```

Validasi app listen di local port 3000:

```bash
ss -tulpn | grep 3000
```

## 7. Konfigurasi Apache2 reverse proxy

Aktifkan modul:

```bash
sudo a2enmod proxy proxy_http headers rewrite ssl
```

Pasang VirtualHost dari template:

```bash
sudo cp /opt/cyberstore/deploy/apache2-cyberstore.conf /etc/apache2/sites-available/cyberstore.conf
sudo nano /etc/apache2/sites-available/cyberstore.conf
```

Ubah `ServerName` jadi domain kamu.

Aktifkan site:

```bash
sudo a2dissite 000-default.conf
sudo a2ensite cyberstore.conf
sudo apache2ctl configtest
sudo systemctl restart apache2
```

## 8. SSL Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d cyberstore.domainkamu.com
```

## 9. Bootstrap admin pertama

```bash
node -e "const {PrismaClient}=require('@prisma/client'); const {hashSync}=require('bcryptjs'); const prisma=new PrismaClient(); (async()=>{ const email='admin@cyberstore.local'; const password='Admin#12345'; const password_hash=hashSync(password,10); await prisma.user.upsert({ where:{email}, update:{ password_hash, role:'ADMIN', is_verified:true }, create:{ email, password_hash, role:'ADMIN', is_verified:true } }); await prisma.$disconnect(); })().catch(async(e)=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });"
```

Setelah login pertama, segera ganti password admin.

## 10. Test auto-run setelah reboot

```bash
sudo reboot
```

Setelah server online lagi:

```bash
sudo systemctl is-enabled cyberstore
sudo systemctl status cyberstore
sudo systemctl status apache2
```

Kalau `enabled` dan `active (running)`, production auto-run sukses.

## 11. Update release (rolling manual)

```bash
cd /opt/cyberstore
git pull origin main
npm ci
npx prisma generate
npx prisma migrate deploy --schema prisma/schema.prisma
npm run build
sudo systemctl restart cyberstore
sudo systemctl reload apache2
```

Jika kena error P3009/P3018:

```bash
chmod +x deploy/prisma-recover.sh
./deploy/prisma-recover.sh 20260320150100_parallel_collision_guard
```

Untuk kasus migration gagal sebagian, script akan repair state untuk migration tersebut lalu resolve + deploy ulang.

## 12. Monitoring cepat

```bash
sudo journalctl -u cyberstore -f
sudo tail -f /var/log/apache2/cyberstore-error.log
sudo tail -f /var/log/apache2/cyberstore-access.log
```

## 13. Referensi fitur aplikasi

Lihat `docs/application.md` untuk endpoint terbaru dan daftar fitur user/admin.

Integrasi notifikasi DANA via Tasker: lihat `docs/tasker-dana-integration.md`.
