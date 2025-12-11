const express = require("express");
const { body, validationResult } = require("express-validator");
const Booking = require("../models/Booking");
const User = require("../models/User");
const { auth } = require("../middleware/auth");
const googleCalendar = require("../services/googleCalendar");
const paymentService = require("../services/payment");
const flutterwaveService = require("../services/flutterwave");
const { sendBookingConfirmationEmail } = require("../services/email");

const router = express.Router();

// Initialize payment (public - guests can pay for their bookings)
router.post(
  "/initialize-payment",
  [
    body("bookingId").isMongoId(),
    body("gateway").optional().isIn(["flutterwave", "paystack"]),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { bookingId, gateway = "flutterwave" } = req.body; // Default to Flutterwave

      // Get booking
      const booking = await Booking.findById(bookingId);

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.paymentStatus === "paid") {
        return res.status(400).json({ error: "Booking is already paid" });
      }

      // Store which gateway is being used
      booking.paymentGateway = gateway;
      await booking.save();

      // Get tenant admin slug and subaccount for callback URL
      let adminSlug = null;
      let subaccountCode = null; // Paystack or Flutterwave subaccount

      if (booking.ownerAdmin) {
        const admin = await User.findById(booking.ownerAdmin).select(
          "slug paystack flutterwave"
        );
        if (admin) {
          if (admin.slug) {
            adminSlug = admin.slug;
          }

          // Use appropriate subaccount based on gateway
          if (
            gateway === "flutterwave" &&
            admin.flutterwave &&
            admin.flutterwave.subaccountId
          ) {
            subaccountCode = admin.flutterwave.subaccountId;
          } else if (
            gateway === "paystack" &&
            admin.paystack &&
            admin.paystack.subaccountCode
          ) {
            subaccountCode = admin.paystack.subaccountCode;
          }
        }
      }

      let paymentData;
      let responseData;

      // Initialize payment with the selected gateway
      if (gateway === "flutterwave") {
        paymentData = await flutterwaveService.initializePayment(
          booking.amount,
          booking.clientEmail,
          {
            bookingId: booking._id.toString(),
            clientName: booking.clientName,
            clientEmail: booking.clientEmail,
            meetingType: booking.meetingType,
            ownerAdmin: booking.ownerAdmin
              ? booking.ownerAdmin.toString()
              : null,
          },
          adminSlug,
          subaccountCode
        );

        // Flutterwave response: { status, authorization_url, tx_ref }
        if (!paymentData || !paymentData.authorization_url) {
          console.error("Invalid Flutterwave payment response:", paymentData);
          throw new Error("Invalid payment initialization response");
        }

        // Update booking with payment reference
        booking.paymentIntentId = paymentData.tx_ref;
        await booking.save();

        res.json({
          authorization_url: paymentData.authorization_url,
          reference: paymentData.tx_ref,
          gateway: "flutterwave",
        });
      } else {
        // Paystack payment
        paymentData = await paymentService.initializePayment(
          booking.amount,
          booking.clientEmail,
          {
            bookingId: booking._id.toString(),
            clientName: booking.clientName,
            clientEmail: booking.clientEmail,
            meetingType: booking.meetingType,
            ownerAdmin: booking.ownerAdmin
              ? booking.ownerAdmin.toString()
              : null,
          },
          adminSlug,
          subaccountCode
        );

        // Paystack SDK returns response.body.data
        responseData = paymentData.body?.data || paymentData.data;

        if (!responseData || !responseData.reference) {
          console.error("Invalid Paystack payment response:", paymentData);
          throw new Error("Invalid payment initialization response");
        }

        // Update booking with payment reference
        booking.paymentIntentId = responseData.reference;
        await booking.save();

        res.json({
          authorization_url: responseData.authorization_url,
          access_code: responseData.access_code,
          reference: responseData.reference,
          gateway: "paystack",
        });
      }
    } catch (error) {
      console.error("Initialize payment error:", error);
      res.status(500).json({ error: "Failed to initialize payment" });
    }
  }
);

