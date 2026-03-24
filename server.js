import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./Patientportal/routes/auth.routes.js";
import dashboardRoutes from "./Patientportal/routes/dashboard.routes.js";
import deviceRoutes from "./Patientportal/routes/device.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
  },
});

// ── Middleware ─────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json());

// ── API Routes ─────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/device", deviceRoutes);

// ── Health check ───────────────────────────
app.get("/api", (req, res) => {
  res.json({ status: "✅ API is running" });
});

// ── 🔥 SERVE FRONTEND (VERY IMPORTANT) ─────
// 👉 For Vite → use "dist"
app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ── Socket.IO ─────────────────────────────
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  socket.on("join-patient-room", (patientId) => {
    socket.join(`patient-${patientId}`);
    console.log(`👤 Joined room: patient-${patientId}`);
  });

  socket.on("vitals-update", (data) => {
    io.to(`patient-${data.patientId}`).emit("vitals-data", data);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

export { io };

// ── Server Start ───────────────────────────
const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
