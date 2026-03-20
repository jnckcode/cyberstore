# Tasker DANA Notification Integration

Dokumen ini menjelaskan cara membuat profile Tasker yang menangkap notifikasi DANA lalu mengirim callback ke CyberStore.

## 1) Tujuan

- Trigger dari notifikasi DANA, contoh template:

```text
Pembayaran Masuk

Rp245 dari DANA berhasil diterima DANA Bisnis.
```

- Kirim callback ke endpoint:

`POST /api/webhook/tasker/dana`

- Backend akan parsing nominal dari pesan, validasi signature + timestamp, lalu verifikasi transaksi pending berdasarkan nominal unik.

## 2) Payload callback Tasker

Tasker kirim JSON minimal berikut:

```json
{
  "message": "Pembayaran Masuk\n\nRp245 dari DANA berhasil diterima DANA Bisnis.",
  "timestamp": 1742492426000
}
```

Header yang wajib dikirim (mode paling mudah):

```text
x-tasker-token: <TASKER_PROFILE_TOKEN>
```

Opsional (mode signature manual):

- Tambahkan field `signature` di body.
- Aturan signature:

```text
signature = SHA256(String(nominal) + String(timestamp) + TASKER_SECRET)
```

`nominal` diambil backend dari parsing `message` (angka setelah `Rp`).

## 3) Langkah profile Tasker (ringkas)

1. Buat Profile -> Event -> Notification (Notifikasi DANA Bisnis).
2. Filter judul notifikasi berisi `Pembayaran Masuk`.
3. Ambil teks notifikasi penuh sebagai `message`.
4. Parse nominal dari `message` (mis. regex `Rp([\d.,]+)`).
5. Set `timestamp` = epoch ms saat trigger.
6. Set header `x-tasker-token` = token kamu.
7. HTTP Request (POST, JSON) ke:
   - `https://<domain-kamu>/api/webhook/tasker/dana`
8. Pastikan response `200` untuk pembayaran valid.

## 4) Endpoint terkait

- DANA direct webhook: `POST /api/webhook/dana`
- Tasker DANA notification callback: `POST /api/webhook/tasker/dana`

Keduanya masuk ke verifikasi backend yang sama agar assignment stok dan status transaksi konsisten.

## 5) Validasi hasil

- Cek log webhook admin di `/admin/webhooks`.
- Status transaksi harus berubah `PENDING -> PAID` jika nominal cocok.
- Dashboard user harus menampilkan item digital setelah status `PAID`.
