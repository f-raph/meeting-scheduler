const express = require("express");
const Booking = require("../models/Booking");
const User = require("../models/User");
const { auth, adminAuth } = require("../middleware/auth");
const paymentService = require("../services/payment");
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

// ==================== PAYSTACK SUBACCOUNT ROUTES ====================

/**
 * Setup Paystack subaccount for split payments
 * Creates a subaccount PROGRAMMATICALLY via Paystack API (NOT manually via dashboard)
 * 
 * POST /admin/setup-subaccount (or /admin/payment-setup as alias)
 * 
 * Flow:
 * 1. Validate input (business name, bank code, account number)
 * 2. Verify bank code exists in Paystack's bank list
 * 3. Check if admin already has a subaccount (prevent duplicates)
 * 4. Call Paystack Subaccount API to create subaccount
 * 5. Store subaccount_code in database
 * 6. Set paymentSetupStatus to ACTIVE
 * 
 * Works identically in TEST and LIVE modes - both call Paystack APIs
 * 
 * Body:
 * - businessName: string (required)
 * - settlementBank: string (bank code, required)
 * - bankName: string (optional, for display)
 * - accountNumber: string (required)
 * - accountName: string (optional, for display purposes)
 * - percentageCharge: number (optional, default 100)
 * 
 * Returns:
 * - Success: { message, subaccount: { subaccountCode, businessName, ... }, status: "ACTIVE" }
 * - Already exists: 200 with existing data
 * - Error: 400/500 with error details
 */
const setupSubaccountHandler = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      businessName, 
      settlementBank,
      bankName,
      accountNumber, 
      accountName,
      percentageCharge = 100 
    } = req.body;

    
    // Get admin user
    const admin = await User.findById(req.tenantAdminId);
    if (!admin) {
      return res.status(404).json({ error: "Admin user not found" });
    }

    // ========================================
    // PREVENT DUPLICATE SUBACCOUNT CREATION
    // ========================================
    // If admin already has a subaccount_code, return existing data
    if (admin.paystack && admin.paystack.subaccountCode) {
      console.log(`Admin ${admin.email} already has subaccount: ${admin.paystack.subaccountCode}`);
      return res.status(200).json({
        message: "Payment setup already complete",
        alreadyExists: true,
        status: admin.paymentSetupStatus || "ACTIVE",
        subaccount: {
          subaccountCode: admin.paystack.subaccountCode,
          businessName: admin.paystack.businessName,
          bankName: admin.paystack.bankName,
          accountNumber: admin.paystack.accountNumber,
          settlementBank: admin.paystack.settlementBank,
          percentageCharge: admin.paystack.percentageCharge,
          isVerified: admin.paystack.isVerified,
        },
      });
    }

    // ========================================
    // VALIDATE ACCOUNT NUMBER FORMAT
    // ========================================
    if (!/^\d{10,20}$/.test(accountNumber)) {
      return res.status(400).json({
        error: "Account number must be 10-20 digits and contain only numbers",
      });
    }

    // ========================================
    // VALIDATE BANK CODE (Fetch from Paystack)
    // ========================================
    let validBankCode = false;
    let resolvedBankName = bankName || "";
    
    try {
      const banksResponse = await paymentService.getBanks();
      if (banksResponse.status === "success" && banksResponse.data) {
        const bank = banksResponse.data.find(b => b.code === settlementBank);
        if (bank) {
          validBankCode = true;
          resolvedBankName = bank.name;
        }
      }
    } catch (bankError) {
      console.warn("Could not validate bank code against Paystack:", bankError.message);
    }

    if (!validBankCode) {
      return res.status(400).json({
        error: "Invalid bank code. Please select a valid bank from the list.",
      });
    }

    // ========================================
    // CREATE PAYSTACK SUBACCOUNT (Programmatic)
    // ========================================
    console.log(`Creating Paystack subaccount for admin ${admin.email}...`);
    console.log(`  Bank: ${resolvedBankName} (${settlementBank})`);
    console.log(`  Account: ${accountNumber}`);
    
    const subaccountData = await paymentService.createSubaccount({
      business_name: businessName,
      settlement_bank: settlementBank,
      account_number: accountNumber,
      percentage_charge: percentageCharge,
      description: `Meeting booking subaccount for ${admin.email}`,
      primary_contact_email: admin.email,
    });

    if (subaccountData.status !== "success") {
      console.error("Paystack subaccount creation failed:", subaccountData);
      // Mark status as FAILED
      admin.paymentSetupStatus = "FAILED";
      await admin.save();
      throw new Error(subaccountData.message || "Failed to create subaccount");
    }

    // ========================================
    // STORE SUBACCOUNT IN DATABASE
    // ========================================
    admin.paystack = {
      subaccountCode: subaccountData.data.subaccount_code,
      subaccountId: subaccountData.data.id?.toString() || "",
      businessName: businessName,
      settlementBank: settlementBank,
      bankName: resolvedBankName,
      accountNumber: accountNumber,
      accountName: accountName || subaccountData.data.account_name || "",
      percentageCharge: percentageCharge,
      isVerified: subaccountData.data.is_verified || false,
      createdAt: new Date(),
    };

    // ========================================
    // SET PAYMENT STATUS TO ACTIVE
    // ========================================
    admin.paymentSetupStatus = "ACTIVE";

    await admin.save();

    console.log(`✅ Subaccount created for ${admin.email}: ${admin.paystack.subaccountCode}`);
    console.log(`   Payment status: ACTIVE`);
    console.log(`   This subaccount is now visible in your Paystack dashboard!`);

    res.json({
      message: "Payment setup completed successfully! You can now receive payments.",
      status: "ACTIVE",
      subaccount: {
        subaccountCode: admin.paystack.subaccountCode,
        businessName: admin.paystack.businessName,
        bankName: admin.paystack.bankName,
        accountNumber: admin.paystack.accountNumber,
        percentageCharge: admin.paystack.percentageCharge,
        isVerified: admin.paystack.isVerified,
      },
    });
  } catch (error) {
    console.error("Setup subaccount error:", error);
    
    // Parse Paystack-specific errors for user-friendly messages
    let errorMessage = "Failed to setup payment account";
    
    if (error.message) {
      if (error.message.includes("account_number") || error.message.includes("Account number")) {
        errorMessage = "Invalid account number. Please verify your account number and try again.";
      } else if (error.message.includes("settlement_bank") || error.message.includes("bank")) {
        errorMessage = "Invalid bank selected. Please select a valid bank from the list.";
      } else if (error.message.includes("already exists") || error.message.includes("duplicate")) {
        errorMessage = "A subaccount with these bank details already exists in Paystack.";
      } else if (error.message.includes("business_name")) {
        errorMessage = "Invalid business name. Please enter a valid business name.";
      } else {
        errorMessage = error.message;
      }
    }
    
    res.status(500).json({ 
      error: errorMessage,
      status: "FAILED",
    });
  }
};