// Verify payment (public - guests need to verify their payments)
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

      // --- STEP 1: FIND BOOKING FIRST (to determine gateway) ---
      const booking = await Booking.findOne({
        paymentIntentId: reference,
      });

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const gateway = booking.paymentGateway || "flutterwave";
      let paymentData;

      // --- STEP 2: VERIFY WITH APPROPRIATE GATEWAY ---
      if (gateway === "flutterwave") {
        paymentData = await flutterwaveService.verifyPayment(reference);

        if (paymentData.status !== "success") {
          return res.status(400).json({ error: "Payment not successful" });
        }
      } else {
        // Paystack verification
        paymentData = await paymentService.verifyPayment(reference);

        if (paymentData.data.status !== "success") {
          return res.status(400).json({ error: "Payment not successful" });
        }
      }

      // --- STEP 3: UPDATE BOOKING STATUS ---
      booking.paymentStatus = "paid";
      booking.status = "confirmed";

      // Ensure ownerAdmin is set if missing: try to load from payment metadata
      try {
        if (!booking.ownerAdmin) {
          const metadata =
            gateway === "flutterwave"
              ? paymentData.data?.metadata
              : paymentData.data?.metadata;
          if (metadata?.ownerAdmin) {
            booking.ownerAdmin = metadata.ownerAdmin;
          }
        }
      } catch (e) {
        // non-fatal
      }

      // --- STEP 4: PAYSTACK-TO-FLUTTERWAVE TRANSFER (if payment was via Paystack) ---
      if (gateway === "paystack" && booking.ownerAdmin) {
        try {
          console.log(
            "Paystack payment detected. Initiating transfer to Flutterwave..."
          );

          const admin = await User.findById(booking.ownerAdmin).select(
            "flutterwave"
          );

          if (admin && admin.flutterwave && admin.flutterwave.accountNumber) {
            // Transfer 100% of the payment amount from Paystack to tenant's Flutterwave account
            const transferResult = await flutterwaveService.transfer({
              amount: booking.amount,
              account_bank: admin.flutterwave.accountBank,
              account_number: admin.flutterwave.accountNumber,
              narration: `Payment transfer for booking ${booking._id}`,
              reference: `PSFW-${booking._id}-${Date.now()}`,
            });

            console.log(
              "Paystack-to-Flutterwave transfer initiated:",
              transferResult.transfer_id
            );
          } else {
            console.warn(
              "Tenant Flutterwave account not configured. Skipping transfer."
            );
          }
        } catch (transferError) {
          console.error(
            "Paystack-to-Flutterwave transfer failed:",
            transferError.message
          );
          // Non-fatal: booking is still confirmed even if transfer fails
        }
      }

      // --- STEP 5: GOOGLE CALENDAR (try to create event if configured) ---
      try {
        console.log(
          "Attempting to create Google Calendar event for booking:",
          booking._id
        );
        // Attempt to create a calendar event and meeting link. If Google
        // OAuth isn't configured properly this will throw and we'll continue
        // without blocking the booking confirmation.
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
        console.error("Full error:", calendarError);
        // Non-fatal: continue with booking confirmation even if calendar fails
      }

      // --- STEP 6: SAVE BOOKING ---
      await booking.save();

      // --- STEP 7: SEND CONFIRMATION EMAIL ---
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

// Verify payment
// router.post(
//   "/verify-payment",
//   auth,
//   [body("reference").notEmpty()],
//   async (req, res) => {
//     try {
//       const errors = validationResult(req);
//       if (!errors.isEmpty()) {
//         return res.status(400).json({ errors: errors.array() });
//       }

//       const { reference } = req.body;

//       // Verify payment with Paystack
//       const paymentData = await paymentService.verifyPayment(reference);

//       if (paymentData.data.status !== "success") {
//         return res.status(400).json({ error: "Payment not successful" });
//       }

//       // Find booking
//       const booking = await Booking.findOne({
//         paymentIntentId: reference,
//       }).populate("client", "firstName lastName email phone timezone");

//       if (!booking) {
//         return res.status(404).json({ error: "Booking not found" });
//       }

//       // Check if user owns this booking
//       if (booking.client._id.toString() !== req.user.userId) {
//         return res.status(403).json({ error: "Access denied" });
//       }

//       // Update booking status
//       booking.paymentStatus = "paid";
//       booking.status = "confirmed";

//       // Create Google Calendar event and meeting link
//       try {
//         const calendarEvent = await googleCalendar.createEvent({
//           startTime: booking.startTime,
//           endTime: booking.endTime,
//           title: `Meeting with ${booking.client.firstName} ${booking.client.lastName}`,
//           description: booking.description || "",
//           attendeeEmail: booking.client.email,
//           clientName: `${booking.client.firstName} ${booking.client.lastName}`,
//           meetingType: booking.meetingType,
//         });

