const mongoose = require("mongoose");

const meetingTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      default: "GHS",
      uppercase: true,
    },
    duration: {
      type: Number, // in minutes
      required: true,
      min: 15,
      max: 480, // 8 hours max
    },
    color: {
      type: String,
      default: "#1976d2", // Material UI primary blue
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Multi-tenant: each meeting type belongs to an admin
    ownerAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for tenant isolation queries
meetingTypeSchema.index({ ownerAdmin: 1, isActive: 1 });
meetingTypeSchema.index({ ownerAdmin: 1, name: 1 });

module.exports = mongoose.model("MeetingType", meetingTypeSchema);
