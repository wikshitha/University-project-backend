import mongoose from "mongoose";

const releaseSchema = new mongoose.Schema({
  vaultId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vault",
    required: true,
  },
  triggeredAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["pending", "in_progress", "approved", "rejected", "released"],
    default: "pending",
  },
  gracePeriodEnd: {
    type: Date,
  },
  countdownEnd: {
    type: Date,
  },
  approvalsNeeded: {
    type: Number,
    default: 0,
  },
  approvalsReceived: {
    type: Number,
    default: 0,
  },
  completedAt: {
    type: Date,
  },
});

export default mongoose.model("Release", releaseSchema);
