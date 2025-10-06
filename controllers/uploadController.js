import cloudinary from "cloudinary";
import Item from "../models/Item.js";
import Vault from "../models/Vault.js";
import { v4 as uuidv4 } from "uuid";
import AuditLog from "../models/AuditLog.js";

// Cloudinary config (from .env)
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload encrypted file blob to Cloudinary and record it in DB
 */
export const uploadEncryptedFile = async (req, res) => {
  try {
    const { vaultId, metadata, encryptedData } = req.body;

    if (!vaultId || !encryptedData) {
      return res.status(400).json({ message: "Vault ID and encrypted data required" });
    }

    // Verify vault ownership
    const vault = await Vault.findById(vaultId);
    if (!vault) return res.status(404).json({ message: "Vault not found" });

    // Upload encrypted blob as base64 string to Cloudinary
    const uploadResponse = await cloudinary.v2.uploader.upload(encryptedData, {
      folder: "timelock_vaults",
      resource_type: "auto",
      public_id: `enc_${uuidv4()}`,
    });

    // Create Item entry in DB
    const item = await Item.create({
      vaultId,
      fileUrl: uploadResponse.secure_url,
      metadata: metadata || {},
    });

    // Create audit log entry
    await AuditLog.create({
      actorId: req.user._id,
      action: `encrypted_file_uploaded to vault ${vaultId}`,
    });

    res.status(201).json({
      message: "Encrypted file uploaded successfully",
      item,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error uploading encrypted file", error: err.message });
  }
};
