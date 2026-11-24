import crypto from "crypto";

// tanpa 0/O/1/I supaya tidak membingungkan saat diketik
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const generateEntryCode = (length = 8) => {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return code;
};