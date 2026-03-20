# CyberStore Production Deploy (Armbian + Apache2 + Auto Service)

Panduan ini adalah jalur cepat deploy production CyberStore di Armbian, reverse proxy Apache2, dan auto-run lewat systemd.

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
TRUST_PROXY="true"
```

## 5. Install app + migrate + build

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
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
npx prisma migrate deploy
npm run build
sudo systemctl restart cyberstore
sudo systemctl reload apache2
```

## 12. Monitoring cepat

```bash
sudo journalctl -u cyberstore -f
sudo tail -f /var/log/apache2/cyberstore-error.log
sudo tail -f /var/log/apache2/cyberstore-access.log
```

## 13. Referensi fitur aplikasi

Lihat `docs/application.md` untuk endpoint terbaru dan daftar fitur user/admin.
