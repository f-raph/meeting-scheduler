const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    // Multi-tenant: the admin that owns this booking
    ownerAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    // Guest client information (captured during booking)
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    clientEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    clientPhone: {
      type: String,
      trim: true,
    },
    // Legacy: user account reference (optional, for backwards compatibility)
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number, // in minutes
      required: true,
      default: 60,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
    },
    meetingType: {
      type: String,
      trim: true,
    },
    // Reference to MeetingType for dynamic pricing
    meetingTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MeetingType",
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    // Payment information
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded", "failed"],
      default: "pending",
    },
    paymentIntentId: {
      type: String, // Paystack transaction reference
    },
    paymentGateway: {
      type: String,
      enum: ["paystack"],
      default: "paystack",
    },
    // Paystack subaccount code used for split payment
    subaccountCode: {
      type: String,
    },
    amount: {
      type: Number,
      required: false, // Now optional - derived from meetingTypeId
    },
    currency: {
      type: String,
      default: "GHS",
    },
    // Payment timestamps
    paidAt: {
      type: Date,
    },
    refundedAt: {
      type: Date,
    },
    refundAmount: {
      type: Number,
    },
    // Google Calendar/Meet integration
    googleEventId: {
      type: String,
    },
    meetingLink: {
      type: String,
    },
    calendarEventCreated: {
      type: Boolean,
      default: false,
    },
    // Reminders
    reminderSent: {
      type: Boolean,
      default: false,
    },
    reminderSentAt: {
      type: Date,
    },
    // Cancellation
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
    },
    // Payout tracking
    payoutStatus: {
      type: String,
      enum: ["pending", "queued", "paid"],
      default: "pending",
      index: true,
    },
    payoutBatchId: {
      type: String,
    },
    paidOutAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
bookingSchema.index({ startTime: 1, status: 1 });
bookingSchema.index({ client: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ ownerAdmin: 1, paymentStatus: 1, payoutStatus: 1 });
bookingSchema.index({ paymentIntentId: 1 }); // For payment verification lookups

// Virtual for meeting duration in hours
bookingSchema.virtual("durationHours").get(function () {
  return this.duration / 60;
});

// Method to check if booking is in the past
bookingSchema.methods.isPast = function () {
  return this.endTime < new Date();
};

// Method to check if booking is upcoming (within next 24 hours)
bookingSchema.methods.isUpcoming = function () {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return this.startTime >= now && this.startTime <= tomorrow;
};

module.exports = mongoose.model("Booking", bookingSchema);
