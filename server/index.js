const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cron = require("node-cron");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const bookingRoutes = require("./routes/bookings");
const availabilityRoutes = require("./routes/availability");
const paymentRoutes = require("./routes/payments");
const adminRoutes = require("./routes/admin");
const googleAuthRoutes = require("./routes/googleAuth");
const meetingTypesRoutes = require("./routes/meetingTypes");
// TODO: Uncomment for production deployment when webhook URL is configured in Paystack
// const webhookRoutes = require("./routes/webhooks");
const { resolveTenant } = require("./middleware/tenant");
const { initializeEmailService } = require("./services/email");
const { runDailyPayouts } = require("./services/payouts");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(morgan("combined"));
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

// TODO: Uncomment for production deployment when webhook URL is configured in Paystack
// Webhook routes MUST be registered BEFORE express.json() middleware
// because webhooks need raw body for signature verification
// app.use("/api/webhooks", webhookRoutes);

app.use(express.json());

// Database connection
mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/meeting-scheduler",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("✓ MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Initialize email service
initializeEmailService().catch((err) => {
  console.warn("⚠ Email service initialization warning:", err.message);
});

// Schedule daily payout job at 23:55 server time
cron.schedule("55 23 * * *", async () => {
  try {
    console.log("⏳ Running daily payout job...");
    const result = await runDailyPayouts();
    console.log("✅ Daily payout job complete:", JSON.stringify(result));
  } catch (err) {
    console.error("❌ Daily payout job failed:", err);
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/google-calendar", googleAuthRoutes);
app.use("/api/meeting-types", meetingTypesRoutes);

// Tenant-scoped routes via URL path slug
app.use("/api/t/:slug/auth", resolveTenant, authRoutes);
app.use("/api/t/:slug/bookings", resolveTenant, bookingRoutes);
app.use("/api/t/:slug/availability", resolveTenant, availabilityRoutes);
app.use("/api/t/:slug/payments", resolveTenant, paymentRoutes);
app.use("/api/t/:slug/admin", resolveTenant, adminRoutes);
app.use("/api/t/:slug/meeting-types", resolveTenant, meetingTypesRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Meeting Scheduler API is running" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
