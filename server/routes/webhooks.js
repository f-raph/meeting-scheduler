const express = require("express");
const Booking = require("../models/Booking");
const User = require("../models/User");
const paymentService = require("../services/payment");
const googleCalendar = require("../services/googleCalendar");
const { sendBookingConfirmationEmail } = require("../services/email");

const router = express.Router();

/**
 * Paystack Webhook Handler
 * Route: POST /webhooks/paystack
 * 
 * Security:
 * - Verifies webhook signature using x-paystack-signature header
 * - Rejects invalid signatures with 401
 * - Double verification: verifies transaction with Paystack API
 * - Idempotent: same reference won't be processed twice
 * 
 * Handled Events:
 * - charge.success: Payment completed successfully
 * - charge.failed: Payment failed
 * - transfer.success: Payout transfer completed
 * - transfer.failed: Payout transfer failed
 * - refund.processed: Refund completed
 */
router.post(
  "/paystack",
  // Use raw body for signature verification
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["x-paystack-signature"];

    // Reject requests without signature
    if (!signature) {
      console.warn("[Webhook] Missing x-paystack-signature header");
      return res.status(401).json({ error: "Missing signature" });
    }

    try {
      // Step 1: Verify webhook signature
      const isValidSignature = paymentService.verifyWebhookSignature(
        req.body,
        signature
      );

      if (!isValidSignature) {
        console.warn("[Webhook] Invalid Paystack signature detected");
        return res.status(401).json({ error: "Invalid signature" });
      }

      // Parse the verified payload
      const payload = JSON.parse(req.body.toString());
      const { event, data } = payload;

      console.log(`[Webhook] Received event: ${event}`, {
        reference: data.reference,
        status: data.status,
      });

      // Step 2: Handle events
      switch (event) {
        case "charge.success":
          await handleChargeSuccess(data);
          break;

        case "charge.failed":
          await handleChargeFailed(data);
          break;

        case "transfer.success":
          await handleTransferSuccess(data);
          break;

        case "transfer.failed":
          await handleTransferFailed(data);
          break;

        case "refund.processed":
          await handleRefundProcessed(data);
          break;

        default:
          console.log(`[Webhook] Unhandled event type: ${event}`);
      }

      // Always respond with 200 to acknowledge receipt
      res.status(200).json({ received: true, event });
    } catch (error) {
      console.error("[Webhook] Processing error:", error);
      // Still return 200 to prevent Paystack from retrying
      // Log the error for investigation
      res.status(200).json({ received: true, error: "Processing error logged" });
    }
  }
);

/**
 * Handle successful charge event
 * - Double verifies with Paystack API
 * - Ensures idempotency (won't process same reference twice)
 * - Links payment to correct admin and tenant
 * - Creates calendar event and sends confirmation email
 */
