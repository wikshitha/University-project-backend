// /jobs/releaseScheduler.js
import cron from "node-cron";
import Release from "../models/Release.js";
import AuditLog from "../models/AuditLog.js";

/**
 * Runs periodically to check approved releases whose time-lock expired
 * and finalize them automatically.
 */
export const startReleaseScheduler = () => {
  // Run every hour (you can change to "0 0 * * *" for once a day at midnight)
  cron.schedule("0 * * * *", async () => {
    console.log("[Scheduler] Checking for releases ready to finalize...");

    try {
      const now = new Date();

      // Find all approved releases whose countdown ended
      const readyReleases = await Release.find({
        status: "approved",
        countdownEnd: { $lte: now },
      });

      for (const release of readyReleases) {
        release.status = "released";
        release.completedAt = now;
        await release.save();

        await AuditLog.create({
          actorId: release.vaultId,
          action: `auto_finalized_release_${release._id}`,
        });

        console.log(`✅ Auto-finalized release ${release._id}`);
      }

      if (readyReleases.length === 0) {
        console.log("No releases to finalize at this time.");
      }
    } catch (err) {
      console.error("[Scheduler Error] Failed to finalize releases:", err.message);
    }
  });

  console.log("⏳ Release Scheduler started — runs every hour.");
};