// Validation middleware
const setupSubaccountValidation = [
  body("businessName")
    .notEmpty()
    .withMessage("Business name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Business name must be between 2 and 100 characters"),
  body("settlementBank")
    .notEmpty()
    .withMessage("Bank is required"),
  body("accountNumber")
    .notEmpty()
    .withMessage("Account number is required")
    .isLength({ min: 10, max: 20 })
    .withMessage("Account number must be between 10 and 20 digits"),
];

// Main endpoint
router.post("/setup-subaccount", setupSubaccountValidation, setupSubaccountHandler);

// Alias endpoint for cleaner naming
router.post("/payment-setup", setupSubaccountValidation, setupSubaccountHandler);

/**
 * Get subaccount status for the current admin
 * Returns payment setup status and subaccount details
 */
router.get("/subaccount-status", async (req, res) => {
  try {
    const admin = await User.findById(req.tenantAdminId).select("paystack paymentSetupStatus email");

    if (!admin) {
      return res.status(404).json({ error: "Admin user not found" });
    }

    const hasSubaccount = !!(admin.paystack && admin.paystack.subaccountCode);

    res.json({
      hasSubaccount,
      paymentSetupStatus: admin.paymentSetupStatus || (hasSubaccount ? "ACTIVE" : "PENDING"),
      canReceivePayments: hasSubaccount && admin.paymentSetupStatus === "ACTIVE",
      subaccount: hasSubaccount
        ? {
            subaccountCode: admin.paystack.subaccountCode,
            businessName: admin.paystack.businessName,
            bankName: admin.paystack.bankName,
            accountNumber: admin.paystack.accountNumber,
            settlementBank: admin.paystack.settlementBank,
            percentageCharge: admin.paystack.percentageCharge,
            isVerified: admin.paystack.isVerified,
            createdAt: admin.paystack.createdAt,
          }
        : null,
    });
  } catch (error) {
    console.error("Get subaccount status error:", error);
    res.status(500).json({ error: "Failed to get subaccount status" });
  }
});

/**
 * Manually link a Paystack subaccount code
 * Use this when you've created a subaccount directly in the Paystack dashboard
 * 
 * VERIFIES the subaccount exists in Paystack before linking!
 */
