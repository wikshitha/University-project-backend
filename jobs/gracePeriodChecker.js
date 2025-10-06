import cron from "node-cron";
import Release from "../models/Release.js";
import AuditLog from "../models/AuditLog.js";

export const startGracePeriodChecker = () => {
  // Run every day at midnight
  cron.schedule("0 0 * * *", async () => {
    console.log("⏳ [Cron] Checking grace periods...");

    try {
      const now = new Date();

      // Find all releases that are pending and grace period has ended
      const releases = await Release.find({
        status: "pending",
        gracePeriodEnd: { $lte: now },
      });

      for (const release of releases) {
        // Move release to "in_progress"
        release.status = "in_progress";

        // Set countdownEnd (e.g., time lock)
        const countdownEnd = new Date();
        countdownEnd.setDate(countdownEnd.getDate() + 7); // default 7 days
        release.countdownEnd = countdownEnd;

        await release.save();

        // Audit log entry
        await AuditLog.create({
          actorId: release.vaultId, // system action
          action: `Grace period ended → release in progress`,
        });

        console.log(`🚀 Release ${release._id} moved to in_progress`);
      }
    } catch (err) {
      console.error("❌ GracePeriodChecker error:", err);
    }
  });
};
