const express = require('express');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(auth);
router.use(adminAuth);

// Get dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));

    // Basic statistics
    const [
      totalBookings,
      totalClients,
      monthlyBookings,
      weeklyBookings,
      pendingBookings,
      confirmedBookings,
      monthlyRevenue
    ] = await Promise.all([
      Booking.countDocuments(),
      User.countDocuments({ role: 'client' }),
      Booking.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Booking.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Booking.countDocuments({ status: 'pending' }),
      Booking.countDocuments({ status: 'confirmed' }),
      Booking.aggregate([
        {
          $match: {
            paymentStatus: 'paid',
            createdAt: { $gte: startOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ])
    ]);

    // Upcoming bookings (next 7 days)
    const upcomingBookings = await Booking.find({
      startTime: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      },
      status: { $in: ['confirmed', 'pending'] }
    })
    .populate('client', 'firstName lastName email')
    .sort({ startTime: 1 })
    .limit(5);

    // Recent bookings
    const recentBookings = await Booking.find()
      .populate('client', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      statistics: {
        totalBookings,
        totalClients,
        monthlyBookings,
        weeklyBookings,
        pendingBookings,
        confirmedBookings,
        monthlyRevenue: monthlyRevenue[0]?.total || 0
      },
      upcomingBookings,
      recentBookings
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

// Get all bookings with filters
router.get('/bookings', async (req, res) => {
  try {
    const {
      status,
      paymentStatus,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'startTime',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate);
      if (endDate) query.startTime.$lte = new Date(endDate);
    }

    // Execute query with pagination
    const bookings = await Booking.find(query)
      .populate('client', 'firstName lastName email phone')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments(query);

    res.json({
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get admin bookings error:', error);
    res.status(500).json({ error: 'Failed to get bookings' });
  }
});

// Get all clients
router.get('/clients', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    // Build query
    const query = { role: 'client' };
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const clients = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    // Get booking counts for each client
    const clientsWithBookings = await Promise.all(
      clients.map(async (client) => {
        const bookingCount = await Booking.countDocuments({ client: client._id });
        const totalSpent = await Booking.aggregate([
          {
            $match: {
              client: client._id,
              paymentStatus: 'paid'
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' }
            }
          }
        ]);

        return {
          ...client.toObject(),
          bookingCount,
          totalSpent: totalSpent[0]?.total || 0
        };
      })
    );

    res.json({
      clients: clientsWithBookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Failed to get clients' });
  }
});

// Get specific client details
router.get('/clients/:id', async (req, res) => {
  try {
    const client = await User.findById(req.params.id).select('-password');
    
    if (!client || client.role !== 'client') {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get client's bookings
    const bookings = await Booking.find({ client: client._id })
      .sort({ startTime: -1 });

    // Calculate statistics
    const stats = {
      totalBookings: bookings.length,
      confirmedBookings: bookings.filter(b => b.status === 'confirmed').length,
      cancelledBookings: bookings.filter(b => b.status === 'cancelled').length,
      totalSpent: bookings
        .filter(b => b.paymentStatus === 'paid')
        .reduce((sum, b) => sum + b.amount, 0)
    };

    res.json({
      client,
      bookings,
      statistics: stats
    });
  } catch (error) {
    console.error('Get client details error:', error);
    res.status(500).json({ error: 'Failed to get client details' });
  }
});

// Update booking status (admin only)
router.put('/bookings/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const booking = await Booking.findById(req.params.id)
      .populate('client', 'firstName lastName email');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    booking.status = status;
    if (status === 'cancelled') {
      booking.cancelledAt = new Date();
    }

    await booking.save();

    res.json({
      message: 'Booking status updated successfully',
      booking
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

// Get revenue analytics
router.get('/analytics/revenue', async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let groupBy;
    let dateRange;
    
    switch (period) {
      case 'week':
        groupBy = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' }
        };
        dateRange = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000); // 12 weeks
        break;
      case 'year':
        groupBy = {
          year: { $year: '$createdAt' }
        };
        dateRange = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000); // 5 years
        break;
      default: // month
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        dateRange = new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000); // 12 months
    }

    const revenue = await Booking.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          createdAt: { $gte: dateRange }
        }
      },
      {
        $group: {
          _id: groupBy,
          revenue: { $sum: '$amount' },
          bookings: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 }
      }
    ]);

    res.json({ revenue });
  } catch (error) {
    console.error('Get revenue analytics error:', error);
    res.status(500).json({ error: 'Failed to get revenue analytics' });
  }
});

module.exports = router;