import Release from "../models/Release.js";
import Confirmation from "../models/Confirmation.js";
import AuditLog from "../models/AuditLog.js";
import Vault from "../models/Vault.js";
import { sendEmail } from "../utils/emailService.js";


/**
 * Trigger a release (e.g., system detects inactivity)
 */
export const triggerRelease = async (req, res) => {
  try {
    const { vaultId } = req.body;

    // Find vault and verify ownership
    const vault = await Vault.findById(vaultId);
    if (!vault) {
      return res.status(404).json({ message: "Vault not found" });
    }

    // Create new release
    const release = await Release.create({
      vaultId,
      status: "pending",
      triggeredAt: new Date(),
      gracePeriodEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days grace
    });

    // Example: notify executors/witnesses
    const participants = vault.participants || []; // assuming participant list exists
    for (const p of participants) {
      await sendEmail(
      p.email,
      "Release Triggered — Grace Period Started",
      `A release has been triggered for vault "${vault.title}". Grace period ends on ${release.gracePeriodEnd}.`
    );
}


    // Create audit log
    await AuditLog.create({
      actorId: req.user._id,
      action: `release_triggered for vault ${vaultId}`,
    });

    res.status(201).json({
      message: "Release triggered and grace period started",
      release,
    });
  } catch (err) {
    res.status(500).json({ message: "Error triggering release", error: err.message });
  }
};

/**
 * Get all releases for a specific user (owner or executor)
 */
export const getReleasesForUser = async (req, res) => {
  try {
    let releases;

    if (req.user.role === "owner") {
      releases = await Release.find()
        .populate({
          path: "vaultId",
          match: { ownerId: req.user._id },
        })
        .sort({ triggeredAt: -1 });
    } else {
      releases = await Release.find()
        .populate({
          path: "vaultId",
          match: { "participants.participantId": req.user._id },
        })
        .sort({ triggeredAt: -1 });
    }

    releases = releases.filter((r) => r.vaultId !== null);

    res.json(releases);
  } catch (err) {
    res.status(500).json({ message: "Error fetching releases", error: err.message });
  }
};


/**
 * Approve or reject a release (executor/witness action)
 */
export const confirmRelease = async (req, res) => {
  try {
    const { releaseId, status, comment } = req.body;

    // Check if release exists
    const release = await Release.findById(releaseId).populate("vaultId");
    if (!release) return res.status(404).json({ message: "Release not found" });

    // Differentiate participant vs owner actions
    let actionType = "participant"; // default

    // If the user is the vault owner
    const vault = release.vaultId;
    if (vault.owner.toString() === req.user._id.toString()) {
      actionType = "owner";
    }

    // Create new confirmation
    const confirmation = await Confirmation.create({
      releaseId,
      participantId: req.user._id,
      status,
      comment,
      actionType,
    });

    // Update release progress only for participant approvals
    if (actionType === "participant") {
      if (status === "approved") {
        release.approvalsReceived += 1;

        // If all approvals collected, move to time-lock phase
        if (release.approvalsReceived >= release.approvalsNeeded) {
          release.status = "approved"; // move to approved (time-lock starts)
          
          // Notify participants
          if (vault?.participants) {
            for (const p of vault.participants) {
              await sendEmail(
                p.email,
                "Vault Approved for Release",
                `Vault "${vault.name}" has received all participant approvals. Countdown until unlock ends on ${release.countdownEnd}.`
              );
            }
          }
        }
      } else {
        release.status = "rejected"; // participant rejected
      }
    }

    // Owner revocation overrides participant approvals
    if (actionType === "owner" && status === "rejected") {
      release.status = "rejected"; // owner revoked
      release.completedAt = new Date();

      // Notify participants
      if (vault?.participants) {
        for (const p of vault.participants) {
          await sendEmail(
            p.email,
            "Vault Release Aborted",
            `The release of vault "${vault.name}" has been aborted by the owner. Comment: ${comment || "No comment provided"}`
          );
        }
      }
    }

    await release.save();

    // Log audit
    await AuditLog.create({
      actorId: req.user._id,
      action: `${actionType}_${status} for release ${releaseId}`,
    });

    res.status(201).json({ message: "Confirmation recorded", confirmation, release });
  } catch (err) {
    res.status(500).json({ message: "Error confirming release", error: err.message });
  }
};

/**
 * Finalize a release after time-lock ends
 */
export const finalizeRelease = async (req, res) => {
  try {
    const { releaseId } = req.body;

    const release = await Release.findById(releaseId);
    if (!release) return res.status(404).json({ message: "Release not found" });

    if (release.status !== "approved") {
      return res.status(400).json({ message: "Cannot finalize — not all approvals complete" });
    }

    // Check time-lock expiration
    if (new Date() < new Date(release.countdownEnd)) {
      return res.status(400).json({ message: "Time-lock not yet finished" });
    }

    release.status = "released";
    release.completedAt = new Date();
    await release.save();

    // Log release event
    await AuditLog.create({
      actorId: req.user._id,
      action: `vault_released ${release.vaultId}`,
    });

    res.status(200).json({ message: "Vault released successfully", release });
  } catch (err) {
    res.status(500).json({ message: "Error finalizing release", error: err.message });
  }
};

export const getPendingReleasesForUser = async (req, res) => {
  try {
    const userId = req.user._id;

    const releases = await Release.find({
      status: { $in: ["pending", "in_progress"] },
    }).populate("vaultId");

    // Optional: filter where user is a vault participant
    const myReleases = releases.filter((r) =>
      r.vaultId?.participants?.some(
        (p) => p.userId?.toString() === userId.toString()
      )
    );

    res.json(myReleases);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching pending releases", error: err.message });
  }
};

export const revokeRelease = async (req, res) => {
  try {
    const { releaseId, reason } = req.body;

    const release = await Release.findById(releaseId).populate("vaultId");
    if (!release) return res.status(404).json({ message: "Release not found" });

    if (release.status === "released") {
      return res.status(400).json({ message: "Cannot revoke a released vault" });
    }

    release.status = "rejected"; // mark as revoked
    release.completedAt = new Date();
    await release.save();

    // Notify participants
    const vault = release.vaultId;
    if (vault?.participants) {
      for (const p of vault.participants) {
        await sendEmail(
          p.email,
          "Vault Release Aborted",
          `The release of vault "${vault.name}" has been aborted by the owner. Reason: ${reason || "No reason provided"}`
        );
      }
    }

    // Audit log
    await AuditLog.create({
      actorId: req.user._id,
      action: `owner_revoked_release_${release._id}`,
    });

    res.status(200).json({ message: "Release successfully revoked", release });
  } catch (err) {
    res.status(500).json({ message: "Error revoking release", error: err.message });
  }
};

