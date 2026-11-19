import crypto from "crypto";

// Dibaca di dalam fungsi, karena dotenv baru di-load setelah import
const getConfig = () => {
  const isProd = process.env.MIDTRANS_IS_PRODUCTION === "true";
  return {
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    snapUrl: isProd
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions",
    apiUrl: isProd
      ? "https://api.midtrans.com"
      : "https://api.sandbox.midtrans.com",
  };
};

const getAuthHeader = () => {
  const { serverKey } = getConfig();
  return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
};

// Buat transaksi Snap -> hasil: { token, redirect_url }
export const createSnapTransaction = async ({
  orderId, amount, customerName, customerEmail, itemName, finishUrl,
}) => {
  const { snapUrl } = getConfig();

  const response = await fetch(snapUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: amount },
      item_details: [
        { id: orderId, price: amount, quantity: 1, name: itemName.slice(0, 50) },
      ],
      customer_details: { first_name: customerName, email: customerEmail },
      callbacks: { finish: finishUrl },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      (data.error_messages && data.error_messages.join(", ")) || "Gagal membuat transaksi Midtrans"
    );
  }
  return data;
};

// Tanya status transaksi langsung ke Midtrans (null kalau order belum ada)
export const getMidtransStatus = async (orderId) => {
  const { apiUrl } = getConfig();
  const response = await fetch(`${apiUrl}/v2/${orderId}/status`, {
    headers: { Accept: "application/json", Authorization: getAuthHeader() },
  });
  const data = await response.json();
  if (String(data.status_code) === "404") return null;
  return data;
};

// Verifikasi signature notifikasi Midtrans
export const verifyMidtransSignature = (n) => {
  const { serverKey } = getConfig();
  const expected = crypto
    .createHash("sha512")
    .update(`${n.order_id}${n.status_code}${n.gross_amount}${serverKey}`)
    .digest("hex");
  return expected === n.signature_key;
};