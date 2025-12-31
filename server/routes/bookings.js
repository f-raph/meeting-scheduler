const express = require("express");
const { body, validationResult } = require("express-validator");
const Booking = require("../models/Booking");
const User = require("../models/User");
const MeetingType = require("../models/MeetingType");
const { auth } = require("../middleware/auth");
const googleCalendar = require("../services/googleCalendar");
const paymentService = require("../services/payment");
const { sendBookingCancellationEmail } = require("../services/email");

const router = express.Router();

// Get available time slots
router.get("/available-slots", async (req, res) => {
  try {
    const { date, duration = 60, adminId } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    const availableSlots = await googleCalendar.getAvailableSlots(
      date,
      parseInt(duration),
      req.tenantAdminId || adminId || null
    );

    res.json({ availableSlots });
  } catch (error) {
    console.error("Get available slots error:", error);
    res.status(500).json({ error: "Failed to get available slots" });
  }
});

// Create a new booking (guest-accessible, no auth required)
router.post(
  "/",
  [
    body("startTime").isISO8601(),
    body("endTime").isISO8601(),
    body("clientName").trim().notEmpty().withMessage("Client name is required"),
    body("clientEmail")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("clientPhone").optional().trim(),
    body("meetingTypeId").optional().isMongoId(),
    body("meetingType").optional().trim(),
    body("description").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error("Validation errors:", errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        startTime,
        endTime,
        clientName,
        clientEmail,
        clientPhone,
        meetingTypeId,
        meetingType,
        description,
        adminId,
      } = req.body;

      // Validate booking time
      const start = new Date(startTime);
      const end = new Date(endTime);
      let duration = (end - start) / (1000 * 60); // duration in minutes

      if (start <= new Date()) {
        return res
          .status(400)
          .json({ error: "Cannot book meetings in the past" });
      }

      // Determine tenant admin for this booking
      let ownerAdminId = req.tenantAdminId;
      if (!ownerAdminId) {
        // allow explicit adminId from client if not derivable
        if (adminId) ownerAdminId = adminId;
      }
      if (!ownerAdminId) {
        return res
          .status(400)
          .json({ error: "Admin context required to create booking" });
      }

      // Fetch meeting type for price and duration
      let amount = parseFloat(process.env.MEETING_FEE) || 50; // Default fallback
      let currency = "GHS";

      if (meetingTypeId) {
        const selectedMeetingType = await MeetingType.findOne({
          _id: meetingTypeId,
          ownerAdmin: ownerAdminId,
          isActive: true,
        });

        if (!selectedMeetingType) {
          return res
            .status(404)
            .json({ error: "Meeting type not found or inactive" });
        }

        amount = selectedMeetingType.price;
        currency = selectedMeetingType.currency;
        duration = selectedMeetingType.duration; // Use meeting type's duration

        // Recalculate end time based on meeting type duration
        end.setMinutes(start.getMinutes() + duration);
      }

      if (duration < 15 || duration > 480) {
        return res.status(400).json({
          error: "Meeting duration must be between 15 and 480 minutes",
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
        ownerAdmin: ownerAdminId,
      });

      if (conflictingBooking) {
        return res.status(400).json({ error: "Time slot is not available" });
      }

      // Create booking with guest client info
      const booking = new Booking({
        ownerAdmin: ownerAdminId,
        clientName,
        clientEmail,
        clientPhone,
        startTime: start,
        endTime: end,
        duration,
        meetingType: meetingType || "consultation",
        meetingTypeId: meetingTypeId || null,
        description,
        amount,
        currency,
      });

      await booking.save();

      // For free meetings (amount = 0), auto-confirm and create calendar event
      if (amount === 0) {
        booking.paymentStatus = "paid"; // Mark as paid since it's free
        booking.status = "confirmed";

        // Create Google Calendar event for free meetings
        try {
          const calendarEvent = await googleCalendar.createEvent(
            {
              startTime: start,
              endTime: end,
              title: `${meetingType || "Meeting"} with ${clientName}`,
              description:
                description || "Meeting scheduled via booking system",
              attendeeEmail: clientEmail,
              clientName: clientName,
              meetingType: meetingType || "consultation",
            },
            ownerAdminId
          );

          if (calendarEvent) {
            booking.googleEventId = calendarEvent.id;
            booking.meetingLink = calendarEvent.meetLink;
            booking.calendarEventCreated = true;
          }
        } catch (calError) {
          console.error(
            "Calendar event creation error for free meeting:",
            calError
          );
          // Don't fail the booking if calendar creation fails
        }

        await booking.save();
      }

      res.status(201).json({
        message: "Booking created successfully",
        booking,
        isFree: amount === 0,
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

// Get specific booking (admin or guest with booking ID)
router.get("/:id", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // If authenticated, check if user is the admin
    if (req.user && req.user.role === "admin") {
      if (booking.ownerAdmin?.toString() !== req.user.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    // For guests, allow access (they have the booking ID)

    res.json({ booking });
  } catch (error) {
    console.error("Get booking error:", error);
    res.status(500).json({ error: "Failed to get booking" });
  }
});

// Cancel booking (admin or guest with booking ID)
router.put(
  "/:id/cancel",
  [body("reason").optional().trim()],
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // If authenticated, check if user is the admin
      if (req.user && req.user.role === "admin") {
        if (booking.ownerAdmin?.toString() !== req.user.userId) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      // For guests, allow cancellation (they have the booking ID)

      if (booking.status === "cancelled") {
        return res.status(400).json({ error: "Booking is already cancelled" });
      }

      // Check if booking can be cancelled (at least 24 hours before)
      const hoursUntilMeeting =
        (booking.startTime - new Date()) / (1000 * 60 * 60);
      if (hoursUntilMeeting < 24) {
        return res.status(400).json({
          error: "Bookings can only be cancelled at least 24 hours in advance",
        });
      }

      // Update booking
      booking.status = "cancelled";
      booking.cancelledAt = new Date();
      booking.cancellationReason = req.body.reason;

      await booking.save();

      // Note: Refunds should be processed manually through Paystack dashboard
      // or implement Paystack's Refund API (POST /refund)
      if (booking.paymentStatus === "paid") {
        console.log(`[Booking ${booking._id}] Cancellation requested. Payment was made - refund may be needed.`);
        console.log(`  Payment Reference: ${booking.paymentIntentId}`);
        console.log(`  Process refund via Paystack dashboard if needed.`);
        // Mark as cancelled but keep payment status as 'paid' until refund is processed
      }

      // Cancel Google Calendar event
      if (booking.googleEventId) {
        try {
          await googleCalendar.cancelEvent(
            booking.googleEventId,
            booking.ownerAdmin ? booking.ownerAdmin.toString() : null
          );
        } catch (calendarError) {
          console.error("Calendar cancellation error:", calendarError);
        }
      }

      // Send cancellation email to guest
      sendBookingCancellationEmail(booking, req.body.reason).catch((err) => {
        console.error("Email sending failed (non-fatal):", err.message);
      });

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
