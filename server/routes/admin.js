const express = require("express");
const Booking = require("../models/Booking");
const User = require("../models/User");
const { auth, adminAuth } = require("../middleware/auth");
const paymentService = require("../services/payment");
const flutterwaveService = require("../services/flutterwave");
const { body, validationResult } = require("express-validator");

const router = express.Router();

// All admin routes require authentication and admin role
router.use(auth);
router.use(adminAuth);

// Get dashboard statistics
router.get("/dashboard", async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));

    // Basic statistics
    const tenant = req.tenantAdminId;
    const [
      totalBookings,
      monthlyBookings,
      weeklyBookings,
      pendingBookings,
      confirmedBookings,
      monthlyRevenue,
      uniqueClients,
    ] = await Promise.all([
      Booking.countDocuments({ ownerAdmin: tenant }),
      Booking.countDocuments({
        createdAt: { $gte: startOfMonth },
        ownerAdmin: tenant,
      }),
      Booking.countDocuments({
        createdAt: { $gte: startOfWeek },
        ownerAdmin: tenant,
      }),
      Booking.countDocuments({ status: "pending", ownerAdmin: tenant }),
      Booking.countDocuments({ status: "confirmed", ownerAdmin: tenant }),
      Booking.aggregate([
        {
          $match: {
            paymentStatus: "paid",
            createdAt: { $gte: startOfMonth },
            ownerAdmin: new (require("mongoose").Types.ObjectId)(tenant),
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]),
      Booking.aggregate([
        {
          $match: {
            ownerAdmin: new (require("mongoose").Types.ObjectId)(tenant),
          },
        },
        {
          $group: { _id: "$clientEmail" },
        },
        {
          $count: "total",
        },
      ]),
    ]);

    // Upcoming bookings (next 7 days)
    const upcomingBookings = await Booking.find({
      startTime: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      status: { $in: ["confirmed", "pending"] },
      ownerAdmin: tenant,
    })
      .sort({ startTime: 1 })
      .limit(5);

    // Recent bookings
    const recentBookings = await Booking.find({ ownerAdmin: tenant })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      statistics: {
        totalBookings,
        totalClients: uniqueClients[0]?.total || 0,
        monthlyBookings,
        weeklyBookings,
        pendingBookings,
        confirmedBookings,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
      },
      upcomingBookings,
      recentBookings,
    });
  } catch (error) {
    console.error("Get dashboard error:", error);
    res.status(500).json({ error: "Failed to get dashboard data" });
  }
});

// Get all bookings with filters
router.get("/bookings", async (req, res) => {
  try {
    const {
      status,
      paymentStatus,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = "startTime",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = { ownerAdmin: req.tenantAdminId };
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate);
      if (endDate) query.startTime.$lte = new Date(endDate);
    }

    // Execute query with pagination
    const bookings = await Booking.find(query)
      .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
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
    console.error("Get admin bookings error:", error);
    res.status(500).json({ error: "Failed to get bookings" });
  }
});

