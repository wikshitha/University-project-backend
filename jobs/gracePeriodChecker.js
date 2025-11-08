import cron from "node-cron";
import Release from "../models/Release.js";
import Vault from "../models/Vault.js";
import AuditLog from "../models/AuditLog.js";
import { sendEmail } from "../utils/emailService.js";

export const startGracePeriodChecker = () => {
  // Run every hour to check if grace periods have ended
  cron.schedule("0 * * * *", async () => {
    console.log("⏳ [Cron] Checking grace periods...");

    try {
      const now = new Date();

      // Find all releases that are pending and grace period has ended
      const releases = await Release.find({
        status: "pending",
        gracePeriodEnd: { $lte: now },
      }).populate({
        path: "vaultId",
        populate: [
          { path: "ruleSetId" },
          { path: "participants.participantId" }
        ]
      });

      for (const release of releases) {
        const vault = release.vaultId;
        if (!vault) continue;

        // Move release to "in_progress" - awaiting witness approvals
        release.status = "in_progress";
        await release.save();

        // Notify witnesses that they need to approve
        const witnesses = vault.participants.filter(p => p.role === "witness");
        for (const witness of witnesses) {
          if (witness.participantId && witness.participantId.email) {
            await sendEmail(
              witness.participantId.email,
              "Action Required: Approve Vault Release",
              `The grace period for vault "${vault.title}" has ended. As a witness, you are now required to approve or reject this release. Please log in to review and take action.`
            );
          }
        }

        // Notify beneficiaries
        const beneficiaries = vault.participants.filter(p => p.role === "beneficiary");
        for (const beneficiary of beneficiaries) {
          if (beneficiary.participantId && beneficiary.participantId.email) {
            await sendEmail(
              beneficiary.participantId.email,
              "Vault Release - Awaiting Witness Approval",
              `The grace period for vault "${vault.title}" has ended. The release is now awaiting approval from witnesses. You will be notified once it's approved.`
            );
          }
        }

        // Audit log entry
        await AuditLog.create({
          user: vault.ownerId,
          action: "Grace Period Ended",
          details: { 
            releaseId: release._id, 
            vaultId: vault._id,
            message: "Release moved to in_progress, awaiting witness approvals"
          },
        });

        console.log(`🚀 Release ${release._id} moved to in_progress - awaiting approvals`);
      }
    } catch (err) {
      console.error("❌ GracePeriodChecker error:", err);
    }
  });

  console.log("⏳ Grace Period Checker started — hourly run.");
};
