const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
  dayOfWeek: {
    type: Number, // 0 = Sunday, 1 = Monday, etc.
    required: true,
    min: 0,
    max: 6
  },
  startTime: {
    type: String, // Format: "HH:MM" (24-hour format)
    required: true,
    validate: {
      validator: function(v) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Start time must be in HH:MM format'
    }
  },
  endTime: {
    type: String, // Format: "HH:MM" (24-hour format)
    required: true,
    validate: {
      validator: function(v) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'End time must be in HH:MM format'
    }
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // For specific date overrides
  specificDate: {
    type: Date,
    default: null
  },
  // Break times within the availability window
  breakTimes: [{
    startTime: {
      type: String,
      validate: {
        validator: function(v) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Break start time must be in HH:MM format'
      }
    },
    endTime: {
      type: String,
      validate: {
        validator: function(v) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Break end time must be in HH:MM format'
      }
    },
    description: String
  }]
}, {
  timestamps: true
});

// Index for efficient querying
availabilitySchema.index({ dayOfWeek: 1, isActive: 1 });
availabilitySchema.index({ specificDate: 1 });

// Method to get availability in minutes
availabilitySchema.methods.getTotalMinutes = function() {
  const [startHour, startMin] = this.startTime.split(':').map(Number);
  const [endHour, endMin] = this.endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  // Calculate break time
  const breakMinutes = this.breakTimes.reduce((total, breakTime) => {
    const [breakStartHour, breakStartMin] = breakTime.startTime.split(':').map(Number);
    const [breakEndHour, breakEndMin] = breakTime.endTime.split(':').map(Number);
    
    const breakStart = breakStartHour * 60 + breakStartMin;
    const breakEnd = breakEndHour * 60 + breakEndMin;
    
    return total + (breakEnd - breakStart);
  }, 0);
  
  return (endMinutes - startMinutes) - breakMinutes;
};

// Static method to get day name
availabilitySchema.statics.getDayName = function(dayOfWeek) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek];
};

module.exports = mongoose.model('Availability', availabilitySchema);