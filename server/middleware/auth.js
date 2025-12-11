const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ error: "Access denied. No token provided." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify user still exists and is active
    const user = await User.findById(decoded.userId).select("-password");
    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ error: "Access denied. User not found or inactive." });
    }

    // Attach rich user and tenant info for multi-tenancy
    req.user = decoded; // retains userId, role
    req.accountUser = user; // the full user document
    // tenantAdminId = admin's own id if admin; otherwise client's ownerAdmin
    req.tenantAdminId =
      user.role === "admin"
        ? user._id.toString()
        : user.ownerAdmin
        ? user.ownerAdmin.toString()
        : null;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Access denied. Invalid token." });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Access denied. Token expired." });
    }

    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
};

// Admin authorization middleware
const adminAuth = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Access denied. Admin privileges required." });
  }
  next();
};

module.exports = { auth, adminAuth };
