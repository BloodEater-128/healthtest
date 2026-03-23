// middleware/verifyToken.js
import { auth } from "../config/firebase.admin.js";

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Unauthorized: No token provided" });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decoded = await auth.verifyIdToken(token);
    req.user = decoded; // uid, email available in controllers
    next();
  } catch (err) {
    if (err.code === "auth/id-token-expired") {
      return res.status(401).json({ success: false, error: "Session expired. Please login again." });
    }
    return res.status(401).json({ success: false, error: "Unauthorized: Invalid token" });
  }
};

export default verifyToken;
