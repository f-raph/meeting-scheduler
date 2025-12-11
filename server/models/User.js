const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function () {
        return this.authProvider === "local";
      },
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["admin"],
      default: "admin",
    },
    // Public tenant identifier for admins (e.g., "john-doe")
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true, // only required for admins
      index: true,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    googleId: {
      type: String,
      sparse: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    timezone: {
      type: String,
      default: "UTC",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    // Admin payout configuration (used when role === 'admin')
    payout: {
      enabled: { type: Boolean, default: false },
      bankName: { type: String },
      bankCode: { type: String },
      accountNumber: { type: String },
      accountName: { type: String },
      recipientCode: { type: String }, // Paystack transfer recipient code
      schedule: {
        type: String,
        enum: ["daily", "weekly", "manual"],
        default: "daily",
      },
    },
    // Paystack subaccount for instant split payments (80/20 split)
    paystack: {
      subaccountCode: { type: String }, // Paystack subaccount code (e.g., ACCT_xxx)
      subaccountId: { type: String }, // Paystack subaccount ID
      businessName: { type: String },
      settlementBank: { type: String },
      accountNumber: { type: String },
      percentageCharge: { type: Number, default: 80 }, // Tenant gets 80%
    },
    // Flutterwave subaccount for instant split payments (100% to tenant)
    flutterwave: {
      subaccountId: { type: String }, // Flutterwave subaccount ID
      subaccountCode: { type: String }, // Flutterwave subaccount code
      businessName: { type: String },
      businessEmail: { type: String },
      accountBank: { type: String }, // Bank code
      accountNumber: { type: String },
      bankName: { type: String }, // Bank name for display
      country: { type: String, default: "NG" }, // ISO country code
      currency: { type: String, default: "NGN" }, // Currency code
      splitValue: { type: Number, default: 1 }, // 1 = 100% to tenant
    },
    // Google Calendar integration (per-admin OAuth tokens)
    googleCalendar: {
      connected: { type: Boolean, default: false },
      accessToken: { type: String, select: false }, // Don't return by default
      refreshToken: { type: String, select: false }, // Don't return by default
      tokenExpiry: { type: Date },
      calendarId: { type: String, default: "primary" },
      scope: { type: [String], default: [] },
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Generate a default slug for admin users if missing
function simpleSlugify(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

userSchema.pre("save", async function (next) {
  try {
    if (this.role === "admin" && !this.slug) {
      // Prefer first+last name, otherwise username from email
      const base =
        this.firstName || this.lastName
          ? `${this.firstName || ""}-${this.lastName || ""}`
          : (this.email || "").split("@")[0];
      let candidate = simpleSlugify(base) || simpleSlugify(this.email);

      // Ensure uniqueness by appending numeric suffix if needed
      if (candidate) {
        let unique = candidate;
        let i = 1;
        // eslint-disable-next-line no-constant-condition
        while (await mongoose.model("User").exists({ slug: unique })) {
          i += 1;
          unique = `${candidate}-${i}`;
        }
        this.slug = unique;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("User", userSchema);
