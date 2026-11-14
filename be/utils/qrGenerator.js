import QRCode from "qrcode";

export const generateQRCode = async (data) => {
  try {
    return await QRCode.toDataURL(JSON.stringify(data));
  } catch (err) {
    throw new Error("Gagal membuat QR Code: " + err.message);
  }
};