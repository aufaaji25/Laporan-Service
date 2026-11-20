// ==============================================================
// MYSQL DATABASE CONNECTOR & ORM
// Mendukung MySQL 5.7+, 8.0+, MariaDB 10.3+
// Otomatis migrate table, auto-seed data jika kosong, & auto-fallback
// ==============================================================

const fs = require('fs');
const path = require('path');

let mysql = null;
try {
  mysql = require('mysql2/promise');
} catch (e) {
  console.warn('⚠️ Modul mysql2 belum tersedia. Pastikan menjalankan "npm install mysql2".');
}

// Baca konfigurasi dari config.json atau Environment Variables
function getDbConfig() {
  const configPath = path.join(__dirname, 'config.json');
  let fileConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      console.error('Gagal membaca config.json:', e.message);
    }
  }

  return {
    host: process.env.DB_HOST || fileConfig.host || 'localhost',
    user: process.env.DB_USER || fileConfig.user || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (fileConfig.password !== undefined ? fileConfig.password : ''),
    database: process.env.DB_NAME || fileConfig.database || 'laporan_service_db',
    port: parseInt(process.env.DB_PORT || fileConfig.port || 3306, 10),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
  };
}

let pool = null;
let isConnected = false;

// Inisialisasi pool dan database
async function initDatabase(initialJsonData = null) {
  if (!mysql) return false;

  const config = getDbConfig();

  // 1. Coba koneksi ke server MySQL
  try {
    // Buat database jika belum ada
    const tempConn = await mysql.createConnection({
      host: config.host,
      user: config.user,
      password: config.password,
      port: config.port
    });

    await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await tempConn.end();

    // Buat pool utama dengan database terpilih
    pool = mysql.createPool(config);

    // 2. Buat tabel-tabel jika belum ada
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` BIGINT NOT NULL,
        \`username\` VARCHAR(100) NOT NULL UNIQUE,
        \`password\` VARCHAR(255) NOT NULL,
        \`nama\` VARCHAR(255) NOT NULL,
        \`role\` VARCHAR(100) NOT NULL DEFAULT 'Admin',
        \`avatar\` LONGTEXT NULL,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`jenis_alat\` (
        \`id\` BIGINT NOT NULL,
        \`nama\` VARCHAR(255) NOT NULL,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`kategori_lokasi\` (
        \`id\` BIGINT NOT NULL,
        \`nama\` VARCHAR(255) NOT NULL,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`laporan\` (
        \`id\` BIGINT NOT NULL,
        \`no\` VARCHAR(50) DEFAULT '',
        \`tanggalMasuk\` VARCHAR(50) DEFAULT '',
        \`tanggalKeluar\` VARCHAR(50) DEFAULT '',
        \`jumlahAlat\` INT DEFAULT 1,
        \`keteranganPerbaikan\` TEXT,
        \`jenisAlatId\` BIGINT DEFAULT NULL,
        \`jenisAlatNama\` VARCHAR(255) DEFAULT '',
        \`lokasiDari\` VARCHAR(255) DEFAULT '',
        \`kondisi\` VARCHAR(50) DEFAULT 'Lama',
        \`lamaHari\` INT DEFAULT 0,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_tgl_masuk\` (\`tanggalMasuk\`),
        INDEX \`idx_lokasi\` (\`lokasiDari\`),
        INDEX \`idx_jenis\` (\`jenisAlatNama\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Cek apakah tabel kosong, jika ya migrasikan data awal dari JSON
    const [userRows] = await pool.query('SELECT COUNT(*) as cnt FROM users');
    if (userRows[0].cnt === 0 && initialJsonData) {
      console.log('📦 Memigrasikan data awal dari JSON ke database MySQL...');
      await saveDataToDb(initialJsonData);
      console.log('✓ Migrasi data awal ke MySQL berhasil!');
    }

    isConnected = true;
    console.log(`✓ Terhubung ke database MySQL: [${config.database}] di ${config.host}:${config.port}`);
    return true;
  } catch (err) {
    console.warn(`⚠️ Gagal menghubungkan ke MySQL (${err.message}). Menggunakan penyimpanan file JSON.`);
    isConnected = false;
    pool = null;
    return false;
  }
}

// Ambil seluruh data dari MySQL
async function getDataFromDb() {
  if (!isConnected || !pool) return null;

  try {
    const [users] = await pool.query('SELECT id, username, password, nama, role, avatar FROM users ORDER BY id ASC');
    const [jenisAlat] = await pool.query('SELECT id, nama FROM jenis_alat ORDER BY nama ASC');
    const [kategoriLokasi] = await pool.query('SELECT id, nama FROM kategori_lokasi ORDER BY nama ASC');
    const [laporan] = await pool.query('SELECT id, no, tanggalMasuk, tanggalKeluar, jumlahAlat, keteranganPerbaikan, jenisAlatId, jenisAlatNama, lokasiDari, kondisi, lamaHari FROM laporan ORDER BY id ASC');

    return {
      users: users || [],
      jenisAlat: jenisAlat || [],
      kategoriLokasi: kategoriLokasi || [],
      laporan: laporan || []
    };
  } catch (err) {
    console.error('Error saat mengambil data dari MySQL:', err.message);
    return null;
  }
}

// Simpan data ke MySQL menggunakan transaksi
async function saveDataToDb(data) {
  if (!isConnected || !pool) return false;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Simpan Users
    if (Array.isArray(data.users) && data.users.length > 0) {
      await conn.query('DELETE FROM users');
      for (const u of data.users) {
        await conn.query(
          'INSERT INTO users (id, username, password, nama, role, avatar) VALUES (?, ?, ?, ?, ?, ?)',
          [u.id || 1, u.username || 'admin', u.password || '', u.nama || '', u.role || 'Admin', u.avatar || null]
        );
      }
    }

    // 2. Simpan Jenis Alat
    if (Array.isArray(data.jenisAlat)) {
      await conn.query('DELETE FROM jenis_alat');
      const seenIds = new Set();
      let nextId = Date.now();
      for (const j of data.jenisAlat) {
        let jid = parseInt(j.id, 10);
        if (!jid || seenIds.has(jid)) {
          jid = ++nextId;
        }
        seenIds.add(jid);
        j.id = jid;
        await conn.query('INSERT INTO jenis_alat (id, nama) VALUES (?, ?)', [jid, j.nama || '']);
      }
    }

    // 3. Simpan Kategori Lokasi
    if (Array.isArray(data.kategoriLokasi)) {
      await conn.query('DELETE FROM kategori_lokasi');
      const seenIds = new Set();
      let nextId = Date.now();
      for (const k of data.kategoriLokasi) {
        let kid = parseInt(k.id, 10);
        if (!kid || seenIds.has(kid)) {
          kid = ++nextId;
        }
        seenIds.add(kid);
        k.id = kid;
        await conn.query('INSERT INTO kategori_lokasi (id, nama) VALUES (?, ?)', [kid, k.nama || '']);
      }
    }

    // 4. Simpan Laporan
    if (Array.isArray(data.laporan)) {
      await conn.query('DELETE FROM laporan');
      const seenIds = new Set();
      let nextId = Date.now();
      for (const l of data.laporan) {
        let lid = parseInt(l.id, 10);
        if (!lid || seenIds.has(lid)) {
          lid = ++nextId;
        }
        seenIds.add(lid);
        l.id = lid;
        await conn.query(
          `INSERT INTO laporan 
          (id, no, tanggalMasuk, tanggalKeluar, jumlahAlat, keteranganPerbaikan, jenisAlatId, jenisAlatNama, lokasiDari, kondisi, lamaHari)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            lid,
            l.no || '',
            l.tanggalMasuk || '',
            l.tanggalKeluar || '',
            parseInt(l.jumlahAlat, 10) || 1,
            l.keteranganPerbaikan || '',
            l.jenisAlatId || null,
            l.jenisAlatNama || '',
            l.lokasiDari || '',
            l.kondisi || 'Lama',
            parseInt(l.lamaHari, 10) || 0
          ]
        );
      }
    }

    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    console.error('Error saat menyimpan ke MySQL:', err.message);
    return false;
  } finally {
    conn.release();
  }
}

function getDatabaseStatus() {
  const config = getDbConfig();
  return {
    engine: isConnected ? 'mysql' : 'json',
    connected: isConnected,
    host: config.host,
    port: config.port,
    database: config.database
  };
}

module.exports = {
  initDatabase,
  getDataFromDb,
  saveDataToDb,
  getDatabaseStatus,
  getDbConfig
};
