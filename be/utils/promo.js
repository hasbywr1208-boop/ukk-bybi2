// Ambil promo yang valid + hitung diskon. Dipakai checkout & endpoint validate.
export const getValidPromo = async (conn, code, eventId, lock = false) => {
  const [rows] = await conn.query(
    `SELECT * FROM promos WHERE code = ? ${lock ? "FOR UPDATE" : ""}`,
    [String(code).trim().toUpperCase()]
  );
  if (rows.length === 0) return { error: "Kode promo tidak ditemukan" };

  const promo = rows[0];
  const now = new Date();
  if (!promo.is_active) return { error: "Promo tidak aktif" };
  if (now < new Date(promo.start_date) || now > new Date(promo.end_date)) {
    return { error: "Promo di luar periode berlaku" };
  }
  if (promo.used >= promo.quota) return { error: "Kuota promo sudah habis" };
  if (promo.event_id && promo.event_id !== eventId) {
    return { error: "Promo tidak berlaku untuk event ini" };
  }
  return { promo };
};

export const calculateDiscount = (promo, subtotal) => {
  let discount =
    promo.discount_type === "percent"
      ? (subtotal * Number(promo.discount_value)) / 100
      : Number(promo.discount_value);

  if (promo.max_discount) discount = Math.min(discount, Number(promo.max_discount));
  // total akhir minimal 1000 supaya tidak ditolak payment gateway
  discount = Math.min(discount, Math.max(subtotal - 1000, 0));
  return Math.round(discount);
};