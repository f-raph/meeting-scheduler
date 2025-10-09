const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // in minutes
    required: true,
    default: 60
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  meetingType: {
    type: String,
    enum: ['consultation', 'follow-up', 'project-discussion'],
    default: 'consultation'
  },
  description: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  // Payment information
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'failed'],
    default: 'pending'
  },
  paymentIntentId: {
    type: String
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'usd'
  },
  // Google Calendar/Meet integration
  googleEventId: {
    type: String
  },
  meetingLink: {
    type: String
  },
  calendarEventCreated: {
    type: Boolean,
    default: false
  },
  // Reminders
  reminderSent: {
    type: Boolean,
    default: false
  },
  reminderSentAt: {
    type: Date
  },
  // Cancellation
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String
  }
}, {
  timestamps: true
});

// Index for efficient querying
bookingSchema.index({ startTime: 1, status: 1 });
bookingSchema.index({ client: 1 });
bookingSchema.index({ paymentStatus: 1 });

// Virtual for meeting duration in hours
bookingSchema.virtual('durationHours').get(function() {
  return this.duration / 60;
});

// Method to check if booking is in the past
bookingSchema.methods.isPast = function() {
  return this.endTime < new Date();
};

// Method to check if booking is upcoming (within next 24 hours)
bookingSchema.methods.isUpcoming = function() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return this.startTime >= now && this.startTime <= tomorrow;
};

module.exports = mongoose.model('Booking', bookingSchema);