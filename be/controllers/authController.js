import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import db from "../config/db.js";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";

// REGISTER (Customer)
export const register = async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: "Data wajib diisi" });
    }

    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: "Email sudah terdaftar" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();

    await db.query(
      "INSERT INTO users (id, email, password, name, phone, role, is_verified) VALUES (?, ?, ?, ?, ?, 'customer', TRUE)",
      [id, email, hashedPassword, name, phone || null]
    );

    res.status(201).json({ success: true, message: "Registrasi berhasil", data: { id, email, name } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// LOGIN (semua role)
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Email atau password salah" });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Email atau password salah" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await db.query("UPDATE users SET refresh_token = ? WHERE id = ?", [refreshToken, user.id]);

    res.json({
      success: true,
      message: "Login berhasil",
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          profile_picture: user.profile_picture,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// REFRESH TOKEN
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ success: false, message: "Refresh token wajib diisi" });

    const [rows] = await db.query("SELECT * FROM users WHERE refresh_token = ?", [refreshToken]);
    if (rows.length === 0) return res.status(403).json({ success: false, message: "Refresh token tidak valid" });

    const user = rows[0];

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err) => {
      if (err) return res.status(403).json({ success: false, message: "Refresh token kadaluarsa" });

      const newAccessToken = generateAccessToken(user);
      res.json({ success: true, data: { accessToken: newAccessToken } });
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// LOGOUT
export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    await db.query("UPDATE users SET refresh_token = NULL WHERE refresh_token = ?", [refreshToken]);
    res.json({ success: true, message: "Logout berhasil" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET PROFILE
export const getMe = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, email, name, phone, role, profile_picture, is_verified, created_at FROM users WHERE id = ?",
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: "User tidak ditemukan" });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE PROFILE
export const updateProfile = async (req, res) => {
  try {
    const { name, phone, profile_picture } = req.body;
    await db.query(
      "UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), profile_picture = COALESCE(?, profile_picture) WHERE id = ?",
      [name, phone, profile_picture, req.user.id]
    );
    res.json({ success: true, message: "Profil berhasil diperbarui" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};