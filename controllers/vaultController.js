// backend/controllers/vaultController.js
import Vault from "../models/Vault.js";
import RuleSet from "../models/RuleSet.js";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js"; // Required for participant lookup

// ---------------- CREATE VAULT ----------------
export const createVault = async (req, res) => {
  try {
    const { title, description, ruleSet, sealedKeys } = req.body;

    if (!title || !description || !ruleSet)
      return res.status(400).json({ message: "Title, description, and ruleSet required" });

    // Create and save RuleSet
    const newRuleSet = new RuleSet({ ...ruleSet });
    await newRuleSet.save();

    // Create vault
    const vault = new Vault({
      ownerId: req.user._id,
      title,
      description,
      ruleSetId: newRuleSet._id,
      sealedKeys: sealedKeys || [],
    });
    await vault.save();

    // Log audit
    await AuditLog.create({
      user: req.user._id,
      action: "Created Vault",
      details: { vaultId: vault._id, vaultName: vault.title },
    });

    return res.status(201).json({ message: "Vault created", vault });
  } catch (err) {
    console.error("Error creating vault:", err);
    return res.status(500).json({ message: "Error creating vault", error: err.message });
  }
};

// ---------------- GET USER VAULTS ----------------
export const getMyVaults = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let vaults;

    if (userRole === "owner") {
      vaults = await Vault.find({ ownerId: userId })
        .populate("ruleSetId")
        .populate("participants.participantId", "firstName lastName email role")
        .populate({
          path: "items",
          select: "metadata fileUrl encKey createdAt",
        });
    } else {
      vaults = await Vault.find({ "participants.participantId": userId })
        .populate("ownerId", "firstName lastName email role")
        .populate("ruleSetId")
        .populate("participants.participantId", "firstName lastName email role")
        .populate({
          path: "items",
          select: "metadata fileUrl encKey createdAt",
        });
    }

    return res.status(200).json(vaults);
  } catch (err) {
    console.error("Error fetching vaults:", err);
    return res.status(500).json({ message: "Failed to fetch vaults" });
  }
};

// ---------------- ADD PARTICIPANT ----------------
export const addParticipant = async (req, res) => {
  try {
    const { vaultId, email, role } = req.body;

    if (!vaultId || !email || !role)
      return res.status(400).json({ message: "vaultId, email, and role required" });

    const vault = await Vault.findById(vaultId);
    if (!vault) return res.status(404).json({ message: "Vault not found" });

    if (vault.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only owner can add participants" });
    }

    const participant = await User.findOne({ email });
    if (!participant)
      return res.status(404).json({ message: "User not found with that email" });

    const alreadyAdded = vault.participants.some(
      (p) => p.participantId.toString() === participant._id.toString()
    );
    if (alreadyAdded)
      return res.status(400).json({ message: "User already added as participant" });

    vault.participants.push({
      participantId: participant._id,
      role,
      encKey: "pending",
    });

    await vault.save();

    return res.status(200).json({ message: "Participant added successfully", vault });
  } catch (err) {
    console.error("Error adding participant:", err);
    return res.status(500).json({ message: "Failed to add participant" });
  }
};

export const removeParticipant = async (req, res) => {
  try {
    const { id, participantId } = req.params;

    const vault = await Vault.findById(id);
    if (!vault) return res.status(404).json({ message: "Vault not found" });

    // Only owner can remove
    if (vault.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only owner can remove participants" });
    }

    vault.participants = vault.participants.filter(
      (p) => p.participantId.toString() !== participantId
    );
    await vault.save();

    res.json({ message: "Participant removed successfully", vault });
  } catch (err) {
    console.error("Error removing participant:", err);
    res.status(500).json({ message: "Failed to remove participant" });
  }
};


// ---------------- GET VAULT BY ID ----------------
export const getVaultById = async (req, res) => {
  try {
    const vault = await Vault.findById(req.params.id)
      .populate({
        path: "items",
        select: "metadata fileUrl encKey createdAt",
      })
      .populate("ruleSetId")
      .populate("participants.participantId", "firstName lastName email role");

    if (!vault) return res.status(404).json({ message: "Vault not found" });

    // Access control: only owner or participant can view
    const userId = req.user._id.toString();
    const isOwner = vault.ownerId.toString() === userId;
    const isParticipant = vault.participants.some(
      (p) => p.participantId && p.participantId._id.toString() === userId
    );

    if (!isOwner && !isParticipant)
      return res.status(403).json({ message: "Access denied to this vault" });

    return res.status(200).json({ vault, items: vault.items || [] });
   
  } catch (err) {
    console.error("Error fetching vault:", err);
    return res.status(500).json({ message: "Failed to fetch vault" });
  }
};

// ---------------- DELETE VAULT ----------------
export const deleteVault = async (req, res) => {
  try {
    const { id } = req.params;

    const vault = await Vault.findOne({ _id: id, ownerId: req.user._id });
    if (!vault)
      return res.status(404).json({ message: "Vault not found or not authorized" });

    if (vault.ruleSetId) await RuleSet.findByIdAndDelete(vault.ruleSetId);
    await Vault.findByIdAndDelete(vault._id);

    return res.status(200).json({ message: "Vault deleted successfully" });
  } catch (err) {
    console.error("Error deleting vault:", err);
    return res.status(500).json({ message: "Error deleting vault", error: err.message });
  }
};
