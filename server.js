import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";



import authRoutes from "./Patientportal/routes/auth.routes.js";
import dashboardRoutes from "./Patientportal/routes/dashboard.routes.js";
import deviceRoutes from "./Patientportal/routes/device.routes.js";

// import patientRoutes     from "./routes/patient.routes.js";
// import doctorRoutes      from "./routes/doctor.routes.js";
// import vitalsRoutes      from "./routes/vitals.routes.js";
// import appointmentRoutes from "./routes/appointment.routes.js";
// import prescriptionRoutes from "./routes/prescription.routes.js";
// import alertRoutes       from "./routes/alert.routes.js";
// import chatRoutes        from "./routes/chat.routes.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || "http://localhost:5173", methods: ["GET", "POST"] },
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/device", deviceRoutes);
// app.use("/api/patient",       patientRoutes);
// app.use("/api/doctor",        doctorRoutes);
// app.use("/api/vitals",        vitalsRoutes);
// app.use("/api/appointments",  appointmentRoutes);
// app.use("/api/prescriptions", prescriptionRoutes);
// app.use("/api/alerts",        alertRoutes);
// app.use("/api/chat",          chatRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "✅ Remote Health Monitoring API is running" }));

// ── Real-time WebSocket (vitals monitoring) ───────────────────────────────────
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  socket.on("join-patient-room", (patientId) => {
    socket.join(`patient-${patientId}`);
    console.log(`👤 Joined room: patient-${patientId}`);
  });

  socket.on("vitals-update", (data) => {
    // Doctor sends updated vitals → broadcast to patient room
    io.to(`patient-${data.patientId}`).emit("vitals-data", data);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// Export io so controllers can emit events
export { io };

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
