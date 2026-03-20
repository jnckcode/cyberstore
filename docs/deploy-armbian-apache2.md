# CyberStore Production Deploy (Armbian + Apache2)

Panduan ini untuk deploy CyberStore di Armbian dengan Apache2 sebagai reverse proxy dan systemd untuk auto-run server Next.js.

## 1. Persiapan server

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl apache2 build-essential
```

## 2. Install Node.js 20 LTS (ARM64)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 3. Clone aplikasi

```bash
sudo mkdir -p /opt/cyberstore
sudo chown -R $USER:$USER /opt/cyberstore
cd /opt/cyberstore
git clone <REPO_URL> .
```

## 4. Konfigurasi environment production

```bash
cp .env.example .env
nano .env
```

Contoh `.env`:

```env
DATABASE_URL="mysql://root@127.0.0.1:3306/cyberstore"
NEXTAUTH_URL="https://cyberstore.domainkamu.com"
NEXTAUTH_SECRET="ganti-dengan-random-string-panjang"
BREVO_API_KEY="isi-api-key"
BREVO_SENDER_EMAIL="noreply@domainkamu.com"
TASKER_SECRET="ganti-tasker-secret"
TRUST_PROXY="true"
```

## 5. Install dependency + migrate + build

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

Opsional seed data awal:

```bash
npm run prisma:seed
```

## 6. Buat user service

```bash
sudo useradd -r -s /usr/sbin/nologin cyberstore || true
sudo chown -R cyberstore:cyberstore /opt/cyberstore
```

## 7. Systemd service auto-run

Pakai file yang sudah ada di repo: `deploy/cyberstore.service`

```bash
sudo cp /opt/cyberstore/deploy/cyberstore.service /etc/systemd/system/cyberstore.service
sudo systemctl daemon-reload
sudo systemctl enable cyberstore
sudo systemctl start cyberstore
sudo systemctl status cyberstore
```

Pastikan aplikasi listen di `127.0.0.1:3000`.

## 8. Aktifkan modul Apache2 yang dibutuhkan

```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod headers
sudo a2enmod rewrite
sudo systemctl restart apache2
```

## 9. Konfigurasi VirtualHost Apache2

Pakai template repo: `deploy/apache2-cyberstore.conf`

```bash
sudo cp /opt/cyberstore/deploy/apache2-cyberstore.conf /etc/apache2/sites-available/cyberstore.conf
sudo nano /etc/apache2/sites-available/cyberstore.conf
```

Ganti `ServerName` sesuai domain kamu.

Aktifkan site:

```bash
sudo a2dissite 000-default.conf
sudo a2ensite cyberstore.conf
sudo apache2ctl configtest
sudo systemctl reload apache2
```

## 10. SSL Let's Encrypt (direkomendasikan)

```bash
sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d cyberstore.domainkamu.com
```

Setelah cert aktif, cek bahwa redirect HTTP -> HTTPS sudah berjalan.

## 11. Update release

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

## 12. Monitoring dan troubleshooting

Log app:

```bash
sudo journalctl -u cyberstore -f
```

Log Apache:

```bash
sudo tail -f /var/log/apache2/cyberstore-error.log
sudo tail -f /var/log/apache2/cyberstore-access.log
```

## 13. Uji auto-run setelah reboot

```bash
sudo reboot
```

Setelah online:

```bash
sudo systemctl status cyberstore
sudo systemctl is-enabled cyberstore
sudo systemctl status apache2
```

Jika `active (running)` dan `enabled`, deploy production siap pakai.
