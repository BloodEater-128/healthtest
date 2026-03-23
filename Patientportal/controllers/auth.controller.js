// controllers/auth.controller.js
// ✅ Uses ONLY Firebase Admin SDK — no client SDK in backend
import { auth, db } from "../config/firebase.admin.js";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
export const loginUser = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "No token provided" });
    }

    const idToken = authHeader.split("Bearer ")[1];

    // ✅ Verify token using Firebase Admin SDK
    const decoded = await auth.verifyIdToken(idToken);
    const { uid, email } = decoded;

    // ✅ Fetch user role from Firestore "users" collection
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "User profile not found. Please sign up first.",
      });
    }

    const userData = userDoc.data();

    // ✅ Check role from Firestore — block wrong portal access
    const { role: portalRole } = req.body; // "patient" or "doctor" sent from frontend
    if (portalRole && userData.role !== portalRole) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Please use the ${userData.role === "doctor" ? "Doctor" : "Patient"} portal.`,
      });
    }

    // ✅ Update last login
    await db.collection("users").doc(uid).set(
      { lastLogin: new Date().toISOString() },
      { merge: true }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        uid,
        email,
        name:      userData.name,
        role:      userData.role,       // ✅ role read from Firestore
        patientId: userData.patientId || null,
        lastLogin: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error.message);

    // Show specific error message for expired/invalid token
    if (error.code === "auth/id-token-expired") {
      return res.status(401).json({ success: false, error: "Session expired. Please login again." });
    }
    if (error.code === "auth/argument-error") {
      return res.status(401).json({ success: false, error: "Invalid token format." });
    }

    return res.status(401).json({ success: false, error: "Authentication failed: " + error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/signup
// ─────────────────────────────────────────────────────────────────────────────
export const signup = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "No token provided" });
    }

    const idToken = authHeader.split("Bearer ")[1];

    // ✅ Verify the token — confirms Firebase user was created successfully
    const decoded = await auth.verifyIdToken(idToken);
    const { uid, email } = decoded;

    const { name, role = "patient", patientId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Full name is required" });
    }

    // Check if profile already exists
    const existing = await db.collection("users").doc(uid).get();
    if (existing.exists) {
      return res.status(409).json({ success: false, error: "Account already exists. Please login." });
    }

    // ✅ Save new user profile to Firestore "users" collection
    const newUser = {
      uid,
      email,
      name:      name.trim(),
      role,                           // "patient" or "doctor"
      patientId: patientId?.trim() || null,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      provider:  "email",
    };

    await db.collection("users").doc(uid).set(newUser);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      user:    newUser,
    });
  } catch (error) {
    console.error("❌ Signup error:", error.message);
    return res.status(500).json({ success: false, error: "Signup failed: " + error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/google
// ─────────────────────────────────────────────────────────────────────────────
export const googleSignIn = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "No token provided" });
    }

    const idToken = authHeader.split("Bearer ")[1];

    // ✅ Verify Google token with Firebase Admin
    const decoded = await auth.verifyIdToken(idToken);
    const { uid, email, name } = decoded;

    const { role: portalRole = "patient" } = req.body;

    const userDocRef  = db.collection("users").doc(uid);
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      // ✅ New Google user — create profile in Firestore
      const newUser = {
        uid,
        email,
        name:      name || email.split("@")[0],
        role:      portalRole,
        patientId: null,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        provider:  "google",
      };
      await userDocRef.set(newUser);

      return res.status(201).json({
        success: true, isNewUser: true,
        message: "Google account registered successfully",
        user:    newUser,
      });
    }

    // Existing user
    const userData = userDocSnap.data();

    // ✅ Block if wrong portal
    if (userData.role !== portalRole) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Please use the ${userData.role === "doctor" ? "Doctor" : "Patient"} portal.`,
      });
    }

    await userDocRef.set({ lastLogin: new Date().toISOString() }, { merge: true });

    return res.status(200).json({
      success: true, isNewUser: false,
      message: "Google sign-in successful",
      user: {
        uid, email,
        name:      userData.name,
        role:      userData.role,
        patientId: userData.patientId || null,
      },
    });
  } catch (error) {
    console.error("❌ Google sign-in error:", error.message);
    return res.status(401).json({ success: false, error: "Google sign-in failed: " + error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me  (protected)
// ─────────────────────────────────────────────────────────────────────────────
export const getMe = async (req, res) => {
  try {
    const { uid } = req.user;
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    return res.status(200).json({ success: true, user: userDoc.data() });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────────────────────
export const resetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    // ✅ Check user exists in Firestore
    const snap = await db.collection("users").where("email", "==", email.trim()).get();
    if (snap.empty) {
      return res.status(404).json({ success: false, error: "No account found with this email" });
    }

    // ✅ Generate reset link using Firebase Admin
    await auth.generatePasswordResetLink(email.trim());

    return res.status(200).json({
      success: true,
      message: "Password reset email sent. Please check your inbox.",
    });
  } catch (error) {
    console.error("❌ Reset password error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to send reset email" });
  }
};
