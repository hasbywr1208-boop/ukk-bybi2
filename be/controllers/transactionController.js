import { v4 as uuidv4 } from "uuid";
import db from "../config/db.js";
import { generateBookingCode } from "../utils/bookingCode.js";
import { generateQRCode } from "../utils/qrGenerator.js";
import { getValidPromo, calculateDiscount } from "../utils/promo.js";
import { generateEntryCode } from "../utils/entryCode.js";

// CHECKOUT - CUSTOMER (promo_code opsional)
export const checkout = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { ticket_id, quantity, promo_code } = req.body;
    if (!ticket_id || !quantity || quantity < 1) {
      return res.status(400).json({ success: false, message: "Data checkout tidak valid" });
    }

    await connection.beginTransaction();

    const [ticketRows] = await connection.query(
      "SELECT * FROM tickets WHERE id = ? FOR UPDATE",
      [ticket_id]
    );
    if (ticketRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Tiket tidak ditemukan" });
    }

    const ticket = ticketRows[0];
    const sisaKuota = ticket.quantity - ticket.sold;

    if (!ticket.is_active) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Tiket sudah tidak tersedia" });
    }
    if (quantity > ticket.max_per_order) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Maksimal pembelian ${ticket.max_per_order} tiket per transaksi` });
    }
    if (quantity > sisaKuota) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Kuota tiket tidak mencukupi" });
    }

    const subtotal = Number(ticket.price) * Number(quantity);
    let discount = 0;
    let usedPromoCode = null;

    if (promo_code) {
      const result = await getValidPromo(connection, promo_code, ticket.event_id, true);
      if (result.error) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: result.error });
      }
      discount = calculateDiscount(result.promo, subtotal);
      usedPromoCode = result.promo.code;

      // kuota promo dikurangi secara atomik
      const [upd] = await connection.query(
        "UPDATE promos SET used = used + 1 WHERE id = ? AND used < quota",
        [result.promo.id]
      );
      if (upd.affectedRows === 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: "Kuota promo sudah habis" });
      }
    }

    const totalPrice = subtotal - discount;
    const transactionId = uuidv4();
    const bookingCode = generateBookingCode();
    const expiredAt = new Date(Date.now() + 60 * 60 * 1000); // 1 jam

    await connection.query(
      `INSERT INTO transactions
       (id, user_id, event_id, ticket_id, booking_code, quantity, total_price, status, expired_at, promo_code, discount_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [transactionId, req.user.id, ticket.event_id, ticket_id, bookingCode, quantity,
       totalPrice, expiredAt, usedPromoCode, discount]
    );

    await connection.query("UPDATE tickets SET sold = sold + ? WHERE id = ?", [quantity, ticket_id]);

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Checkout berhasil, silakan lanjutkan pembayaran",
      data: {
        transaction_id: transactionId,
        booking_code: bookingCode,
        subtotal,
        discount_amount: discount,
        promo_code: usedPromoCode,
        total_price: totalPrice,
        expired_at: expiredAt,
      },
    });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
};

// RIWAYAT PEMBELIAN - CUSTOMER
export const getMyTransactions = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT tr.*, e.title AS event_title, e.date AS event_date, e.venue, e.poster_url, t.name AS ticket_name
       FROM transactions tr
       JOIN events e ON tr.event_id = e.id
       JOIN tickets t ON tr.ticket_id = t.id
       WHERE tr.user_id = ?
       ORDER BY tr.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DETAIL TRANSAKSI - CUSTOMER (E-TIKET)
// DETAIL TRANSAKSI - CUSTOMER (E-TIKET: QR + kode masuk)
export const getTransactionDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const query = () =>
      db.query(
        `SELECT tr.*, e.title AS event_title, e.date AS event_date, e.start_time, e.venue, e.location, e.city, e.poster_url,
                t.name AS ticket_name, u.name AS customer_name, u.email AS customer_email
         FROM transactions tr
         JOIN events e ON tr.event_id = e.id
         JOIN tickets t ON tr.ticket_id = t.id
         JOIN users u ON tr.user_id = u.id
         WHERE tr.id = ?`,
        [id]
      );

    let [rows] = await query();
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Transaksi tidak ditemukan" });

    let trx = rows[0];
    if (trx.user_id !== req.user.id && req.user.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Anda tidak berhak mengakses transaksi ini" });
    }

    // lengkapi e-tiket untuk transaksi paid yang belum punya QR / kode masuk
    if (trx.status === "paid" && (!trx.ticket_qr_code || !trx.entry_code)) {
      await generateETicket(id);
      [rows] = await query();
      trx = rows[0];
    }

    res.json({ success: true, data: trx });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// GENERATE E-TICKET: QR + kode masuk (dipanggil otomatis setelah pembayaran sukses)
