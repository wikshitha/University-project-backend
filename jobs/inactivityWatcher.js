import cron from "node-cron";
import Vault from "../models/Vault.js";
import User from "../models/User.js";
import RuleSet from "../models/RuleSet.js";
import Release from "../models/Release.js";

/**
 * This job runs every day at midnight.
 * It checks for vaults whose owners have been inactive longer than the allowed inactivity period.
 */
export const startInactivityWatcher = () => {
  cron.schedule("0 0 * * *", async () => {
    console.log("🔍 [Cron] Checking for inactive users...");

    try {
      const now = new Date();
      const users = await User.find({ lastActiveAt: { $exists: true } });

      for (const user of users) {
        const vaults = await Vault.find({ owner: user._id }).populate("ruleSet");

        for (const vault of vaults) {
          const ruleSet = vault.ruleSet;
          if (!ruleSet || !ruleSet.inactivityPeriod) continue;

          const inactivityEnd = new Date(user.lastActiveAt);
          inactivityEnd.setDate(inactivityEnd.getDate() + ruleSet.inactivityPeriod);

          if (now > inactivityEnd) {
            // user inactive long enough → start release
            const existing = await Release.findOne({
              vaultId: vault._id,
              status: { $ne: "released" },
            });
            if (existing) continue; // avoid duplicates

            const gracePeriodEnd = new Date();
            gracePeriodEnd.setDate(gracePeriodEnd.getDate() + ruleSet.gracePeriod);

            await Release.create({
              vaultId: vault._id,
              status: "pending",
              triggeredAt: now,
              gracePeriodEnd,
            });

            console.log(`⚠️  Release triggered for vault: ${vault._id}`);
          }
        }
      }
    } catch (err) {
      console.error("❌ Cron job error:", err);
    }
  });
};