router.post("/link-subaccount", async (req, res) => {
  try {
    const { subaccountCode, businessName } = req.body;

    if (!subaccountCode) {
      return res.status(400).json({ error: "Subaccount code is required" });
    }

    // Validate subaccount code format (should start with ACCT_)
    if (!subaccountCode.startsWith("ACCT_")) {
      return res.status(400).json({ 
        error: "Invalid subaccount code format. It should start with 'ACCT_'" 
      });
    }

    const admin = await User.findById(req.tenantAdminId);
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    // ========================================
    // VERIFY SUBACCOUNT EXISTS IN PAYSTACK
    // ========================================
    console.log(`[Paystack] Verifying subaccount: ${subaccountCode}`);
    
    let paystackSubaccount;
    try {
      const verifyResult = await paymentService.getSubaccount(subaccountCode);
      paystackSubaccount = verifyResult.data;
      console.log(`✅ [Paystack] Subaccount verified:`, {
        code: paystackSubaccount.subaccount_code,
        business_name: paystackSubaccount.business_name,
        account_name: paystackSubaccount.account_name,
        bank: paystackSubaccount.settlement_bank,
      });
    } catch (verifyError) {
      console.error(`❌ [Paystack] Subaccount not found: ${subaccountCode}`);
      return res.status(400).json({ 
        error: "Subaccount not found in Paystack. Please check the code and try again.",
        details: "Make sure you copied the correct subaccount code from your Paystack dashboard."
      });
    }

    // Store the verified subaccount data
    admin.paystack = {
      subaccountCode: paystackSubaccount.subaccount_code,
      subaccountId: paystackSubaccount.id?.toString() || "",
      businessName: paystackSubaccount.business_name || businessName || "Linked from Paystack",
      bankName: paystackSubaccount.settlement_bank || "",
      accountNumber: paystackSubaccount.account_number || "",
      accountName: paystackSubaccount.account_name || "",
      percentageCharge: paystackSubaccount.percentage_charge || 100,
      isVerified: true,
      createdAt: new Date(),
      manuallyLinked: true,
    };
    admin.paymentSetupStatus = "ACTIVE";
    await admin.save();

    console.log(`✅ Subaccount linked for ${admin.email}: ${subaccountCode}`);

    res.json({
      message: "Subaccount verified and linked successfully!",
      subaccount: {
        subaccountCode: admin.paystack.subaccountCode,
        businessName: admin.paystack.businessName,
        accountName: admin.paystack.accountName,
        bankName: admin.paystack.bankName,
        accountNumber: admin.paystack.accountNumber,
        isVerified: true,
      },
    });
  } catch (error) {
    console.error("Link subaccount error:", error);
    res.status(500).json({ error: error.message || "Failed to link subaccount" });
  }
});

/**
 * Reset payment setup
 * Requires password verification for security
 */
router.delete("/reset-payment-setup", async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: "Password is required to reset payment setup",
      });
    }

    const admin = await User.findById(req.tenantAdminId);
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    // Verify password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    // Clear Paystack subaccount data
    admin.paystack = undefined;
    admin.paymentSetupStatus = "PENDING";
    await admin.save();

    console.log(`Payment setup reset for admin: ${admin.email}`);

    res.json({
      message: "Payment setup has been reset. You can now set up a new payment account.",
      success: true,
    });
  } catch (error) {
    console.error("Reset payment setup error:", error);
    res.status(500).json({ error: "Failed to reset payment setup" });
  }
});

/**
 * Get list of Ghanaian banks for subaccount setup
 */
router.get("/banks", async (req, res) => {
  try {
    const banksData = await paymentService.listBanks();
    
    const banks = banksData.data || [];
    
    res.json({ 
      banks,
    });
  } catch (error) {
    console.error("Get banks error:", error);
    res.status(500).json({
      error: error.message || "Failed to fetch banks",
    });
  }
});

/**
 * Resolve bank account number to get account name
 * 
 * Always requires real Paystack verification
 */
router.get("/resolve-account", async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.query;

    if (!accountNumber || !bankCode) {
      return res.status(400).json({
        error: "Account number and bank code are required",
      });
    }

    // Validate account number format
    if (!/^\d{10,20}$/.test(accountNumber)) {
      return res.status(400).json({
        error: "Account number must be 10-20 digits",
      });
    }

    try {
      const accountData = await paymentService.resolveAccount(
        accountNumber,
        bankCode
      );

      res.json({
        accountName: accountData.data.account_name,
        accountNumber: accountData.data.account_number,
        verified: true,
      });
    } catch (paystackError) {
      console.error(`Account resolution failed for ${accountNumber}:`, paystackError.message);
      throw paystackError;
    }
  } catch (error) {
    console.error("Resolve account error:", error);
    res.status(500).json({
      error: error.message || "Failed to resolve account number. Please verify your bank and account details.",
    });
  }
});

module.exports = router;