export const generateETicket = async (transactionId) => {
  const [rows] = await db.query(
    "SELECT id, booking_code, entry_code FROM transactions WHERE id = ?",
    [transactionId]
  );
  if (rows.length === 0) return;

  const trx = rows[0];

  // kode masuk dibuat sekali saja; ulangi kalau kebetulan bentrok (UNIQUE)
  if (!trx.entry_code) {
    for (let i = 0; i < 5; i++) {
      try {
        await db.query(
          "UPDATE transactions SET entry_code = ? WHERE id = ? AND entry_code IS NULL",
          [generateEntryCode(), transactionId]
        );
        break;
      } catch (err) {
        if (err.code !== "ER_DUP_ENTRY") throw err;
      }
    }
  }

  const qrCode = await generateQRCode({ booking_code: trx.booking_code });
  await db.query("UPDATE transactions SET ticket_qr_code = ? WHERE id = ?", [qrCode, transactionId]);
};

// SCAN / CHECK-IN - ORGANIZER (bisa dari QR atau ketik kode masuk)
export const scanTicket = async (req, res) => {
  try {
    let { booking_code: input } = req.body; // field tetap "booking_code" supaya FE tidak berubah
    if (!input) {
      return res.status(400).json({ success: false, message: "Kode tiket wajib diisi" });
    }

    // isi QR berupa JSON, tapi kode biasa juga diterima
    try {
      const parsed = JSON.parse(input);
      if (parsed && parsed.booking_code) input = parsed.booking_code;
    } catch {}

    const raw = String(input).trim().toUpperCase();
    const entryCandidate = raw.replace(/[^A-Z0-9]/g, ""); // "K7M2-9QXA" -> "K7M29QXA"

    const [rows] = await db.query(
      `SELECT tr.id, tr.status, tr.quantity, tr.checked_in_at, e.organizer_id,
              e.title AS event_title, t.name AS ticket_name, u.name AS customer_name
       FROM transactions tr
       JOIN events e ON tr.event_id = e.id
       JOIN tickets t ON tr.ticket_id = t.id
       JOIN users u ON tr.user_id = u.id
       WHERE tr.booking_code = ? OR tr.entry_code = ?`,
      [raw, entryCandidate]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Tiket tidak ditemukan" });
    }

    const trx = rows[0];
    if (trx.organizer_id !== req.user.id && req.user.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Tiket ini bukan untuk event Anda" });
    }
    if (trx.status !== "paid") {
      return res.status(400).json({ success: false, message: "Tiket belum dibayar atau tidak valid" });
    }

    // update bersyarat: aman walau dua petugas memasukkan tiket yang sama bersamaan
    const [result] = await db.query(
      "UPDATE transactions SET checked_in_at = NOW() WHERE id = ? AND checked_in_at IS NULL",
      [trx.id]
    );
    if (result.affectedRows === 0) {
      return res.status(409).json({
        success: false,
        message: `Tiket sudah dipakai pada ${trx.checked_in_at}`,
      });
    }

    res.json({
      success: true,
      message: "Check-in berhasil",
      data: {
        event: trx.event_title,
        ticket: trx.ticket_name,
        customer: trx.customer_name,
        quantity: trx.quantity,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// LAPORAN PENJUALAN - ORGANIZER
export const getSalesReport = async (req, res) => {
  try {
    const { eventId } = req.params;

    const [eventCheck] = await db.query("SELECT organizer_id, title FROM events WHERE id = ?", [eventId]);
    if (eventCheck.length === 0) return res.status(404).json({ success: false, message: "Event tidak ditemukan" });
    if (eventCheck[0].organizer_id !== req.user.id && req.user.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Anda tidak berhak melihat laporan ini" });
    }

    const [summary] = await db.query(
      `SELECT
        COUNT(*) AS total_transaksi,
        SUM(CASE WHEN status = 'paid' THEN quantity ELSE 0 END) AS total_tiket_terjual,
        SUM(CASE WHEN status = 'paid' THEN total_price ELSE 0 END) AS total_pendapatan
       FROM transactions WHERE event_id = ?`,
      [eventId]
    );

    const [perTicket] = await db.query(
      `SELECT t.name, t.price, t.sold, t.quantity,
        (SELECT SUM(total_price) FROM transactions WHERE ticket_id = t.id AND status = 'paid') AS pendapatan
       FROM tickets t WHERE t.event_id = ?`,
      [eventId]
    );

    res.json({
      success: true,
      data: { event: eventCheck[0].title, summary: summary[0], per_ticket: perTicket },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};