import { v4 as uuidv4 } from "uuid";
import db from "../config/db.js";

export const getAll = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM categories ORDER BY name ASC");
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const create = async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    const id = uuidv4();
    await db.query(
      "INSERT INTO categories (id, name, description, icon) VALUES (?, ?, ?, ?)",
      [id, name, description || null, icon || null]
    );
    res.status(201).json({ success: true, message: "Kategori berhasil ditambahkan", data: { id, name } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon } = req.body;
    await db.query(
      "UPDATE categories SET name = COALESCE(?, name), description = COALESCE(?, description), icon = COALESCE(?, icon) WHERE id = ?",
      [name, description, icon, id]
    );
    res.json({ success: true, message: "Kategori berhasil diperbarui" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM categories WHERE id = ?", [id]);
    res.json({ success: true, message: "Kategori berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};