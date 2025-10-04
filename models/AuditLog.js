import mongoose from "mongoose";
import crypto from "crypto";

const auditLogSchema = new mongoose.Schema({
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  action: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  previousHash: {
    type: String,
  },
  hash: {
    type: String,
  },
});

// Optional: maintain hash-chain for tamper resistance
auditLogSchema.pre("save", function (next) {
  const data = `${this.actorId || ""}${this.action}${this.timestamp}${this.previousHash || ""}`;
  this.hash = crypto.createHash("sha256").update(data).digest("hex");
  next();
});

export default mongoose.model("AuditLog", auditLogSchema);
