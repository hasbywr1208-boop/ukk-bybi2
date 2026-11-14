import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import db from "../config/db.js";

// KELOLA AKUN EO - CRUD (super_admin)

export const getAllOrganizers = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, email, name, phone, is_verified, created_at FROM users WHERE role = 'event_organizer' ORDER BY created_at DESC"
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createOrganizer = async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: "Data wajib diisi" });
    }

    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) return res.status(409).json({ success: false, message: "Email sudah terdaftar" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();

    await db.query(
      "INSERT INTO users (id, email, password, name, phone, role, is_verified) VALUES (?, ?, ?, ?, ?, 'event_organizer', TRUE)",
      [id, email, hashedPassword, name, phone || null]
    );

    res.status(201).json({ success: true, message: "Akun EO berhasil dibuat", data: { id, email, name } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateOrganizer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, is_verified } = req.body;

    await db.query(
      "UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), is_verified = COALESCE(?, is_verified) WHERE id = ? AND role = 'event_organizer'",
      [name, phone, is_verified, id]
    );

    res.json({ success: true, message: "Akun EO berhasil diperbarui" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteOrganizer = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM users WHERE id = ? AND role = 'event_organizer'", [id]);
    res.json({ success: true, message: "Akun EO berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DASHBOARD SUPER ADMIN
export const getAdminDashboard = async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT
        SUM(CASE WHEN role = 'customer' THEN 1 ELSE 0 END) AS total_customer,
        SUM(CASE WHEN role = 'event_organizer' THEN 1 ELSE 0 END) AS total_organizer
       FROM users`
    );
    const [events] = await db.query("SELECT COUNT(*) AS total_event FROM events");
    const [revenue] = await db.query(
      "SELECT SUM(total_price) AS total_revenue FROM transactions WHERE status = 'paid'"
    );

    res.json({
      success: true,
      data: { ...users[0], ...events[0], ...revenue[0] },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};