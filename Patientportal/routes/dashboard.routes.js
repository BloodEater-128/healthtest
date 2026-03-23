// routes/dashboard.routes.js
import express from "express";
import {
  getDashboardSummary,
  getNotifications,
  markAllNotificationsRead,
  getVitalsHistory,
} from "../controllers/dashboard.controller.js";
import verifyToken from "../middleware/verifyToken.js";

const router = express.Router();

// All dashboard routes are protected — patient must be logged in
router.get("/summary",                      verifyToken, getDashboardSummary);       // Main dashboard data
router.get("/notifications",                verifyToken, getNotifications);           // All notifications
router.put("/notifications/mark-all-read",  verifyToken, markAllNotificationsRead);  // Mark all read
router.get("/vitals-history",               verifyToken, getVitalsHistory);           // Sparkline chart data

export default router;