async function handleChargeSuccess(webhookData) {
  const { reference } = webhookData;

  try {
    // Step 1: Find booking by reference
    const booking = await Booking.findOne({ paymentIntentId: reference });

    if (!booking) {
      console.log(`[Webhook] No booking found for reference: ${reference}`);
      return;
    }

    // Step 2: Idempotency check - skip if already paid
    if (booking.paymentStatus === "paid") {
      console.log(`[Webhook] Booking ${booking._id} already paid, skipping`);
      return;
    }

    // Step 3: Double verification - verify with Paystack API
    console.log(`[Webhook] Verifying transaction ${reference} with Paystack API`);
    const verification = await paymentService.verifyTransaction(reference);

    if (verification.status !== "success" || verification.data.status !== "success") {
      console.warn(`[Webhook] Transaction ${reference} verification failed:`, verification);
      return;
    }

    // Step 4: Verify amount matches (prevent amount manipulation)
    const verifiedAmount = verification.data.amount;
    const expectedAmount = booking.amount;
    
    if (Math.abs(verifiedAmount - expectedAmount) > 0.01) {
      console.error(`[Webhook] Amount mismatch for ${reference}:`, {
        expected: expectedAmount,
        received: verifiedAmount,
      });
      // Mark as suspicious but don't fail silently
      booking.paymentStatus = "failed";
      booking.notes = `Amount mismatch: expected ${expectedAmount}, received ${verifiedAmount}`;
      await booking.save();
      return;
    }

    // Step 5: Update booking status
    booking.paymentStatus = "paid";
    booking.status = "confirmed";
    booking.paidAt = new Date();

    // Step 6: Store subaccount info if payment was split
    if (verification.data.subaccount) {
      booking.subaccountCode = verification.data.subaccount.subaccount_code;
    }

    // Step 7: Link to admin using metadata
    if (!booking.ownerAdmin && verification.data.metadata?.ownerAdmin) {
      booking.ownerAdmin = verification.data.metadata.ownerAdmin;
    }

    // Step 8: Get admin details for calendar event
    let admin = null;
    if (booking.ownerAdmin) {
      admin = await User.findById(booking.ownerAdmin).select("email firstName lastName");
    }

    // Step 9: Create Google Calendar event if not already created
    if (!booking.calendarEventCreated && booking.ownerAdmin) {
      try {
        const calendarEvent = await googleCalendar.createEvent(
          {
            startTime: booking.startTime,
            endTime: booking.endTime,
            title: `Meeting with ${booking.clientName}`,
            description: booking.description || `Booking confirmed via Paystack payment`,
            attendeeEmail: booking.clientEmail,
            clientName: booking.clientName,
            meetingType: booking.meetingType,
          },
          booking.ownerAdmin.toString()
        );

        if (calendarEvent) {
          booking.googleEventId = calendarEvent.id;
          booking.meetingLink = calendarEvent.meetLink;
          booking.calendarEventCreated = true;
          console.log(`[Webhook] Calendar event created: ${calendarEvent.id}`);
        }
      } catch (calError) {
        console.error(`[Webhook] Calendar event creation failed:`, calError.message);
        // Non-fatal - booking is still confirmed
      }
    }

    // Step 10: Save booking
    await booking.save();
    console.log(`[Webhook] Booking ${booking._id} confirmed successfully`);

    // Step 11: Send confirmation email
    try {
      await sendBookingConfirmationEmail(booking);
      console.log(`[Webhook] Confirmation email sent for booking ${booking._id}`);
    } catch (emailError) {
      console.error(`[Webhook] Email sending failed:`, emailError.message);
      // Non-fatal
    }

  } catch (error) {
    console.error(`[Webhook] Error processing charge.success:`, error);
    throw error; // Re-throw to be caught by main handler
  }
}

/**
 * Handle failed charge event
 */
async function handleChargeFailed(webhookData) {
  const { reference, gateway_response } = webhookData;

  try {
    const booking = await Booking.findOne({ paymentIntentId: reference });

    if (!booking) {
      console.log(`[Webhook] No booking found for failed charge: ${reference}`);
      return;
    }

    // Only update if not already in a final state
    if (booking.paymentStatus === "paid" || booking.paymentStatus === "refunded") {
      console.log(`[Webhook] Booking ${booking._id} already in final state, skipping`);
      return;
    }

    booking.paymentStatus = "failed";
    booking.notes = gateway_response || "Payment failed";
    await booking.save();

    console.log(`[Webhook] Payment failed for booking ${booking._id}: ${gateway_response}`);
  } catch (error) {
    console.error(`[Webhook] Error processing charge.failed:`, error);
    throw error;
  }
}

/**
 * Handle successful transfer (payout) event
 */
async function handleTransferSuccess(webhookData) {
  const { reference, recipient, amount } = webhookData;

  console.log(`[Webhook] Transfer successful:`, {
    reference,
    recipient: recipient?.details?.account_name,
    amount: amount / 100, // Convert from pesewas
  });

  // Update any payout tracking records if needed
  // This can be extended based on your payout tracking requirements
}

/**
 * Handle failed transfer (payout) event
 */
async function handleTransferFailed(webhookData) {
  const { reference, reason } = webhookData;

  console.error(`[Webhook] Transfer failed:`, {
    reference,
    reason,
  });

  // Handle failed payout - potentially notify admin or retry
}

/**
 * Handle refund processed event
 */
async function handleRefundProcessed(webhookData) {
  const { transaction, amount } = webhookData;

  try {
    // Find booking by original transaction reference
    const booking = await Booking.findOne({
      paymentIntentId: transaction?.reference,
    });

    if (booking) {
      booking.paymentStatus = "refunded";
      booking.refundedAt = new Date();
      booking.refundAmount = amount / 100; // Convert from pesewas
      await booking.save();

      console.log(`[Webhook] Refund processed for booking ${booking._id}`);
    }
  } catch (error) {
    console.error(`[Webhook] Error processing refund:`, error);
    throw error;
  }
}

module.exports = router;

