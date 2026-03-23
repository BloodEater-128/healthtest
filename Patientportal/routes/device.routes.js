// routes/device.routes.js
import express from "express";
import {
  getDeviceStatus,
  devicePing,
  registerDevice,
} from "../controllers/device.controller.js";
import verifyToken from "../middleware/verifyToken.js";

const router = express.Router();

// GET  /api/device/status    → "Device Active" or "Device Offline" pill in topbar
router.get("/status",    verifyToken, getDeviceStatus);

// POST /api/device/ping      → device sends heartbeat every 60s
router.post("/ping",     verifyToken, devicePing);

// POST /api/device/register  → register new monitoring device
router.post("/register", verifyToken, registerDevice);

export default router;
