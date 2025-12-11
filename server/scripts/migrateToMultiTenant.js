/**
 * Migration script to backfill ownerAdmin for existing data
 * Run this once after implementing multi-tenancy
 *
 * Usage: node server/scripts/migrateToMultiTenant.js
 */

const mongoose = require("mongoose");
const User = require("../models/User");
const Booking = require("../models/Booking");
const Availability = require("../models/Availability");
require("dotenv").config();

async function migrateToMultiTenant() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/meeting-scheduler",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
    console.log("✓ Connected to MongoDB");

    // Step 1: Find all admin users
    const admins = await User.find({ role: "admin" });
    console.log(`\nFound ${admins.length} admin user(s)`);

    if (admins.length === 0) {
      console.log("⚠ No admin users found. Create an admin first.");
      process.exit(0);
    }

    // If multiple admins, ask which one should own orphaned data
    let selectedAdmin;
    if (admins.length === 1) {
      selectedAdmin = admins[0];
      console.log(
        `\nUsing admin: ${selectedAdmin.email} (${selectedAdmin.firstName} ${selectedAdmin.lastName})`
      );
    } else {
      console.log("\nMultiple admins found:");
      admins.forEach((admin, idx) => {
        console.log(
          `  ${idx + 1}. ${admin.email} - ${admin.firstName} ${
            admin.lastName
          } (slug: ${admin.slug || "none"})`
        );
      });
      console.log(
        "\n⚠ Multiple admins detected. Using first admin as default owner for orphaned data."
      );
      console.log(
        "   You can manually reassign data later via admin dashboard."
      );
      selectedAdmin = admins[0];
    }

    const adminId = selectedAdmin._id;

    // Step 2: Migrate clients without ownerAdmin
    const orphanedClients = await User.find({
      role: "client",
      $or: [{ ownerAdmin: null }, { ownerAdmin: { $exists: false } }],
    });

    if (orphanedClients.length > 0) {
      console.log(
        `\n📋 Migrating ${orphanedClients.length} client(s) without ownerAdmin...`
      );
      await User.updateMany(
        {
          role: "client",
          $or: [{ ownerAdmin: null }, { ownerAdmin: { $exists: false } }],
        },
        { $set: { ownerAdmin: adminId } }
      );
      console.log(
        `✓ Assigned ${orphanedClients.length} client(s) to admin: ${selectedAdmin.email}`
      );
    } else {
      console.log("\n✓ All clients already have ownerAdmin assigned");
    }

    // Step 3: Migrate bookings without ownerAdmin
    const orphanedBookings = await Booking.find({
      $or: [{ ownerAdmin: null }, { ownerAdmin: { $exists: false } }],
    });

    if (orphanedBookings.length > 0) {
      console.log(
        `\n📅 Migrating ${orphanedBookings.length} booking(s) without ownerAdmin...`
      );
      await Booking.updateMany(
        { $or: [{ ownerAdmin: null }, { ownerAdmin: { $exists: false } }] },
        { $set: { ownerAdmin: adminId } }
      );
      console.log(
        `✓ Assigned ${orphanedBookings.length} booking(s) to admin: ${selectedAdmin.email}`
      );
    } else {
      console.log("\n✓ All bookings already have ownerAdmin assigned");
    }

    // Step 4: Migrate availability without ownerAdmin
    const orphanedAvailability = await Availability.find({
      $or: [{ ownerAdmin: null }, { ownerAdmin: { $exists: false } }],
    });

    if (orphanedAvailability.length > 0) {
      console.log(
        `\n⏰ Migrating ${orphanedAvailability.length} availability slot(s) without ownerAdmin...`
      );
      await Availability.updateMany(
        { $or: [{ ownerAdmin: null }, { ownerAdmin: { $exists: false } }] },
        { $set: { ownerAdmin: adminId } }
      );
      console.log(
        `✓ Assigned ${orphanedAvailability.length} availability slot(s) to admin: ${selectedAdmin.email}`
      );
    } else {
      console.log(
        "\n✓ All availability slots already have ownerAdmin assigned"
      );
    }

    // Step 5: Verify migration
    console.log("\n📊 Verification:");
    const clientsWithoutOwner = await User.countDocuments({
      role: "client",
      $or: [{ ownerAdmin: null }, { ownerAdmin: { $exists: false } }],
    });
    const bookingsWithoutOwner = await Booking.countDocuments({
      $or: [{ ownerAdmin: null }, { ownerAdmin: { $exists: false } }],
    });
    const availabilityWithoutOwner = await Availability.countDocuments({
      $or: [{ ownerAdmin: null }, { ownerAdmin: { $exists: false } }],
    });

    console.log(`  - Clients without ownerAdmin: ${clientsWithoutOwner}`);
    console.log(`  - Bookings without ownerAdmin: ${bookingsWithoutOwner}`);
    console.log(
      `  - Availability without ownerAdmin: ${availabilityWithoutOwner}`
    );

    if (
      clientsWithoutOwner === 0 &&
      bookingsWithoutOwner === 0 &&
      availabilityWithoutOwner === 0
    ) {
      console.log(
        "\n✅ Migration completed successfully! All data is now tenant-scoped."
      );
    } else {
      console.log(
        "\n⚠ Some records still missing ownerAdmin. Please review manually."
      );
    }

    // Step 6: Show summary by admin
    console.log("\n📈 Data distribution by admin:");
    for (const admin of admins) {
      const clientCount = await User.countDocuments({
        role: "client",
        ownerAdmin: admin._id,
      });
      const bookingCount = await Booking.countDocuments({
        ownerAdmin: admin._id,
      });
      const availabilityCount = await Availability.countDocuments({
        ownerAdmin: admin._id,
      });

      console.log(`\n  ${admin.email} (slug: ${admin.slug || "none"}):`);
      console.log(`    - Clients: ${clientCount}`);
      console.log(`    - Bookings: ${bookingCount}`);
      console.log(`    - Availability slots: ${availabilityCount}`);
    }

    console.log("\n✅ Migration complete!\n");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed.");
    process.exit(0);
  }
}

// Run migration
migrateToMultiTenant();
