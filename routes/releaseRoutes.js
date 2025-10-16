import express from "express";
import {
  triggerRelease,
  getReleasesForUser,
  confirmRelease,
  finalizeRelease,
  getPendingReleasesForUser,
  revokeRelease

} from "../controllers/releaseController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Trigger new release (after inactivity or manual trigger)
router.post("/trigger", protect, triggerRelease);

//  Get all releases visible to current user
router.get("/", protect, getReleasesForUser);

//  Get all pending releases visible to current user
router.get("/pending", protect, getPendingReleasesForUser);

//  Approve or reject a release
router.post("/confirm", protect, confirmRelease);

//  Finalize after time-lock
router.post("/finalize", protect, finalizeRelease);

router.post("/revoke", protect, revokeRelease);


export default router;
