import Vault from "../models/Vault.js";
import Item from "../models/Item.js";
import RuleSet from "../models/RuleSet.js";
import AuditLog from "../models/AuditLog.js";

// Create a new vault
export const createVault = async (req, res) => {
  try {
    const { title, description, ruleSet, sealedKeys } = req.body;

    const newRuleSet = new RuleSet({ ...ruleSet });
    await newRuleSet.save();

    const vault = new Vault({
      ownerId: req.user._id,
      title,
      description,
      ruleSetId: newRuleSet._id,
      sealedKeys
    });

    await vault.save();
    res.status(201).json({ message: "Vault created", vault });

    await AuditLog.create({
      user: req.user._id,
      action: "Created Vault",
      details: { vaultId: vault._id, vaultName: vault.name },
    });

  } catch (err) {
    res.status(500).json({ message: "Error creating vault", error: err.message });
  }
};

// Get all vaults for logged-in user
export const getMyVaults = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let vaults;

    if (userRole === "owner") {
      // 🧑‍💼 Owner: all vaults they created
      vaults = await Vault.find({ ownerId: userId })
        .populate("ruleSetId")
        .populate("participants.participantId", "firstName lastName email role");
    } else {
      // 👩‍⚖️ Witness / Executor / Beneficiary: only assigned vaults
      vaults = await Vault.find({
        "participants.participantId": userId,
      })
        .populate("ownerId", "firstName lastName email role")
        .populate("ruleSetId")
        .populate("participants.participantId", "firstName lastName email role");
    }

    res.json(vaults);
  } catch (err) {
    console.error("Error fetching vaults:", err);
    res.status(500).json({ message: "Failed to fetch vaults" });
  }
};


// Add an item to a vault
export const addItem = async (req, res) => {
  try {
    const { vaultId, fileUrl, encKey, metadata } = req.body;

    const item = new Item({ vaultId, fileUrl, encKey, metadata });
    await item.save();

    await Vault.findByIdAndUpdate(vaultId, { $push: { items: item._id } });

    res.status(201).json({ message: "Item added", item });
  } catch (err) {
    res.status(500).json({ message: "Error adding item", error: err.message });
  }
};

/**
 * Add participant (beneficiary / executor / witness) to a vault
 */
export const addParticipant = async (req, res) => {
  try {
    const { vaultId, email, role } = req.body;
    if (!vaultId || !email || !role)
      return res.status(400).json({ message: "vaultId, email, and role required" });

    const vault = await Vault.findById(vaultId);
    if (!vault) return res.status(404).json({ message: "Vault not found" });

    // Only owner can add participants
    if (vault.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only owner can add participants" });
    }

    const participant = await User.findOne({ email });
    if (!participant)
      return res.status(404).json({ message: "User not found with that email" });

    // Prevent duplicates
    const already = vault.participants.some(
      (p) => p.participantId.toString() === participant._id.toString()
    );
    if (already)
      return res.status(400).json({ message: "User already added as participant" });

    vault.participants.push({
      participantId: participant._id,
      role,
      encKey: "pending", // can later store sealedKey for that participant
    });

    await vault.save();

    res.json({ message: "Participant added successfully", vault });
  } catch (err) {
    console.error("Error adding participant:", err);
    res.status(500).json({ message: "Failed to add participant" });
  }
};



// ✅ Update existing vault
export const updateVault = async (req, res) => {
  try {
    const { id } = req.params;

    // Only update vaults owned by logged-in user
    const vault = await Vault.findOneAndUpdate(
      { _id: id,  ownerId: req.user._id },
      req.body,   // fields to update (name, description, etc.)
      { new: true, runValidators: true }
    );

    if (!vault) {
      return res.status(404).json({ error: "Vault not found or not authorized" });
    }

    res.json(vault);
  } catch (err) {
    console.error("Update Vault Error:", err);
    res.status(500).json({ error: "Server error while updating vault" });
  }
};


// Delete a vault (and cascade delete its items + ruleSet)
export const deleteVault = async (req, res) => {
  try {
    const { id } = req.params;

    // Find vault and ensure ownership
    const vault = await Vault.findOne({ _id: id, ownerId: req.user._id });
    if (!vault) {
      return res.status(404).json({ message: "Vault not found or not authorized" });
    }

    // Delete all items linked to vault
    await Item.deleteMany({ vaultId: vault._id });

    // Delete ruleset linked to vault
    if (vault.ruleSetId) {
      await RuleSet.findByIdAndDelete(vault.ruleSetId);
    }

    // Finally delete vault
    await Vault.findByIdAndDelete(vault._id);

    res.json({ message: "Vault and related data deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting vault", error: err.message });
  }
};


// Get a specific vault by ID with its items
export const getVaultById = async (req, res) => {
  try {
    const vault = await Vault.findById(req.params.id)
      .populate("items")
      .populate("ruleSetId")
      .populate("participants.participantId", "firstName lastName email role");

    if (!vault) {
      return res.status(404).json({ message: "Vault not found" });
    }

    // Check access
    const userId = req.user._id.toString();
    const isOwner = vault.ownerId.toString() === userId;
    const isParticipant = vault.participants.some(
      (p) => p.participantId && p.participantId._id.toString() === userId
    );

    if (!isOwner && !isParticipant) {
      return res.status(403).json({ message: "Access denied to this vault" });
    }

    res.json({
      vault,
      items: vault.items || [],
    });
  } catch (err) {
    console.error("Error fetching vault:", err);
    res.status(500).json({ message: "Failed to fetch vault" });
  }
};

