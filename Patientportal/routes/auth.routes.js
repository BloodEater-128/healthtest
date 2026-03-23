// routes/auth.routes.js
import express from "express";
import {
  loginUser,
  signup,
  googleSignIn,
  getMe,
  resetPassword,
} from "../controllers/auth.controller.js";
import verifyToken from "../middleware/verifyToken.js";

const router = express.Router();

// ── Public routes (no token needed) ──────────────────────────────────────────
// POST /api/auth/login          → handleLogin() in login.jsx
router.post("/login", loginUser);

// POST /api/auth/signup         → handleSignup() in login.jsx
router.post("/signup", signup);

// POST /api/auth/google         → handleGoogleSignIn() in login.jsx
router.post("/google", googleSignIn);

// POST /api/auth/reset-password → handleForgotPassword() in login.jsx
router.post("/reset-password", resetPassword);

// ── Protected routes (token required) ────────────────────────────────────────
// GET /api/auth/me              → get current user profile
router.get("/me", verifyToken, getMe);

export default router;
