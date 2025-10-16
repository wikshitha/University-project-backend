import cron from "node-cron";
import Release from "../models/Release.js";
import Vault from "../models/Vault.js";
import AuditLog from "../models/AuditLog.js";
import { sendEmail } from "../utils/emailService.js";

export const startReleaseScheduler = () => {
  cron.schedule("0 * * * *", async () => {
    console.log("[Scheduler] Checking release countdowns...");

    try {
      const now = new Date();

      // 1️⃣ Find approved releases still counting down
      const activeReleases = await Release.find({
        status: "approved",
        countdownEnd: { $gte: now },
      }).populate("vaultId");

      for (const release of activeReleases) {
        const msRemaining = new Date(release.countdownEnd) - now;
        const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

        // Send daily reminder (you can fine-tune to once/day or 2 days before)
        if (daysRemaining <= 2) {
          const vault = release.vaultId;
          const participants = vault?.participants || [];

          for (const p of participants) {
            await sendEmail(
              p.email,
              `Vault "${vault.name}" — Release Countdown`,
              `The time-lock for vault "${vault.name}" will complete in ${daysRemaining} day(s).`
            );
          }

          await AuditLog.create({
            actorId: vault._id,
            action: `reminder_sent_${daysRemaining}d_before_release_${release._id}`,
          });

          console.log(`📧 Reminder sent (${daysRemaining} days left) for release ${release._id}`);
        }
      }

      // 2️⃣ Find releases whose countdown ended and finalize them
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
    } catch (err) {
      console.error("[Scheduler Error]", err);
    }
  });

  console.log("⏳ Release Scheduler started — hourly run.");
};
