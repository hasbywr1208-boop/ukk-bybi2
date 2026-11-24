import { v4 as uuidv4 } from "uuid";
import db from "../config/db.js";
import { getValidPromo, calculateDiscount } from "../utils/promo.js";

// CEK PROMO (customer) - dipakai FE untuk menampilkan potongan sebelum bayar
export const validatePromo = async (req, res) => {
  try {
    const { code, ticket_id, quantity } = req.body;
    if (!code || !ticket_id || !quantity || quantity < 1) {
      return res.status(400).json({ success: false, message: "Data tidak lengkap" });
    }

    const [tickets] = await db.query("SELECT * FROM tickets WHERE id = ?", [ticket_id]);
    if (tickets.length === 0) {
      return res.status(404).json({ success: false, message: "Tiket tidak ditemukan" });
    }

    const ticket = tickets[0];
    const result = await getValidPromo(db, code, ticket.event_id);
    if (result.error) return res.status(400).json({ success: false, message: result.error });

    const subtotal = Number(ticket.price) * Number(quantity);
    const discount = calculateDiscount(result.promo, subtotal);

    res.json({
      success: true,
      data: { code: result.promo.code, subtotal, discount, total: subtotal - discount },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// LIST PROMO - EO (promo event miliknya) / admin (semua)
export const getPromos = async (req, res) => {
  try {
    const isAdmin = req.user.role === "super_admin";
    const [rows] = await db.query(
      `SELECT p.*, e.title AS event_title
       FROM promos p
       LEFT JOIN events e ON p.event_id = e.id
       ${isAdmin ? "" : "WHERE e.organizer_id = ?"}
       ORDER BY p.created_at DESC`,
      isAdmin ? [] : [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// helper: EO hanya boleh mengelola promo untuk event miliknya
const canManageEvent = async (eventId, user) => {
  if (user.role === "super_admin") return true;
  if (!eventId) return false; // promo global hanya admin
  const [rows] = await db.query("SELECT organizer_id FROM events WHERE id = ?", [eventId]);
  return rows.length > 0 && rows[0].organizer_id === user.id;
};

// CREATE PROMO
export const createPromo = async (req, res) => {
  try {
    const {
      event_id, code, discount_type, discount_value,
      max_discount, quota, start_date, end_date,
    } = req.body;

    if (!code || !discount_type || discount_value === undefined || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: "Data promo belum lengkap" });
    }
    if (!["percent", "fixed"].includes(discount_type)) {
      return res.status(400).json({ success: false, message: "discount_type harus percent atau fixed" });
    }
    if (discount_type === "percent" && (discount_value <= 0 || discount_value > 100)) {
      return res.status(400).json({ success: false, message: "Persen diskon harus 1-100" });
    }
    if (!(await canManageEvent(event_id, req.user))) {
      return res.status(403).json({ success: false, message: "Anda tidak berhak membuat promo untuk event ini" });
    }

    const id = uuidv4();
    await db.query(
      `INSERT INTO promos
       (id, event_id, code, discount_type, discount_value, max_discount, quota, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, event_id || null, String(code).trim().toUpperCase(), discount_type, discount_value,
       max_discount || null, quota || 100, start_date, end_date]
    );

    res.status(201).json({ success: true, message: "Promo berhasil dibuat", data: { id } });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Kode promo sudah dipakai" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE PROMO
export const updatePromo = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT event_id FROM promos WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Promo tidak ditemukan" });
    if (!(await canManageEvent(rows[0].event_id, req.user))) {
      return res.status(403).json({ success: false, message: "Anda tidak berhak mengubah promo ini" });
    }

    const { discount_value, max_discount, quota, start_date, end_date, is_active } = req.body;
    await db.query(
      `UPDATE promos SET
        discount_value = COALESCE(?, discount_value),
        max_discount = COALESCE(?, max_discount),
        quota = COALESCE(?, quota),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [discount_value, max_discount, quota, start_date, end_date, is_active, id]
    );
    res.json({ success: true, message: "Promo berhasil diperbarui" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE PROMO
export const deletePromo = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT event_id FROM promos WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Promo tidak ditemukan" });
    if (!(await canManageEvent(rows[0].event_id, req.user))) {
      return res.status(403).json({ success: false, message: "Anda tidak berhak menghapus promo ini" });
    }
    await db.query("DELETE FROM promos WHERE id = ?", [id]);
    res.json({ success: true, message: "Promo berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};