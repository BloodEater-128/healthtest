// controllers/device.controller.js
// Handles the "Device Active / Offline" status pill in the topbar

import { db } from "../config/firebase.admin.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/device/status
// Returns device online/offline status for the patient
// Frontend: shows "Device Active" (green) or "Device Offline" (red/grey)
// ─────────────────────────────────────────────────────────────────────────────
export const getDeviceStatus = async (req, res) => {
  try {
    const uid = req.user.uid;

    const snap = await db.collection("devices")
      .where("patientId", "==", uid)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(200).json({
        success: true,
        device: {
          status:      "offline",
          isOnline:    false,
          lastSeen:    null,
          deviceName:  null,
          deviceId:    null,
          batteryLevel: null,
        },
      });
    }

    const device = snap.docs[0].data();

    // Consider device online if it sent a ping in the last 2 minutes
    const lastPing  = device.lastPing ? new Date(device.lastPing) : null;
    const now       = new Date();
    const diffMs    = lastPing ? now - lastPing : Infinity;
    const isOnline  = diffMs < 2 * 60 * 1000; // 2 minutes threshold

    return res.status(200).json({
      success: true,
      device: {
        status:       isOnline ? "online" : "offline",
        isOnline,
        lastSeen:     device.lastPing || null,
        deviceName:   device.deviceName || "Health Monitor",
        deviceId:     snap.docs[0].id,
        batteryLevel: device.batteryLevel || null,
      },
    });
  } catch (err) {
    console.error("❌ Device status error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/device/ping
// Device sends a ping every ~60 seconds to confirm it's still online
// Backend updates lastPing timestamp in Firestore
// ─────────────────────────────────────────────────────────────────────────────
export const devicePing = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { deviceId, batteryLevel } = req.body;

    const snap = await db.collection("devices")
      .where("patientId", "==", uid)
      .limit(1)
      .get();

    const pingData = {
      patientId:    uid,
      lastPing:     new Date().toISOString(),
      batteryLevel: batteryLevel || null,
      status:       "online",
    };

    if (snap.empty) {
      // Register new device
      await db.collection("devices").add({
        ...pingData,
        deviceName: req.body.deviceName || "Health Monitor",
        registeredAt: new Date().toISOString(),
      });
    } else {
      // Update existing device ping
      await snap.docs[0].ref.update(pingData);
    }

    return res.status(200).json({ success: true, message: "Device ping received" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/device/register
// Register a new monitoring device for a patient
// ─────────────────────────────────────────────────────────────────────────────
export const registerDevice = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { deviceName, deviceType } = req.body;

    const newDevice = {
      patientId:    uid,
      deviceName:   deviceName || "Health Monitor",
      deviceType:   deviceType || "wearable",
      status:       "offline",
      lastPing:     null,
      batteryLevel: null,
      registeredAt: new Date().toISOString(),
    };

    const ref = await db.collection("devices").add(newDevice);

    return res.status(201).json({
      success: true,
      message: "Device registered successfully",
      deviceId: ref.id,
      device: newDevice,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
