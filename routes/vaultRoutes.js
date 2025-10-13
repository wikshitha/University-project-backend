import express from "express";
import { createVault, getMyVaults, addItem, deleteVault, updateVault, getVaultById } from "../controllers/vaultController.js";
import { protect } from "../middlewares/authMiddleware.js"; 

const router = express.Router();

router.post("/", protect, createVault);
router.get("/", protect, getMyVaults);
router.get("/:id", protect, getVaultById);
router.post("/item", protect, addItem);
router.put("/:id", protect, updateVault);
router.delete("/:id", protect, deleteVault);

export default router;
