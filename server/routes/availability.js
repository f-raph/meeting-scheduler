const express = require('express');
const { body, validationResult } = require('express-validator');
const Availability = require('../models/Availability');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get all availability (public route)
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    
    let query = { isActive: true };
    
    // If specific date is provided, include both regular weekly availability and date-specific overrides
    if (date) {
      const targetDate = new Date(date);
      const dayOfWeek = targetDate.getDay();
      
      query = {
        $or: [
          { dayOfWeek, isActive: true, specificDate: null },
          { specificDate: { $gte: new Date(date), $lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000) }, isActive: true }
        ]
      };
    }

    const availability = await Availability.find(query).sort({ dayOfWeek: 1, startTime: 1 });

    // Group by day of week for easier frontend handling
    const groupedAvailability = availability.reduce((acc, slot) => {
      const key = slot.specificDate ? 'specific' : slot.dayOfWeek;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(slot);
      return acc;
    }, {});

    res.json({ availability: groupedAvailability });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ error: 'Failed to get availability' });
  }
});

// Get availability by day of week
router.get('/day/:dayOfWeek', async (req, res) => {
  try {
    const { dayOfWeek } = req.params;
    
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({ error: 'Day of week must be between 0 (Sunday) and 6 (Saturday)' });
    }

    const availability = await Availability.find({
      dayOfWeek: parseInt(dayOfWeek),
      isActive: true,
      specificDate: null
    }).sort({ startTime: 1 });

    res.json({ availability });
  } catch (error) {
    console.error('Get day availability error:', error);
    res.status(500).json({ error: 'Failed to get day availability' });
  }
});

// Admin routes (require authentication and admin role)

// Create availability slot
router.post('/', auth, adminAuth, [
  body('dayOfWeek').isInt({ min: 0, max: 6 }),
  body('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('timezone').optional().trim(),
  body('specificDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { dayOfWeek, startTime, endTime, timezone, specificDate, breakTimes } = req.body;

    // Validate that end time is after start time
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    if ((endHour * 60 + endMin) <= (startHour * 60 + startMin)) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    // Check for conflicts
    const query = {
      dayOfWeek: parseInt(dayOfWeek),
      isActive: true,
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime }
        }
      ]
    };

    if (specificDate) {
      query.specificDate = new Date(specificDate);
    } else {
      query.specificDate = null;
    }

    const conflictingSlot = await Availability.findOne(query);
    if (conflictingSlot) {
      return res.status(400).json({ error: 'Time slot conflicts with existing availability' });
    }

    const availability = new Availability({
      dayOfWeek: parseInt(dayOfWeek),
      startTime,
      endTime,
      timezone: timezone || 'UTC',
      specificDate: specificDate ? new Date(specificDate) : null,
      breakTimes: breakTimes || []
    });

    await availability.save();

    res.status(201).json({
      message: 'Availability created successfully',
      availability
    });
  } catch (error) {
    console.error('Create availability error:', error);
    res.status(500).json({ error: 'Failed to create availability' });
  }
});

// Update availability slot
router.put('/:id', auth, adminAuth, [
  body('startTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('endTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('timezone').optional().trim(),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startTime, endTime, timezone, isActive, breakTimes } = req.body;

    const availability = await Availability.findById(req.params.id);
    if (!availability) {
      return res.status(404).json({ error: 'Availability slot not found' });
    }

    // Validate time range if provided
    if (startTime && endTime) {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      
      if ((endHour * 60 + endMin) <= (startHour * 60 + startMin)) {
        return res.status(400).json({ error: 'End time must be after start time' });
      }
    }

    // Update fields
    if (startTime !== undefined) availability.startTime = startTime;
    if (endTime !== undefined) availability.endTime = endTime;
    if (timezone !== undefined) availability.timezone = timezone;
    if (isActive !== undefined) availability.isActive = isActive;
    if (breakTimes !== undefined) availability.breakTimes = breakTimes;

    await availability.save();

    res.json({
      message: 'Availability updated successfully',
      availability
    });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

// Delete availability slot
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const availability = await Availability.findById(req.params.id);
    if (!availability) {
      return res.status(404).json({ error: 'Availability slot not found' });
    }

    await Availability.findByIdAndDelete(req.params.id);

    res.json({ message: 'Availability deleted successfully' });
  } catch (error) {
    console.error('Delete availability error:', error);
    res.status(500).json({ error: 'Failed to delete availability' });
  }
});

module.exports = router;