-- ==========================================================
-- DATABASE SCHEMA: concert_ticket_db
-- Ticketing Konser Musik Platform (UKK)
-- ==========================================================

CREATE DATABASE IF NOT EXISTS `concert_ticket_db`;
USE `concert_ticket_db`;

-- 1. Table users
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `role` ENUM('customer', 'event_organizer', 'super_admin') NOT NULL DEFAULT 'customer',
  `profile_picture` TEXT DEFAULT NULL,
  `refresh_token` TEXT DEFAULT NULL,
  `is_verified` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Table categories
CREATE TABLE IF NOT EXISTS `categories` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `icon` VARCHAR(50) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table events
CREATE TABLE IF NOT EXISTS `events` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `organizer_id` VARCHAR(50) NOT NULL,
  `category_id` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `venue` VARCHAR(255) NOT NULL,
  `location` TEXT NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `date` DATE NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `poster_url` TEXT DEFAULT NULL,
  `banner_url` TEXT DEFAULT NULL,
  `terms_conditions` TEXT DEFAULT NULL,
  `refund_policy` TEXT DEFAULT NULL,
  `status` ENUM('draft', 'published', 'cancelled', 'completed') DEFAULT 'draft',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`organizer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE
);

-- 4. Table tickets
CREATE TABLE IF NOT EXISTS `tickets` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `event_id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `price` DECIMAL(12,2) NOT NULL,
  `quantity` INT NOT NULL,
  `sold` INT NOT NULL DEFAULT 0,
  `max_per_order` INT NOT NULL DEFAULT 10,
  `benefits` JSON DEFAULT NULL,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE
);

-- 5. Table transactions
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(50) NOT NULL,
  `event_id` VARCHAR(50) NOT NULL,
  `ticket_id` VARCHAR(50) NOT NULL,
  `booking_code` VARCHAR(100) NOT NULL UNIQUE,
  `quantity` INT NOT NULL,
  `total_price` DECIMAL(12,2) NOT NULL,
  `payment_method` VARCHAR(50) DEFAULT NULL,
  `status` ENUM('pending', 'paid', 'cancelled', 'expired') DEFAULT 'pending',
  `paid_at` TIMESTAMP NULL DEFAULT NULL,
  `expired_at` TIMESTAMP NOT NULL,
  `ticket_qr_code` LONGTEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE CASCADE
);

