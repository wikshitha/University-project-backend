import express from "express";
import {
  triggerRelease,
  getReleasesForUser,
  confirmRelease,
  finalizeRelease,
} from "../controllers/releaseController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Trigger new release (after inactivity or manual trigger)
router.post("/trigger", protect, triggerRelease);

//  Get all releases visible to current user
router.get("/", protect, getReleasesForUser);

//  Approve or reject a release
router.post("/confirm", protect, confirmRelease);

//  Finalize after time-lock
router.post("/finalize", protect, finalizeRelease);

export default router;
