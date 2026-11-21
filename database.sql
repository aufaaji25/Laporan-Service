-- ==============================================================
-- DATABASE SCHEMA: Laporan Service Sistem Android
-- Cocok untuk MySQL 5.7+, MySQL 8.0+, dan MariaDB 10.3+
-- ==============================================================

CREATE DATABASE IF NOT EXISTS `laporan_service_db` 
DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `laporan_service_db`;

-- 1. Tabel Users (Pengguna Sistem & Edit Profil)
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `nama` VARCHAR(255) NOT NULL,
  `role` VARCHAR(100) NOT NULL DEFAULT 'Admin',
  `avatar` LONGTEXT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabel Kategori Jenis Alat
CREATE TABLE IF NOT EXISTS `jenis_alat` (
  `id` BIGINT NOT NULL,
  `nama` VARCHAR(255) NOT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel Kategori Lokasi
CREATE TABLE IF NOT EXISTS `kategori_lokasi` (
  `id` BIGINT NOT NULL,
  `nama` VARCHAR(255) NOT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabel Data Laporan Service
CREATE TABLE IF NOT EXISTS `laporan` (
  `id` BIGINT NOT NULL,
  `no` VARCHAR(50) DEFAULT '',
  `tanggalMasuk` VARCHAR(50) DEFAULT '',
  `tanggalKeluar` VARCHAR(50) DEFAULT '',
  `jumlahAlat` INT DEFAULT 1,
  `keteranganPerbaikan` TEXT,
  `jenisAlatId` BIGINT DEFAULT NULL,
  `jenisAlatNama` VARCHAR(255) DEFAULT '',
  `lokasiDari` VARCHAR(255) DEFAULT '',
  `kondisi` VARCHAR(50) DEFAULT 'Lama',
  `lamaHari` INT DEFAULT 0,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_tgl_masuk` (`tanggalMasuk`),
  INDEX `idx_lokasi` (`lokasiDari`),
  INDEX `idx_jenis` (`jenisAlatNama`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Data Default Pengguna (User: user / Password: user123)
INSERT INTO `users` (`id`, `username`, `password`, `nama`, `role`) 
VALUES (1, 'user', 'user123', 'User', 'Admin')
ON DUPLICATE KEY UPDATE `username`='user', `password`='user123';

