import { v4 as uuidv4 } from "uuid";
import db from "../config/db.js";

// helper: cek kepemilikan event
const isOwnerOrAdmin = async (eventId, user) => {
  const [rows] = await db.query("SELECT organizer_id FROM events WHERE id = ?", [eventId]);
  if (rows.length === 0) return { exists: false };
  const isOwner = rows[0].organizer_id === user.id || user.role === "super_admin";
  return { exists: true, isOwner };
};

// LIST TIKET DALAM EVENT
export const getTicketsByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const [rows] = await db.query("SELECT * FROM tickets WHERE event_id = ? ORDER BY price ASC", [eventId]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// CREATE TIKET - ORGANIZER
export const createTicket = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { name, description, price, quantity, max_per_order, benefits } = req.body;

    const check = await isOwnerOrAdmin(eventId, req.user);
    if (!check.exists) return res.status(404).json({ success: false, message: "Event tidak ditemukan" });
    if (!check.isOwner) return res.status(403).json({ success: false, message: "Anda tidak berhak mengelola tiket event ini" });

    if (!name || price === undefined || quantity === undefined) {
      return res.status(400).json({ success: false, message: "Data tiket belum lengkap" });
    }

    const id = uuidv4();
    await db.query(
      `INSERT INTO tickets (id, event_id, name, description, price, quantity, max_per_order, benefits)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, eventId, name, description || null, price, quantity, max_per_order || 10, benefits ? JSON.stringify(benefits) : null]
    );

    res.status(201).json({ success: true, message: "Tiket berhasil ditambahkan", data: { id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE TIKET (harga, kuota, dll) - ORGANIZER
export const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const [ticketRows] = await db.query("SELECT event_id FROM tickets WHERE id = ?", [id]);
    if (ticketRows.length === 0) return res.status(404).json({ success: false, message: "Tiket tidak ditemukan" });

    const check = await isOwnerOrAdmin(ticketRows[0].event_id, req.user);
    if (!check.isOwner) return res.status(403).json({ success: false, message: "Anda tidak berhak mengubah tiket ini" });

    const { name, description, price, quantity, max_per_order, benefits, is_active } = req.body;
    await db.query(
      `UPDATE tickets SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        quantity = COALESCE(?, quantity),
        max_per_order = COALESCE(?, max_per_order),
        benefits = COALESCE(?, benefits),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, description, price, quantity, max_per_order, benefits ? JSON.stringify(benefits) : null, is_active, id]
    );

    res.json({ success: true, message: "Tiket berhasil diperbarui" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE TIKET - ORGANIZER
export const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const [ticketRows] = await db.query("SELECT event_id FROM tickets WHERE id = ?", [id]);
    if (ticketRows.length === 0) return res.status(404).json({ success: false, message: "Tiket tidak ditemukan" });

    const check = await isOwnerOrAdmin(ticketRows[0].event_id, req.user);
    if (!check.isOwner) return res.status(403).json({ success: false, message: "Anda tidak berhak menghapus tiket ini" });

    await db.query("DELETE FROM tickets WHERE id = ?", [id]);
    res.json({ success: true, message: "Tiket berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};