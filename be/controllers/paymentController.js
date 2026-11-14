import { v4 as uuidv4 } from "uuid";
import db from "../config/db.js";
import {
  createSnapTransaction, getMidtransStatus, verifyMidtransSignature,
} from "../utils/midtrans.js";
import { generateETicket } from "./transactionController.js";

// Terapkan status dari Midtrans (dipakai webhook DAN cek status manual)
const applyMidtransStatus = async (data) => {
  const [payRows] = await db.query(
    "SELECT * FROM payments WHERE gateway_transaction_id = ?",
    [data.order_id]
  );
  if (payRows.length === 0) return { found: false };

  const payment = payRows[0];
  const ts = data.transaction_status;
  const isPaid = ts === "settlement" || (ts === "capture" && data.fraud_status === "accept");
  const isFailed = ["deny", "cancel", "expire", "failure"].includes(ts);

  const conn = await db.getConnection();
  let paidNow = false;
  try {
    await conn.beginTransaction();

    const [trxRows] = await conn.query(
      "SELECT * FROM transactions WHERE id = ? FOR UPDATE",
      [payment.transaction_id]
    );
    const trx = trxRows[0];

    // Hanya proses kalau transaksi masih pending (anti dobel proses)
    if (trx && trx.status === "pending") {
      if (isPaid) {
        const paidAt = new Date();
        await conn.query(
          `UPDATE payments SET payment_status = 'success', payment_method = ?, paid_at = ?, payment_response = ? WHERE id = ?`,
          [data.payment_type || payment.payment_method, paidAt, JSON.stringify(data), payment.id]
        );
        await conn.query(
          "UPDATE transactions SET status = 'paid', payment_method = ?, paid_at = ? WHERE id = ?",
          [data.payment_type || "midtrans", paidAt, trx.id]
        );
        paidNow = true;
      } else if (isFailed) {
        await conn.query(
          "UPDATE payments SET payment_status = 'failed', payment_response = ? WHERE id = ?",
          [JSON.stringify(data), payment.id]
        );
        await conn.query("UPDATE transactions SET status = ? WHERE id = ?", [
          ts === "expire" ? "expired" : "cancelled",
          trx.id,
        ]);
        // kembalikan kuota tiket
        await conn.query("UPDATE tickets SET sold = GREATEST(sold - ?, 0) WHERE id = ?", [
          trx.quantity,
          trx.ticket_id,
        ]);
      } else {
        // pending: simpan info terbaru saja
        await conn.query(
          "UPDATE payments SET payment_method = ?, payment_response = ? WHERE id = ?",
          [data.payment_type || payment.payment_method, JSON.stringify(data), payment.id]
        );
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  if (paidNow) await generateETicket(payment.transaction_id);
  return { found: true, status: ts };
};

// CREATE PAYMENT -> generate Midtrans Snap
export const createPayment = async (req, res) => {
  try {
    const { transaction_id } = req.body;

    const [trxRows] = await db.query(
      `SELECT tr.*, u.email AS customer_email, u.name AS customer_name, e.title AS event_title
       FROM transactions tr
       JOIN users u ON tr.user_id = u.id
       JOIN events e ON tr.event_id = e.id
       WHERE tr.id = ?`,
      [transaction_id]
    );
    if (trxRows.length === 0) {
      return res.status(404).json({ success: false, message: "Transaksi tidak ditemukan" });
    }

    const trx = trxRows[0];
    if (trx.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Anda tidak berhak melakukan pembayaran ini" });
    }
    if (trx.status !== "pending") {
      return res.status(400).json({ success: false, message: "Transaksi tidak dalam status pending" });
    }

    // order_id harus unik tiap request (maks 50 karakter)
    const orderId = `${trx.booking_code}-${Date.now().toString(36)}`;
    const amount = Math.round(Number(trx.total_price));

    const snap = await createSnapTransaction({
      orderId,
      amount,
      customerName: trx.customer_name,
      customerEmail: trx.customer_email,
      itemName: `Tiket ${trx.event_title}`,
      finishUrl: `${process.env.CLIENT_URL}/payment/finish?transaction_id=${transaction_id}`,
    });

    const id = uuidv4();
    await db.query(
      `INSERT INTO payments
       (id, transaction_id, amount, payment_method, payment_status, payment_gateway, gateway_transaction_id, payment_response)
       VALUES (?, ?, ?, 'midtrans_snap', 'pending', 'midtrans', ?, ?)`,
      [id, transaction_id, trx.total_price, orderId, JSON.stringify(snap)]
    );

    await db.query("UPDATE transactions SET payment_method = 'midtrans' WHERE id = ?", [transaction_id]);

    res.status(201).json({
      success: true,
      message: "Pembayaran berhasil dibuat",
      data: {
        payment_id: id,
        order_id: orderId,
        snap_token: snap.token,
        redirect_url: snap.redirect_url,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// WEBHOOK - dipanggil otomatis oleh Midtrans (Payment Notification URL)
export const midtransWebhook = async (req, res) => {
  try {
    const notif = req.body;
    console.log("Webhook Midtrans masuk:", notif.order_id, notif.transaction_status);

    if (!notif || !verifyMidtransSignature(notif)) {
      return res.status(403).json({ success: false, message: "Signature tidak valid" });
    }

    await applyMidtransStatus(notif);
    // selalu 200 supaya Midtrans tidak retry terus-menerus
    res.status(200).json({ success: true, message: "Notifikasi diproses" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// CEK STATUS - kalau masih pending, sinkron langsung ke Midtrans (tanpa perlu webhook)
export const checkPaymentStatus = async (req, res) => {
  try {
    const { transaction_id } = req.params;

    const [rows] = await db.query(
      "SELECT status FROM transactions WHERE id = ? AND user_id = ?",
      [transaction_id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Transaksi tidak ditemukan" });
    }

    if (rows[0].status === "pending") {
      try {
        const [payRows] = await db.query(
          "SELECT gateway_transaction_id FROM payments WHERE transaction_id = ? ORDER BY created_at DESC",
          [transaction_id]
        );
        for (const p of payRows) {
          const midStatus = await getMidtransStatus(p.gateway_transaction_id);
          if (midStatus) await applyMidtransStatus(midStatus);
        }
      } catch (syncErr) {
        console.error("Sync Midtrans gagal:", syncErr.message);
      }
    }

    const [fresh] = await db.query(
      "SELECT status, paid_at FROM transactions WHERE id = ?",
      [transaction_id]
    );
    res.json({ success: true, data: fresh[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// MONITORING SEMUA PAYMENT - SUPER ADMIN
export const getAllPayments = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, tr.booking_code, tr.quantity, u.name AS customer_name, e.title AS event_title
       FROM payments p
       JOIN transactions tr ON p.transaction_id = tr.id
       JOIN users u ON tr.user_id = u.id
       JOIN events e ON tr.event_id = e.id
       ORDER BY p.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};