import AuditLog from "../models/AuditLog.js";

// ✅ Record a new log
export const recordLog = async (req, res) => {
  try {
    const { action, details } = req.body;

    const log = await AuditLog.create({
      user: req.user?._id,
      action,
      details,
    });

    res.status(201).json(log);
  } catch (error) {
    console.error("Error recording audit log:", error);
    res.status(500).json({ message: "Failed to record audit log" });
  }
};

// ✅ Get all logs (admin or owner)
export const getLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate("user", "firstName lastName email role")
      .sort({ timestamp: -1 });

    res.status(200).json(logs);
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
};

// ✅ Get logs for a specific vault or user
export const getLogsByFilter = async (req, res) => {
  try {
    const { vaultId, userId } = req.query;
    const filter = {};

    if (vaultId) filter["details.vaultId"] = vaultId;
    if (userId) filter.user = userId;

    const logs = await AuditLog.find(filter)
      .populate("user", "firstName lastName email role")
      .sort({ timestamp: -1 });

    res.status(200).json(logs);
  } catch (error) {
    console.error("Error fetching filtered logs:", error);
    res.status(500).json({ message: "Failed to fetch filtered logs" });
  }
};