-- 6. Table payments
CREATE TABLE IF NOT EXISTS `payments` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `transaction_id` VARCHAR(50) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `payment_method` VARCHAR(50) NOT NULL,
  `payment_status` ENUM('pending', 'success', 'failed') DEFAULT 'pending',
  `payment_gateway` VARCHAR(50) DEFAULT 'midtrans',
  `gateway_transaction_id` VARCHAR(100) NOT NULL,
  `payment_response` JSON DEFAULT NULL,
  `paid_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE
);

-- ==========================================================
-- DUMMY / INITIAL SEED DATA
-- Default password untuk semua akun: "password123"
-- ==========================================================

-- Default Users
INSERT INTO `users` (`id`, `email`, `password`, `name`, `phone`, `role`, `is_verified`) VALUES
('usr-admin-01', 'admin@ticketo.id', '$2b$10$7R4/lDrs2FUI3OtI6fA38.iKqkjyWJ.ByzbHdKdjAVmP7Yvsn7Q4G', 'Super Admin TICKETO', '081200000001', 'super_admin', TRUE),
('usr-organizer-01', 'organizer@soundfest.id', '$2b$10$7R4/lDrs2FUI3OtI6fA38.iKqkjyWJ.ByzbHdKdjAVmP7Yvsn7Q4G', 'Soundfest Live Entertainment', '081200000002', 'event_organizer', TRUE),
('usr-customer-01', 'customer@gmail.com', '$2b$10$7R4/lDrs2FUI3OtI6fA38.iKqkjyWJ.ByzbHdKdjAVmP7Yvsn7Q4G', 'Rian Hidayat', '081234567890', 'customer', TRUE)
ON DUPLICATE KEY UPDATE `email`=`email`;

-- Default Categories
INSERT INTO `categories` (`id`, `name`, `description`, `icon`) VALUES
('cat-pop', 'Pop & Ballad', 'Konser pop hits, vokal solo, dan grup band pop nasional & internasional', 'mic'),
('cat-rock', 'Rock & Metal', 'Energi panggung distorsi tinggi, riff gitar menggelegar, dan drum beat keras', 'guitar'),
('cat-jazz', 'Jazz & Soul', 'Alunan melodi intim, groove saksofon elegan, dan suasana lounge eksklusif', 'disc'),
('cat-edm', 'EDM & Electronic', 'Dentuman bass rave party, laser spektakuler, dan penampilan DJ kelas dunia', 'radio'),
('cat-indie', 'Indie & Folk', 'Karya musisi independen dengan lirik puitis dan harmoni akustik syahdu', 'feather')
ON DUPLICATE KEY UPDATE `name`=`name`;

-- Default Events
INSERT INTO `events` (`id`, `organizer_id`, `category_id`, `title`, `description`, `venue`, `location`, `city`, `date`, `start_time`, `end_time`, `poster_url`, `banner_url`, `terms_conditions`, `refund_policy`, `status`) VALUES
('evt-001', 'usr-organizer-01', 'cat-pop', 'Soundfest Spectacular Tour 2026', 'Konser akbar perayaan musik pop terbesar tahun ini menghadirkan kolaborasi artis papan atas Indonesia dengan panggung 360 derajat dan tata cahaya mutakhir.', 'Stadion Madya GBK', 'Jl. Pintu Satu Senayan, Gelora, Tanah Abang', 'Jakarta Pusat', '2026-12-20', '18:30:00', '23:00:00', 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=800&auto=format&fit=crop', 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1400&auto=format&fit=crop', '1. Wajib menunjukkan e-tiket dengan QR code saat masuk gate.\n2. Dilarang membawa makanan dan minuman dari luar.\n3. Dilarang membawa kamera profesional.', 'Tiket yang sudah dibeli tidak dapat direfund kecuali konser dibatalkan oleh pihak promotor.', 'published'),
('evt-002', 'usr-organizer-01', 'cat-rock', 'Thunder Rock Night Jakarta', 'Malam distorsi penuh energi bersama band-band rock legendaris tanah air. Panggung outdoor spektakuler dengan sound system 100.000 Watt.', 'Carnaval Ancol', 'Taman Impian Jaya Ancol, Pademangan', 'Jakarta Utara', '2026-11-28', '16:00:00', '22:30:00', 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop', 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1400&auto=format&fit=crop', '1. Tiket fisik digantikan oleh E-Tiket ber-QR code.\n2. Usia penonton minimal 15 tahun.', 'Kebijakan refund hanya berlaku jika terjadi force majeure.', 'published'),
('evt-003', 'usr-organizer-01', 'cat-jazz', 'Bandung Sunset Jazz Symphony', 'Menikmati syahdunya matahari terbenam di dataran tinggi Bandung diiringi alunan instrumen jazz dan orkestra terkemuka.', 'Dago Tea House Amphitheater', 'Jl. Bukit Dago Selatan No.53', 'Bandung', '2026-12-05', '16:30:00', '21:00:00', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop', 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=1400&auto=format&fit=crop', 'Pintu masuk dibuka pukul 15.00 WIB.', 'Pengembalian dana 100% apabila konser dibatalkan.', 'published')
ON DUPLICATE KEY UPDATE `title`=`title`;

-- Default Tickets
INSERT INTO `tickets` (`id`, `event_id`, `name`, `description`, `price`, `quantity`, `sold`, `max_per_order`, `benefits`, `is_active`) VALUES
('tkt-001', 'evt-001', 'Festival General', 'Free standing area festival di depan panggung utama', 350000.00, 1500, 50, 4, JSON_ARRAY('Akses Gate Festival', 'Free Wristband Exclusive'), TRUE),
('tkt-002', 'evt-001', 'VIP Lounge & Soundcheck', 'Area duduk khusus dengan akses soundcheck siang hari dan goodie bag eksklusif', 1250000.00, 300, 20, 2, JSON_ARRAY('Priority Fast-Track Gate', 'Soundcheck Pass', 'Exclusive Merch T-Shirt', 'Snack & Drink Lounge'), TRUE),
('tkt-003', 'evt-002', 'Presale Rocker', 'Tiket presale khusus early bird', 200000.00, 800, 45, 5, JSON_ARRAY('Akses Panggung Utama'), TRUE),
('tkt-004', 'evt-003', 'Early Bird Sunset', 'Tempat duduk tribun amfiteater dengan pemandangan langsung', 250000.00, 400, 15, 4, JSON_ARRAY('Tribun Seat', 'Free Welcome Drink'), TRUE)
ON DUPLICATE KEY UPDATE `name`=`name`;
