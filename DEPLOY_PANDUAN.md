# 📦 Panduan Deploy Laporan Service Web

## Persyaratan Server
- **Node.js** v16+ (https://nodejs.org)
- **MySQL** 5.7+ atau MariaDB 10.3+ (atau XAMPP)
- **npm** (sudah termasuk dengan Node.js)

---

## 1. Setup Database MySQL

### Di XAMPP / MySQL Lokal
```sql
CREATE DATABASE laporan_service_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
Kemudian jalankan file `database.sql` untuk membuat tabel:
```bash
mysql -u root laporan_service_db < database.sql
```

### Di VPS / Server Remote
```sql
CREATE USER 'laporan_user'@'%' IDENTIFIED BY 'password_anda';
CREATE DATABASE laporan_service_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON laporan_service_db.* TO 'laporan_user'@'%';
FLUSH PRIVILEGES;
```

---

## 2. Konfigurasi Koneksi Database

Edit file `config.json`:
```json
{
  "host": "localhost",
  "user": "root",
  "password": "",
  "database": "laporan_service_db",
  "port": 3306
}
```

**Atau gunakan environment variables** (untuk VPS/PM2/cloud):
```bash
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password_anda
DB_NAME=laporan_service_db
DB_PORT=3306
PORT=3000
```

---

## 3. Instalasi & Menjalankan

```bash
# Install dependencies
npm install

# Jalankan server
node server.js

# Atau gunakan PM2 (agar berjalan terus di background)
npm install -g pm2
pm2 start server.js --name laporan-service
pm2 save
pm2 startup
```

---

## 4. Akses Aplikasi

- **Lokal**: http://localhost:3000
- **Jaringan LAN**: http://[IP-SERVER]:3000
- **Online (VPS)**: http://[IP-VPS]:3000

---

## 5. Login Default
- **Username**: aufaaji25
- **Password**: *Muff@ind0Komunikasi

---

## 6. Fitur Utama
- ✅ Database MySQL (data tidak hilang, bisa akses multi-device)
- ✅ Fallback otomatis ke JSON jika MySQL tidak tersedia
- ✅ Import/Export Data Laporan (Excel .xlsx)
- ✅ Import/Export Kategori Lokasi (Excel)
- ✅ Indikator status database di topbar

---

## 7. Struktur File
```
LaporanService-Web/
├── server.js          # Server utama (Node.js + Express)
├── db.js              # Koneksi dan operasi MySQL
├── config.json        # Konfigurasi database
├── database.sql       # Schema tabel MySQL
├── package.json       # Dependencies npm
├── web/               # File frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── exceljs.min.js
└── data/              # Backup JSON (otomatis)
    └── laporan-service.json
```
