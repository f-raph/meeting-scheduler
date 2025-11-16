const express = require("express");
const { body, validationResult } = require("express-validator");
const Booking = require("../models/Booking");
const User = require("../models/User");
const { auth } = require("../middleware/auth");
const googleCalendar = require("../services/googleCalendar");
const paymentService = require("../services/payment");
const { sendBookingCancellationEmail } = require("../services/email");

const router = express.Router();

// Get available time slots
router.get("/available-slots", async (req, res) => {
  try {
    const { date, duration = 60 } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    const availableSlots = await googleCalendar.getAvailableSlots(
      date,
      parseInt(duration)
    );

    res.json({ availableSlots });
  } catch (error) {
    console.error("Get available slots error:", error);
    res.status(500).json({ error: "Failed to get available slots" });
  }
});

// Create a new booking
router.post(
  "/",
  auth,
  [
    body("startTime").isISO8601(),
    body("endTime").isISO8601(),
    body("meetingType")
      .optional()
      .isIn(["consultation", "follow-up", "project-discussion"]),
    body("description").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { startTime, endTime, meetingType, description } = req.body;

      // Validate booking time
      const start = new Date(startTime);
      const end = new Date(endTime);
      const duration = (end - start) / (1000 * 60); // duration in minutes

      if (start <= new Date()) {
        return res
          .status(400)
          .json({ error: "Cannot book meetings in the past" });
      }

      if (duration < 30 || duration > 180) {
        return res
          .status(400)
          .json({
            error: "Meeting duration must be between 30 and 180 minutes",
          });
      }

      // Check for conflicts
      const conflictingBooking = await Booking.findOne({
        $or: [
          {
            startTime: { $lt: end },
            endTime: { $gt: start },
          },
        ],
        status: { $in: ["confirmed", "pending"] },
      });

      if (conflictingBooking) {
        return res.status(400).json({ error: "Time slot is not available" });
      }

      // Create booking
      const booking = new Booking({
        client: req.user.userId,
        startTime: start,
        endTime: end,
        duration,
        meetingType: meetingType || "consultation",
        description,
        amount: parseFloat(process.env.MEETING_FEE) || 50.0,
      });

      await booking.save();

      // Populate client information
      await booking.populate("client", "firstName lastName email phone");

      res.status(201).json({
        message: "Booking created successfully",
        booking,
      });
    } catch (error) {
      console.error("Create booking error:", error);
      res.status(500).json({ error: "Failed to create booking" });
    }
  }
);

// Get user's bookings
router.get("/my-bookings", auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { client: req.user.userId };
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate("client", "firstName lastName email")
      .sort({ startTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments(query);

    res.json({
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get bookings error:", error);
    res.status(500).json({ error: "Failed to get bookings" });
  }
});

// Get specific booking
router.get("/:id", auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate(
      "client",
      "firstName lastName email phone"
    );

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Check if user owns this booking or is admin
    if (
      booking.client._id.toString() !== req.user.userId &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ booking });
  } catch (error) {
    console.error("Get booking error:", error);
    res.status(500).json({ error: "Failed to get booking" });
  }
});

// Cancel booking
router.put(
  "/:id/cancel",
  auth,
  [body("reason").optional().trim()],
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Check if user owns this booking
      if (booking.client.toString() !== req.user.userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (booking.status === "cancelled") {
        return res.status(400).json({ error: "Booking is already cancelled" });
      }

      // Check if booking can be cancelled (at least 24 hours before)
      const hoursUntilMeeting =
        (booking.startTime - new Date()) / (1000 * 60 * 60);
      if (hoursUntilMeeting < 24) {
        return res
          .status(400)
          .json({
            error:
              "Bookings can only be cancelled at least 24 hours in advance",
          });
      }

      // Update booking
      booking.status = "cancelled";
      booking.cancelledAt = new Date();
      booking.cancellationReason = req.body.reason;

      await booking.save();

      // Process refund if payment was completed
      if (booking.paymentStatus === "paid") {
        try {
          await paymentService.processRefund(booking.paymentIntentId);
          booking.paymentStatus = "refunded";
          await booking.save();
        } catch (refundError) {
          console.error("Refund error:", refundError);
          // Continue with cancellation even if refund fails
        }
      }

      // Cancel Google Calendar event
      if (booking.googleEventId) {
        try {
          await googleCalendar.cancelEvent(booking.googleEventId);
        } catch (calendarError) {
          console.error("Calendar cancellation error:", calendarError);
        }
      }

      // Send cancellation email
      const user = await User.findById(booking.client);
      if (user) {
        sendBookingCancellationEmail(booking, user, req.body.reason).catch(
          (err) => {
            console.error("Email sending failed (non-fatal):", err.message);
          }
        );
      }

      res.json({
        message: "Booking cancelled successfully",
        booking,
      });
    } catch (error) {
      console.error("Cancel booking error:", error);
      res.status(500).json({ error: "Failed to cancel booking" });
    }
  }
);

module.exports = router;
