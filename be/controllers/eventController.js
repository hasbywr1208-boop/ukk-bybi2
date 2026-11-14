import { v4 as uuidv4 } from "uuid";
import db from "../config/db.js";

// CARI & FILTER (nama, tanggal, genre/kategori) - PUBLIC
export const searchEvents = async (req, res) => {
  try {
    const { keyword, date, category_id, city, page = 1, limit = 12 } = req.query;

    let sql = `
      SELECT e.*, c.name AS category_name, u.name AS organizer_name,
        (SELECT MIN(price) FROM tickets t WHERE t.event_id = e.id AND t.is_active = TRUE) AS min_price
      FROM events e
      JOIN categories c ON e.category_id = c.id
      JOIN users u ON e.organizer_id = u.id
      WHERE e.status = 'published'
    `;
    const params = [];

    if (keyword) {
      sql += " AND (e.title LIKE ? OR e.venue LIKE ? OR e.city LIKE ?)";
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (date) {
      sql += " AND e.date = ?";
      params.push(date);
    }
    if (category_id) {
      sql += " AND e.category_id = ?";
      params.push(category_id);
    }
    if (city) {
      sql += " AND e.city LIKE ?";
      params.push(`%${city}%`);
    }

    sql += " ORDER BY e.date ASC";

    const offset = (page - 1) * limit;
    sql += " LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(offset));

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DETAIL EVENT - PUBLIC
export const getEventDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const [events] = await db.query(
      `SELECT e.*, c.name AS category_name, u.name AS organizer_name
       FROM events e
       JOIN categories c ON e.category_id = c.id
       JOIN users u ON e.organizer_id = u.id
       WHERE e.id = ?`,
      [id]
    );
    if (events.length === 0) return res.status(404).json({ success: false, message: "Event tidak ditemukan" });

    const [tickets] = await db.query(
      "SELECT * FROM tickets WHERE event_id = ? AND is_active = TRUE",
      [id]
    );

    res.json({ success: true, data: { ...events[0], tickets } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// LIST EVENT MILIK ORGANIZER SENDIRI
export const getMyEvents = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT e.*, c.name AS category_name,
        (SELECT SUM(sold) FROM tickets t WHERE t.event_id = e.id) AS total_sold
       FROM events e
       JOIN categories c ON e.category_id = c.id
       WHERE e.organizer_id = ?
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// CREATE EVENT - ORGANIZER
export const createEvent = async (req, res) => {
  try {
    const {
      category_id, title, description, venue, location, city,
      date, start_time, end_time, poster_url, banner_url,
      terms_conditions, refund_policy,
    } = req.body;

    if (!category_id || !title || !description || !venue || !location || !city || !date || !start_time || !end_time) {
      return res.status(400).json({ success: false, message: "Data event belum lengkap" });
    }

    const id = uuidv4();
    await db.query(
      `INSERT INTO events
       (id, organizer_id, category_id, title, description, venue, location, city, date, start_time, end_time, poster_url, banner_url, terms_conditions, refund_policy, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [id, req.user.id, category_id, title, description, venue, location, city, date, start_time, end_time,
       poster_url || null, banner_url || null, terms_conditions || null, refund_policy || null]
    );

    res.status(201).json({ success: true, message: "Event berhasil dibuat", data: { id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE EVENT - ORGANIZER (hanya event milik sendiri)
export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const [check] = await db.query("SELECT organizer_id FROM events WHERE id = ?", [id]);
    if (check.length === 0) return res.status(404).json({ success: false, message: "Event tidak ditemukan" });
    if (check[0].organizer_id !== req.user.id && req.user.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Anda tidak berhak mengubah event ini" });
    }

    const {
      category_id, title, description, venue, location, city,
      date, start_time, end_time, poster_url, banner_url,
      terms_conditions, refund_policy,
    } = req.body;

    await db.query(
      `UPDATE events SET
        category_id = COALESCE(?, category_id),
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        venue = COALESCE(?, venue),
        location = COALESCE(?, location),
        city = COALESCE(?, city),
        date = COALESCE(?, date),
        start_time = COALESCE(?, start_time),
        end_time = COALESCE(?, end_time),
        poster_url = COALESCE(?, poster_url),
        banner_url = COALESCE(?, banner_url),
        terms_conditions = COALESCE(?, terms_conditions),
        refund_policy = COALESCE(?, refund_policy)
       WHERE id = ?`,
      [category_id, title, description, venue, location, city, date, start_time, end_time,
       poster_url, banner_url, terms_conditions, refund_policy, id]
    );

    res.json({ success: true, message: "Event berhasil diperbarui" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UBAH STATUS EVENT (draft -> published -> cancelled/completed)
export const updateEventStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatus = ["draft", "published", "cancelled", "completed"];

    if (!validStatus.includes(status)) {
      return res.status(400).json({ success: false, message: "Status tidak valid" });
    }

    const [check] = await db.query("SELECT organizer_id FROM events WHERE id = ?", [id]);
    if (check.length === 0) return res.status(404).json({ success: false, message: "Event tidak ditemukan" });
    if (check[0].organizer_id !== req.user.id && req.user.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Anda tidak berhak mengubah status event ini" });
    }

    await db.query("UPDATE events SET status = ? WHERE id = ?", [status, id]);
    res.json({ success: true, message: `Status event diubah menjadi ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE EVENT - ORGANIZER
export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const [check] = await db.query("SELECT organizer_id FROM events WHERE id = ?", [id]);
    if (check.length === 0) return res.status(404).json({ success: false, message: "Event tidak ditemukan" });
    if (check[0].organizer_id !== req.user.id && req.user.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Anda tidak berhak menghapus event ini" });
    }

    await db.query("DELETE FROM events WHERE id = ?", [id]);
    res.json({ success: true, message: "Event berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// LIST SEMUA EVENT - SUPER ADMIN
export const getAllEventsAdmin = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT e.*, c.name AS category_name, u.name AS organizer_name, u.email AS organizer_email
       FROM events e
       JOIN categories c ON e.category_id = c.id
       JOIN users u ON e.organizer_id = u.id
       ORDER BY e.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};