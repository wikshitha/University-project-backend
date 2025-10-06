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
    const vaults = await Vault.find({ ownerId: req.user._id })
      .populate("ruleSetId")
      .populate("items");
    res.json(vaults);
  } catch (err) {
    res.status(500).json({ message: "Error fetching vaults", error: err.message });
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


// ✅ Update existing vault
export const updateVault = async (req, res) => {
  try {
    const { id } = req.params;

    // Only update vaults owned by logged-in user
    const vault = await Vault.findOneAndUpdate(
      { _id: id, owner: req.user._id },
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