// Get all clients (extracted from bookings - guest info)
router.get("/clients", async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    // Aggregate unique clients from bookings
    const pipeline = [
      {
        $match: {
          ownerAdmin: new (require("mongoose").Types.ObjectId)(
            req.tenantAdminId
          ),
        },
      },
      {
        $group: {
          _id: "$clientEmail",
          clientName: { $first: "$clientName" },
          clientEmail: { $first: "$clientEmail" },
          clientPhone: { $first: "$clientPhone" },
          bookingCount: { $sum: 1 },
          totalSpent: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$amount", 0],
            },
          },
          lastBooking: { $max: "$startTime" },
          firstBooking: { $min: "$createdAt" },
        },
      },
      { $sort: { lastBooking: -1 } },
    ];

    // Add search filter if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { clientName: { $regex: search, $options: "i" } },
            { clientEmail: { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    const allClients = await Booking.aggregate(pipeline);
    const total = allClients.length;

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedClients = allClients.slice(startIndex, endIndex);

    res.json({
      clients: paginatedClients,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get clients error:", error);
    res.status(500).json({ error: "Failed to get clients" });
  }
});

// Get specific client details
router.get("/clients/:id", async (req, res) => {
  try {
    const client = await User.findById(req.params.id).select("-password");

    if (!client || client.role !== "client") {
      return res.status(404).json({ error: "Client not found" });
    }

    // Enforce tenant isolation
    if (client.ownerAdmin?.toString() !== req.tenantAdminId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get client's bookings
    const bookings = await Booking.find({
      client: client._id,
      ownerAdmin: req.tenantAdminId,
    }).sort({ startTime: -1 });

    // Calculate statistics
    const stats = {
      totalBookings: bookings.length,
      confirmedBookings: bookings.filter((b) => b.status === "confirmed")
        .length,
      cancelledBookings: bookings.filter((b) => b.status === "cancelled")
        .length,
      totalSpent: bookings
        .filter((b) => b.paymentStatus === "paid")
        .reduce((sum, b) => sum + b.amount, 0),
    };

    res.json({
      client,
      bookings,
      statistics: stats,
    });
  } catch (error) {
    console.error("Get client details error:", error);
    res.status(500).json({ error: "Failed to get client details" });
  }
});

// Update booking status (admin only)
router.put("/bookings/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["pending", "confirmed", "cancelled", "completed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      ownerAdmin: req.tenantAdminId,
    }).populate("client", "firstName lastName email");

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    booking.status = status;
    if (status === "cancelled") {
      booking.cancelledAt = new Date();
    }

    await booking.save();

    res.json({
      message: "Booking status updated successfully",
      booking,
    });
  } catch (error) {
    console.error("Update booking status error:", error);
    res.status(500).json({ error: "Failed to update booking status" });
  }
});

// Get revenue analytics
router.get("/analytics/revenue", async (req, res) => {
  try {
    const { period = "month" } = req.query;

    let groupBy;
    let dateRange;

    switch (period) {
      case "week":
        groupBy = {
          year: { $year: "$createdAt" },
          week: { $week: "$createdAt" },
        };
        dateRange = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000); // 12 weeks
        break;
      case "year":
        groupBy = {
          year: { $year: "$createdAt" },
        };
        dateRange = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000); // 5 years
        break;
      default: // month
        groupBy = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        };
        dateRange = new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000); // 12 months
    }

    const revenue = await Booking.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          createdAt: { $gte: dateRange },
        },
      },
      {
        $group: {
          _id: groupBy,
          revenue: { $sum: "$amount" },
          bookings: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.week": 1 },
      },
    ]);

    res.json({ revenue });
  } catch (error) {
    console.error("Get revenue analytics error:", error);
    res.status(500).json({ error: "Failed to get revenue analytics" });
  }
});

// Setup Paystack subaccount for split payments
router.post(
  "/setup-subaccount",
  [
    body("businessName").notEmpty().withMessage("Business name is required"),
    body("settlementBank")
      .notEmpty()
      .withMessage("Settlement bank code is required"),
    body("accountNumber").notEmpty().withMessage("Account number is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        businessName,
        settlementBank,
        accountNumber,
        percentageCharge = 80,
      } = req.body;

      // Get admin user
      const admin = await User.findById(req.tenantAdminId);
      if (!admin) {
        return res.status(404).json({ error: "Admin user not found" });
      }

      // Check if subaccount already exists
      if (admin.paystack && admin.paystack.subaccountCode) {
        return res.status(400).json({
          error:
            "Subaccount already exists. Please update instead of creating a new one.",
        });
      }

      // Create Paystack subaccount
      const subaccountData = await paymentService.createSubaccount({
        business_name: businessName,
        settlement_bank: settlementBank,
        account_number: accountNumber,
        percentage_charge: percentageCharge,
        description: `Booking service subaccount for ${admin.email}`,
      });

      // Update admin with subaccount details
      admin.paystack = {
        subaccountCode: subaccountData.data.subaccount_code,
        subaccountId: subaccountData.data.id.toString(),
        businessName: businessName,
        settlementBank: settlementBank,
        accountNumber: accountNumber,
        percentageCharge: percentageCharge,
      };

      await admin.save();

      res.json({
        message: "Subaccount created successfully",
        subaccount: {
          subaccountCode: admin.paystack.subaccountCode,
          businessName: admin.paystack.businessName,
          percentageCharge: admin.paystack.percentageCharge,
        },
      });
    } catch (error) {
      console.error("Setup subaccount error:", error);
      res.status(500).json({
        error: error.message || "Failed to setup subaccount",
      });
    }
  }
);

