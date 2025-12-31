const express = require("express");
const { body, validationResult } = require("express-validator");
const Booking = require("../models/Booking");
const User = require("../models/User");
const googleCalendar = require("../services/googleCalendar");
const paymentService = require("../services/payment");
const { sendBookingConfirmationEmail } = require("../services/email");

const router = express.Router();

/**
 * Initialize payment for a booking
 * Public endpoint - guests can pay for their bookings
 * Uses Paystack with split payments to admin's subaccount
 */
router.post(
  "/initialize-payment",
  [body("bookingId").isMongoId()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { bookingId } = req.body;

      // Get booking
      const booking = await Booking.findById(bookingId);

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.paymentStatus === "paid") {
        return res.status(400).json({ error: "Booking is already paid" });
      }

      // Get admin's slug and subaccount for split payment
      let adminSlug = null;
      let subaccountCode = null;

      if (booking.ownerAdmin) {
        const admin = await User.findById(booking.ownerAdmin).select(
          "slug paystack"
        );
        if (admin) {
          if (admin.slug) {
            adminSlug = admin.slug;
          }

          // Get admin's Paystack subaccount for split payment
          if (admin.paystack && admin.paystack.subaccountCode) {
            subaccountCode = admin.paystack.subaccountCode;
          }
        }
      }

      // Build callback URL
      const baseUrl = process.env.CLIENT_URL || "http://localhost:3000";
      const callbackUrl = adminSlug 
        ? `${baseUrl}/${adminSlug}/payment/callback`
        : `${baseUrl}/payment/callback`;

      // Initialize Paystack payment with split to admin's subaccount
      const paymentData = await paymentService.initializeTransaction({
        amount: booking.amount,
        email: booking.clientEmail,
        currency: "GHS", // Paystack integration only supports GHS
        callback_url: callbackUrl,
        metadata: {
          bookingId: booking._id.toString(),
          clientName: booking.clientName,
          clientEmail: booking.clientEmail,
          meetingType: booking.meetingType,
          ownerAdmin: booking.ownerAdmin ? booking.ownerAdmin.toString() : null,
        },
        subaccount: subaccountCode || null,
        bearer: "subaccount", // Subaccount bears Paystack fees
      });

      if (!paymentData || paymentData.status !== "success") {
        console.error("Invalid Paystack payment response:", paymentData);
        throw new Error("Invalid payment initialization response");
      }

      // Update booking with payment reference
      booking.paymentIntentId = paymentData.data.reference;
      booking.paymentGateway = "paystack";
      await booking.save();

      res.json({
        authorization_url: paymentData.data.authorization_url,
        access_code: paymentData.data.access_code,
        reference: paymentData.data.reference,
      });
    } catch (error) {
      console.error("Initialize payment error:", error);
      res.status(500).json({ error: "Failed to initialize payment" });
    }
  }
);

/**
 * Verify payment after Paystack callback
 * Public endpoint - guests need to verify their payments
 */
router.post(
  "/verify-payment",
  [body("reference").notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { reference } = req.body;

      // Find booking by payment reference
      const booking = await Booking.findOne({
        paymentIntentId: reference,
      });

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Verify payment with Paystack
      const paymentData = await paymentService.verifyTransaction(reference);

      if (paymentData.status !== "success" || paymentData.data.status !== "success") {
        return res.status(400).json({ error: "Payment not successful" });
      }

      // Idempotency check - if already paid, just return success
      if (booking.paymentStatus === "paid") {
        return res.json({
          message: "Payment already verified",
          booking: {
            id: booking._id,
            status: booking.status,
            paymentStatus: "paid",
            meetingLink: booking.meetingLink || null,
            startTime: booking.startTime,
            endTime: booking.endTime,
          },
        });
      }

      // Update booking status
      booking.paymentStatus = "paid";
      booking.status = "confirmed";
      booking.paidAt = new Date();

      // Try to get ownerAdmin from payment metadata if missing
      try {
        if (!booking.ownerAdmin && paymentData.data.metadata?.ownerAdmin) {
          booking.ownerAdmin = paymentData.data.metadata.ownerAdmin;
        }
      } catch (e) {
        // Non-fatal
      }

      // Store subaccount info if payment was split
      if (paymentData.data.subaccount) {
        booking.subaccountCode = paymentData.data.subaccount.subaccount_code;
      }

      // Create Google Calendar event if configured
      try {
        console.log(
          "Attempting to create Google Calendar event for booking:",
          booking._id
        );

        const calendarEvent = await googleCalendar.createEvent(
          {
            startTime: booking.startTime,
            endTime: booking.endTime,
            title: `Meeting with ${booking.clientName}`,
            description: booking.description || "",
            attendeeEmail: booking.clientEmail,
            clientName: booking.clientName,
            meetingType: booking.meetingType,
          },
          booking.ownerAdmin ? booking.ownerAdmin.toString() : null
        );

        if (calendarEvent) {
          console.log("Calendar event created successfully:", calendarEvent.id);
          booking.googleEventId = calendarEvent.id;
          booking.meetingLink = calendarEvent.meetLink;
          booking.calendarEventCreated = true;
        } else {
          console.warn("Calendar event creation returned null/undefined");
        }
      } catch (calendarError) {
        console.error("Calendar event creation error:", calendarError.message);
        // Non-fatal: continue with booking confirmation
      }

      // Save booking
      await booking.save();

      // Send confirmation email
      sendBookingConfirmationEmail(booking).catch((err) => {
        console.error("Email sending failed (non-fatal):", err.message);
      });

      res.json({
        message: "Payment verified and booking confirmed",
        booking: {
          id: booking._id,
          status: booking.status,
          paymentStatus: "paid",
          meetingLink: booking.meetingLink || null,
          startTime: booking.startTime,
          endTime: booking.endTime,
        },
      });
    } catch (error) {
      console.error("Verify payment error:", error);
      res.status(500).json({ error: "Failed to verify payment" });
    }
  }
);

/**
 * Get payment status by reference
 * Public endpoint - clients can check their payment status
 */
router.get("/status/:reference", async (req, res) => {
  try {
    const { reference } = req.params;

    const booking = await Booking.findOne({
      paymentIntentId: reference,
    }).select("paymentStatus status amount currency startTime endTime meetingLink");

    if (!booking) {
      return res.status(404).json({ error: "Payment not found" });
    }

    res.json({
      reference,
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.status,
      amount: booking.amount,
      currency: booking.currency,
      startTime: booking.startTime,
      endTime: booking.endTime,
      meetingLink: booking.meetingLink || null,
    });
  } catch (error) {
    console.error("Get payment status error:", error);
    res.status(500).json({ error: "Failed to get payment status" });
  }
});

module.exports = router;
