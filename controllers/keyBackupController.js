// backend/controllers/keyBackupController.js
import User from "../models/User.js";

/**
 * Store encrypted vault key blob on the server (never plaintext)
 */
export const uploadEncryptedVaultKey = async (req, res) => {
  try {
    const { vaultId, encryptedVaultKey } = req.body;
    if (!vaultId || !encryptedVaultKey) {
      return res.status(400).json({ message: "vaultId and encryptedVaultKey required" });
    }

    // Example: store per-user key backups
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Optionally maintain per-vault encrypted key map
    if (!user.vaultKeyBackups) user.vaultKeyBackups = {};
    user.vaultKeyBackups[vaultId] = encryptedVaultKey;
    await user.save();

    res.json({ message: "Encrypted vault key saved successfully" });
  } catch (err) {
    console.error("Error saving encrypted vault key:", err);
    res.status(500).json({ message: "Failed to save encrypted vault key" });
  }
};

/**
 * Retrieve encrypted vault key blob (client will decrypt)
 */
export const getEncryptedVaultKey = async (req, res) => {
  try {
    const { vaultId } = req.params;

    const user = await User.findById(req.user._id);
    if (!user || !user.vaultKeyBackups || !user.vaultKeyBackups[vaultId]) {
      return res.status(404).json({ message: "Vault key backup not found" });
    }

    res.json({ encryptedVaultKey: user.vaultKeyBackups[vaultId] });
  } catch (err) {
    console.error("Error fetching vault key backup:", err);
    res.status(500).json({ message: "Failed to fetch encrypted vault key" });
  }
};