// Get subaccount status
router.get("/subaccount-status", async (req, res) => {
  try {
    const admin = await User.findById(req.tenantAdminId).select("paystack");

    if (!admin) {
      return res.status(404).json({ error: "Admin user not found" });
    }

    const hasSubaccount = !!(admin.paystack && admin.paystack.subaccountCode);

    res.json({
      hasSubaccount,
      subaccount: hasSubaccount
        ? {
            businessName: admin.paystack.businessName,
            accountNumber: admin.paystack.accountNumber,
            percentageCharge: admin.paystack.percentageCharge,
            subaccountCode: admin.paystack.subaccountCode,
          }
        : null,
    });
  } catch (error) {
    console.error("Get subaccount status error:", error);
    res.status(500).json({ error: "Failed to get subaccount status" });
  }
});

// ==================== FLUTTERWAVE ROUTES ====================

// Setup Flutterwave subaccount
router.post(
  "/setup-flutterwave",
  [
    body("businessName").notEmpty().withMessage("Business name is required"),
    body("businessEmail")
      .isEmail()
      .withMessage("Valid business email is required"),
    body("accountBank").notEmpty().withMessage("Bank code is required"),
    body("accountNumber").notEmpty().withMessage("Account number is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        businessName,
        businessEmail,
        accountBank,
        accountNumber,
        bankName,
        country,
        currency,
      } = req.body;

      // Get admin user
      const admin = await User.findById(req.userId);
      if (!admin) {
        return res.status(404).json({ error: "Admin user not found" });
      }

      // Check if Flutterwave subaccount already exists
      if (admin.flutterwave?.subaccountId) {
        return res.status(400).json({
          error: "Flutterwave subaccount already exists for this admin",
        });
      }

      // Create Flutterwave subaccount with 100% split
      const subaccountData = await flutterwaveService.createSubaccount({
        account_bank: accountBank,
        account_number: accountNumber,
        business_name: businessName,
        business_email: businessEmail,
        split_value: 1, // 100% to tenant
      });

      // Update admin with Flutterwave details
      admin.flutterwave = {
        subaccountId: subaccountData.id,
        subaccountCode: subaccountData.subaccount_id,
        businessName,
        businessEmail,
        accountBank,
        accountNumber,
        bankName: bankName || "Unknown Bank",
        country: country || "NG",
        currency: currency || "NGN",
        splitValue: 1,
      };

      await admin.save();

      res.json({
        message: "Flutterwave subaccount created successfully",
        subaccount: {
          subaccountId: subaccountData.id,
          subaccountCode: subaccountData.subaccount_id,
          businessName,
          businessEmail,
        },
      });
    } catch (error) {
      console.error("Setup Flutterwave error:", error);
      res.status(500).json({
        error: error.message || "Failed to setup Flutterwave subaccount",
      });
    }
  }
);

// Get Flutterwave subaccount status
router.get("/flutterwave-status", async (req, res) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin) {
      return res.status(404).json({ error: "Admin user not found" });
    }

    res.json({
      hasSubaccount: !!admin.flutterwave?.subaccountId,
      subaccount: admin.flutterwave?.subaccountId
        ? {
            businessName: admin.flutterwave.businessName,
            businessEmail: admin.flutterwave.businessEmail,
            accountNumber: admin.flutterwave.accountNumber,
            bankName: admin.flutterwave.bankName,
            subaccountCode: admin.flutterwave.subaccountCode,
          }
        : null,
    });
  } catch (error) {
    console.error("Get Flutterwave status error:", error);
    res.status(500).json({ error: "Failed to get Flutterwave status" });
  }
});

// Get list of banks for Flutterwave (with optional country filter)
router.get("/flutterwave/banks", async (req, res) => {
  try {
    const { country } = req.query;
    const banks = await flutterwaveService.getBanks(country);
    res.json({ banks });
  } catch (error) {
    console.error("Get Flutterwave banks error:", error);
    res.status(500).json({
      error: error.message || "Failed to fetch banks",
    });
  }
});

// Get list of supported countries for Flutterwave
router.get("/flutterwave/countries", async (req, res) => {
  try {
    const countries = await flutterwaveService.getCountries();
    res.json({ countries });
  } catch (error) {
    console.error("Get Flutterwave countries error:", error);
    res.status(500).json({
      error: error.message || "Failed to fetch countries",
    });
  }
});

module.exports = router;