//         booking.googleEventId = calendarEvent.id;
//         booking.meetingLink = calendarEvent.meetLink;
//         booking.calendarEventCreated = true;
//       } catch (calendarError) {
//         console.error("Calendar event creation error:", calendarError);
//         // Continue with booking confirmation even if calendar fails
//       }

//       await booking.save();

//       res.json({
//         message: "Payment verified and booking confirmed",
//         booking: {
//           id: booking._id,
//           status: booking.status,
//           paymentStatus: booking.paymentStatus,
//           meetingLink: booking.meetingLink,
//           startTime: booking.startTime,
//           endTime: booking.endTime,
//         },
//       });
//     } catch (error) {
//       console.error("Verify payment error:", error);
//       res.status(500).json({ error: "Failed to verify payment" });
//     }
//   }
// );

// Flutterwave webhook handler
router.post("/flutterwave-webhook", express.json(), async (req, res) => {
  const signature = req.headers["verif-hash"];

  try {
    // Verify webhook signature
    if (!flutterwaveService.verifyWebhookSignature(req.body, signature)) {
      console.warn("Invalid Flutterwave webhook signature");
      return res.status(401).send("Invalid signature");
    }

    const event = req.body;

    // Handle the event
    if (event.event === "charge.completed") {
      const paymentData = event.data;

      // Only process successful payments
      if (paymentData.status === "successful") {
        try {
          const booking = await Booking.findOne({
            paymentIntentId: paymentData.tx_ref,
          });

          if (booking && booking.paymentStatus !== "paid") {
            booking.paymentStatus = "paid";
            booking.status = "confirmed";

            // Try to create Google Calendar event if not already created
            if (!booking.meetingLink && booking.ownerAdmin) {
              try {
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
                  booking.ownerAdmin
                );

                if (calendarEvent) {
                  booking.googleEventId = calendarEvent.eventId;
                  booking.meetingLink = calendarEvent.meetLink;
                }
              } catch (calError) {
                console.error(
                  "Failed to create calendar event from webhook:",
                  calError.message
                );
              }
            }

            await booking.save();

            // Send confirmation email
            try {
              await sendBookingConfirmationEmail(booking);
            } catch (emailError) {
              console.error(
                "Failed to send confirmation email:",
                emailError.message
              );
            }

            console.log(
              `Flutterwave payment confirmed for booking ${booking._id}`
            );
          }
        } catch (error) {
          console.error("Error processing Flutterwave payment webhook:", error);
        }
      } else if (paymentData.status === "failed") {
        try {
          const booking = await Booking.findOne({
            paymentIntentId: paymentData.tx_ref,
          });
          if (booking) {
            booking.paymentStatus = "failed";
            await booking.save();
            console.log(
              `Flutterwave payment failed for booking ${booking._id}`
            );
          }
        } catch (error) {
          console.error("Error processing failed Flutterwave webhook:", error);
        }
      }
    }

    res.json({ status: "success" });
  } catch (error) {
    console.error("Flutterwave webhook error:", error);
    res.status(400).send("Webhook error");
  }
});

// Paystack webhook handler
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["x-paystack-signature"];

    try {
      // Verify webhook signature
      if (!paymentService.verifyWebhookSignature(req.body, signature)) {
        return res.status(400).send("Invalid signature");
      }

      const event = JSON.parse(req.body);

      // Handle the event
      switch (event.event) {
        case "charge.success":
          const paymentData = event.data;

          try {
            const booking = await Booking.findOne({
              paymentIntentId: paymentData.reference,
            });

            if (booking && booking.paymentStatus !== "paid") {
              booking.paymentStatus = "paid";
              booking.status = "confirmed";
              await booking.save();

              console.log(`Payment confirmed for booking ${booking._id}`);
            }
          } catch (error) {
            console.error("Error processing payment webhook:", error);
          }
          break;

        case "charge.failed":
          const failedPayment = event.data;

          try {
            const booking = await Booking.findOne({
              paymentIntentId: failedPayment.reference,
            });
            if (booking) {
              booking.paymentStatus = "failed";
              await booking.save();

              console.log(`Payment failed for booking ${booking._id}`);
            }
          } catch (error) {
            console.error("Error processing failed payment webhook:", error);
          }
          break;

        default:
          console.log(`Unhandled event type ${event.event}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(400).send("Webhook error");
    }
  }
);

module.exports = router;
