const User = require("../models/User");

/**
 * Resolve tenant admin by slug from path param or header.
 * - Looks at req.params.slug, then 'x-tenant-slug' header, then ?tenant query
 * - When found, sets req.tenantAdminId and req.tenantAdmin
 */
async function resolveTenant(req, res, next) {
  try {
    const slug =
      (req.params && req.params.slug) ||
      req.headers["x-tenant-slug"] ||
      req.query.tenant;

    if (!slug) {
      return res.status(400).json({ error: "Tenant slug is required" });
    }

    const admin = await User.findOne({
      slug: String(slug).toLowerCase(),
      role: "admin",
      isActive: true,
    });
    if (!admin) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    req.tenantAdminId = admin._id.toString();
    req.tenantAdmin = admin;
    next();
  } catch (err) {
    console.error("Tenant resolution error:", err);
    res.status(500).json({ error: "Failed to resolve tenant" });
  }
}

module.exports = { resolveTenant };
