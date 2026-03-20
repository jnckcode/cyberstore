# CyberStore Application Documentation

Dokumen ini menjelaskan status fitur terbaru CyberStore setelah implementasi fase store, security hardening, dan admin dashboard full.

## 1) Arsitektur Singkat

- Framework: Next.js App Router
- UI: TailwindCSS + komponen gaya Shadcn
- Auth: NextAuth Credentials
- ORM/DB: Prisma + MariaDB/MySQL
- Payment callback: Webhook DANA (signature + anti-replay)

## 2) Role dan Akses

- `USER`: akses storefront, checkout, dashboard user
- `ADMIN`: semua akses user + modul admin di `/admin/*`

## 3) Fitur User

### Storefront

- Halaman estalase produk: `/`
- Tombol checkout aktif jika session login tersedia

### Checkout + Status Pembayaran

- Buat transaksi: `POST /api/checkout`
- Halaman QRIS statis: `/checkout/[transactionId]`
- Polling status: `GET /api/transactions/[id]/status`

### Dashboard User (v2)

- Halaman: `/dashboard`
- Fitur:
  - Filter status (`PENDING/PAID/EXPIRED`)
  - Filter rentang tanggal (`from`/`to`)
  - KPI user: total transaksi, paid, pending, total spend
  - Riwayat transaksi + link detail
- Detail transaksi: `/dashboard/transactions/[id]`
  - Ownership check (hanya pemilik transaksi)
  - Menampilkan item digital
  - Tombol copy item digital

## 4) Fitur Admin (Full)

### Admin Navigation

- Layout admin: `/admin/*` (guard role `ADMIN`)
- Menu:
  - `/admin/dashboard`
  - `/admin/products`
  - `/admin/stocks`
  - `/admin/transactions`
  - `/admin/users`
  - `/admin/webhooks`
  - `/admin/audits`

### Modul Admin

- Overview (`/admin/dashboard`)
  - total user
  - total produk
  - ready stock
  - transaksi pending/paid
  - 20 transaksi terbaru
- Products (`/admin/products`)
  - create produk
  - activate/deactivate produk
- Stocks (`/admin/stocks`)
  - bulk add stock item
  - lihat stock + owner + status
- Transactions (`/admin/transactions`)
  - filter status/email
  - update status transaksi
- Users (`/admin/users`)
  - ubah role USER/ADMIN
  - toggle verifikasi user
- Webhooks (`/admin/webhooks`)
  - monitor log webhook pembayaran
- Audits (`/admin/audits`)
  - monitor jejak aksi admin

## 5) Security Hardening

### OTP Anti-Abuse

- OTP 6 digit via Brevo
- Cooldown resend OTP
- Limit request OTP per email/IP per jam
- Generic response untuk email tidak terdaftar (anti-enumeration)
- Limit request register, verify-otp, login

### Auth Hardening

- Login credentials menolak user belum terverifikasi (`is_verified=false`)
- Rate-limiting in-memory untuk endpoint sensitif

### Webhook Hardening

- Signature validation: `SHA256(String(nominal) + String(timestamp) + TASKER_SECRET)`
- Timestamp tolerance 2 menit
- Persistent replay guard (`WebhookReplayGuard`)
- Event logging (`WebhookEventLog`) untuk monitoring/admin

### Platform Security

- Security headers di middleware (CSP, HSTS, X-Frame-Options, dll)
- `TRUST_PROXY=true` saat deploy di belakang Apache/Nginx

## 6) API Endpoint Matrix

### Auth/Public

- `POST /api/auth/[...nextauth]`
- `POST /api/auth/register`
- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`

### User Flow

- `POST /api/checkout`
- `GET /api/transactions/[id]/status`
- `POST /api/webhook/dana`

### Admin API (ADMIN only)

- Products
  - `GET /api/admin/products`
  - `POST /api/admin/products`
  - `PATCH /api/admin/products/[id]`
  - `DELETE /api/admin/products/[id]`
- Stocks
  - `GET /api/admin/stocks`
  - `POST /api/admin/stocks`
  - `PATCH /api/admin/stocks/[id]`
  - `DELETE /api/admin/stocks/[id]`
- Transactions
  - `GET /api/admin/transactions`
  - `PATCH /api/admin/transactions/[id]`
- Users
  - `GET /api/admin/users`
  - `PATCH /api/admin/users/[id]`
- Monitoring
  - `GET /api/admin/webhooks`
  - `GET /api/admin/audits`

## 7) Database Model Tambahan (Security + Admin)

- `EmailOtp`
- `OtpRequestLog`
- `WebhookReplayGuard`
- `WebhookEventLog`
- `AdminAuditLog`

## 8) Catatan Operasional

- Jalankan migrasi sebelum start production:

```bash
npx prisma migrate deploy
```

- Jika butuh admin awal, buat user admin manual lalu set:
  - `role = ADMIN`
  - `is_verified = true`
