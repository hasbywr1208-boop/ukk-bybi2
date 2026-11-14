import db from "../config/db.js";

// DASHBOARD RINGKAS ORGANIZER
export const getDashboard = async (req, res) => {
  try {
    const [events] = await db.query(
      "SELECT COUNT(*) AS total_event FROM events WHERE organizer_id = ?",
      [req.user.id]
    );

    const [sales] = await db.query(
      `SELECT SUM(tr.total_price) AS total_pendapatan, SUM(tr.quantity) AS total_tiket_terjual
       FROM transactions tr
       JOIN events e ON tr.event_id = e.id
       WHERE e.organizer_id = ? AND tr.status = 'paid'`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: { total_event: events[0].total_event, ...sales[0] },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};