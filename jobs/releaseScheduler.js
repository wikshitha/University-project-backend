// /jobs/releaseScheduler.js
import cron from "node-cron";
import Release from "../models/Release.js";
import AuditLog from "../models/AuditLog.js";
import Vault from "../models/Vault.js";
import { sendEmail } from "../utils/emailService.js";

/**
 * Runs every hour to check releases:
 * - Sends notifications for time-lock start
 * - Auto-finalizes releases when countdown ends
 */
export const startReleaseScheduler = () => {
  // Run every hour
  cron.schedule("0 * * * *", async () => {
    console.log("[Scheduler] Checking release countdowns...");

    const now = new Date();

    try {
      // 1️⃣ Find newly approved releases whose countdown just started
      const newApproved = await Release.find({
        status: "approved",
        notifiedTimeLock: { $ne: true },
      }).populate("vaultId");

      for (const rel of newApproved) {
        const vault = rel.vaultId;
        if (vault?.participants) {
          for (const p of vault.participants) {
            await sendEmail(
              p.email,
              "Vault Time-Lock Activated",
              `The vault "${vault.name}" has been approved for release. It will auto-unlock after the time-lock ends on ${rel.countdownEnd}.`
            );
          }
        }
        rel.notifiedTimeLock = true;
        await rel.save();
        console.log(`📩 Notified participants of time-lock for ${vault.name}`);
      }

      // 2️⃣ Find releases ready to finalize (countdown expired)
      const readyReleases = await Release.find({
        status: "approved",
        countdownEnd: { $lte: now },
      }).populate("vaultId");

      for (const release of readyReleases) {
        release.status = "released";
        release.completedAt = now;
        await release.save();

        const vault = release.vaultId;
        if (vault?.participants) {
          for (const p of vault.participants) {
            await sendEmail(
              p.email,
              "Vault Released 🎉",
              `The vault "${vault.name}" has completed its time-lock and is now released.`
            );
          }
        }

        await AuditLog.create({
          actorId: release.vaultId,
          action: `auto_finalized_release_${release._id}`,
        });

        console.log(`✅ Auto-finalized and notified for release ${release._id}`);
      }

      if (newApproved.length === 0 && readyReleases.length === 0) {
        console.log("No releases to process at this time.");
      }
    } catch (err) {
      console.error("[Scheduler Error] Failed to process releases:", err);
    }
  });

  console.log("⏳ Release Scheduler started — runs every hour.");
};
