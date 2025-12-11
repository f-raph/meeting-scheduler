const express = require("express");
const { google } = require("googleapis");
const User = require("../models/User");
const { auth, adminAuth } = require("../middleware/auth");

const router = express.Router();

// Initialize OAuth2 client
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.CLIENT_URL}/admin/google-calendar/callback`
  );
};

// Initiate Google Calendar OAuth flow
router.get("/connect", auth, adminAuth, (req, res) => {
  try {
    const oauth2Client = getOAuth2Client();

    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent", // Force consent screen to get refresh token
      state: req.user.userId, // Pass user ID to identify admin in callback
    });

    res.json({ authUrl });
  } catch (error) {
    console.error("Generate auth URL error:", error);
    res.status(500).json({ error: "Failed to generate authorization URL" });
  }
});

// Handle OAuth callback (this will be called by frontend after redirect)
router.post("/callback", auth, adminAuth, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Authorization code is required" });
    }

    const oauth2Client = getOAuth2Client();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Update admin user with Google Calendar credentials
    const admin = await User.findById(req.user.userId);

    if (!admin || admin.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Only admins can connect Google Calendar" });
    }

    admin.googleCalendar = {
      connected: true,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry: new Date(tokens.expiry_date),
      calendarId: "primary",
      scope: tokens.scope ? tokens.scope.split(" ") : [],
    };

    await admin.save();

    res.json({
      message: "Google Calendar connected successfully",
      connected: true,
      expiresAt: tokens.expiry_date,
    });
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.status(500).json({ error: "Failed to connect Google Calendar" });
  }
});

// Check connection status
router.get("/status", auth, adminAuth, async (req, res) => {
  try {
    const admin = await User.findById(req.user.userId).select(
      "+googleCalendar"
    );

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    res.json({
      connected: admin.googleCalendar?.connected || false,
      expiresAt: admin.googleCalendar?.tokenExpiry,
      calendarId: admin.googleCalendar?.calendarId,
    });
  } catch (error) {
    console.error("Get connection status error:", error);
    res.status(500).json({ error: "Failed to get connection status" });
  }
});

// Disconnect Google Calendar
router.post("/disconnect", auth, adminAuth, async (req, res) => {
  try {
    const admin = await User.findById(req.user.userId);

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    admin.googleCalendar = {
      connected: false,
      accessToken: null,
      refreshToken: null,
      tokenExpiry: null,
      calendarId: "primary",
      scope: [],
    };

    await admin.save();

    res.json({
      message: "Google Calendar disconnected successfully",
      connected: false,
    });
  } catch (error) {
    console.error("Disconnect error:", error);
    res.status(500).json({ error: "Failed to disconnect Google Calendar" });
  }
});

// Refresh access token (internal use)
router.post("/refresh", auth, adminAuth, async (req, res) => {
  try {
    const admin = await User.findById(req.user.userId).select(
      "+googleCalendar.refreshToken"
    );

    if (!admin || !admin.googleCalendar?.refreshToken) {
      return res.status(400).json({ error: "No refresh token available" });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: admin.googleCalendar.refreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    admin.googleCalendar.accessToken = credentials.access_token;
    admin.googleCalendar.tokenExpiry = new Date(credentials.expiry_date);

    await admin.save();

    res.json({
      message: "Token refreshed successfully",
      expiresAt: credentials.expiry_date,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});

module.exports = router;
