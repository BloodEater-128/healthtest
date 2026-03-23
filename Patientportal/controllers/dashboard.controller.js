// controllers/dashboard.controller.js
import { db } from "../config/firebase.admin.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/summary
// Returns everything the patient dashboard needs in one call:
// profile, vitals, alerts, prescriptions, doctor info, device status
// ─────────────────────────────────────────────────────────────────────────────
export const getDashboardSummary = async (req, res) => {
  try {
    const uid = req.user.uid;

    // 1. Patient profile
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: "Patient not found" });
    }
    const patient = userDoc.data();

    // 2. Latest vitals
    const vitalsSnap = await db.collection("vitals").where("patientId", "==", uid).get();
    const vitalsDocs = vitalsSnap.docs.map(d => d.data());
    vitalsDocs.sort((a, b) => new Date(b.recordedAt || 0) - new Date(a.recordedAt || 0));
    const latestVitals = vitalsDocs.length ? vitalsDocs[0] : null;

    // 3. Unread alerts (last 4)
    const alertsSnap = await db.collection("alerts").where("patientId", "==", uid).get();
    let alerts = alertsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    alerts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    alerts = alerts.slice(0, 4);
    const unreadCount = alerts.filter(a => !a.read).length;

    // 4. Active prescriptions
    const rxSnap = await db.collection("prescriptions").where("patientId", "==", uid).get();
    let prescriptions = rxSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    prescriptions = prescriptions.filter(p => p.status === "active");
    prescriptions.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    prescriptions = prescriptions.slice(0, 5);

    // 5. Assigned doctor info
    let doctor = null;
    if (patient.assignedDoctorId) {
      const drDoc = await db.collection("users").doc(patient.assignedDoctorId).get();
      if (drDoc.exists) doctor = drDoc.data();
    }

    // 6. Upcoming appointment
    const now = new Date().toISOString();
    const apptSnap = await db.collection("appointments").where("patientId", "==", uid).get();
    let appts = apptSnap.docs.map(d => d.data());
    appts = appts.filter(a => a.status === "confirmed" && (a.date || "") >= now);
    appts.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    const nextAppointment = appts.length ? appts[0] : null;

    // 7. Device status
    const deviceSnap = await db.collection("devices")
      .where("patientId", "==", uid)
      .limit(1)
      .get();
    const device = deviceSnap.empty ? null : deviceSnap.docs[0].data();

    return res.status(200).json({
      success: true,
      data: {
        patient,
        latestVitals,
        alerts,
        unreadCount,
        prescriptions,
        doctor,
        nextAppointment,
        device,
      },
    });
  } catch (err) {
    console.error("❌ Dashboard summary error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/notifications
// Returns all notifications for the patient (unread + read)
// ─────────────────────────────────────────────────────────────────────────────
export const getNotifications = async (req, res) => {
  try {
    const uid = req.user.uid;

    const snap = await db.collection("notifications").where("patientId", "==", uid).get();
    let notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    notifications.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    notifications = notifications.slice(0, 30);
    const unreadCount   = notifications.filter(n => n.unread).length;

    return res.status(200).json({ success: true, data: notifications, unreadCount });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/dashboard/notifications/mark-all-read
// Marks all notifications as read
// ─────────────────────────────────────────────────────────────────────────────
export const markAllNotificationsRead = async (req, res) => {
  try {
    const uid = req.user.uid;

    const snap = await db.collection("notifications")
      .where("patientId", "==", uid)
      .where("unread", "==", true)
      .get();

    const batch = db.batch();
    snap.docs.forEach(doc => batch.update(doc.ref, { unread: false }));
    await batch.commit();

    return res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/vitals-history
// Returns last 16 vitals readings for sparkline charts
// ─────────────────────────────────────────────────────────────────────────────
export const getVitalsHistory = async (req, res) => {
  try {
    const uid = req.user.uid;

    const snap = await db.collection("vitals").where("patientId", "==", uid).get();
    let vitals = snap.docs.map(d => d.data());
    vitals.sort((a, b) => new Date(b.recordedAt || 0) - new Date(a.recordedAt || 0));
    vitals = vitals.slice(0, 16).reverse(); // oldest first for charts

    const hrHistory   = vitals.map(v => v.heartRate   || 72);
    const spo2History = vitals.map(v => v.spo2         || 98);
    const tempHistory = vitals.map(v => v.temperature  || 36.6);
    const bpHistory   = vitals.map(v => parseInt(v.bloodPressure?.split("/")[0]) || 118);

    return res.status(200).json({
      success: true,
      data: { hrHistory, spo2History, tempHistory, bpHistory },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
