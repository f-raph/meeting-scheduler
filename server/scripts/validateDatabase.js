/**
 * Database validation script
 * Checks for data integrity issues in multi-tenant setup
 *
 * Usage: node server/scripts/validateDatabase.js
 */

const mongoose = require("mongoose");
const User = require("../models/User");
const Booking = require("../models/Booking");
const Availability = require("../models/Availability");
require("dotenv").config();

async function validateDatabase() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/meeting-scheduler",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
    console.log("✓ Connected to MongoDB\n");

    let issues = 0;

    // Check 1: Admins without slugs
    console.log("🔍 Checking admins...");
    const adminsWithoutSlug = await User.find({
      role: "admin",
      $or: [{ slug: null }, { slug: { $exists: false } }, { slug: "" }],
    });

    if (adminsWithoutSlug.length > 0) {
      console.log(
        `  ⚠ Found ${adminsWithoutSlug.length} admin(s) without slug:`
      );
      adminsWithoutSlug.forEach((admin) => {
        console.log(`    - ${admin.email}`);
      });
      issues += adminsWithoutSlug.length;
    } else {
      console.log("  ✓ All admins have slugs");
    }

    // Check 2: Duplicate slugs
    const slugCounts = await User.aggregate([
      { $match: { role: "admin", slug: { $ne: null } } },
      { $group: { _id: "$slug", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);

    if (slugCounts.length > 0) {
      console.log(`  ⚠ Found ${slugCounts.length} duplicate slug(s):`);
      slugCounts.forEach((item) => {
        console.log(`    - "${item._id}" appears ${item.count} times`);
      });
      issues += slugCounts.length;
    } else {
      console.log("  ✓ All slugs are unique");
    }

    // Check 3: Clients without ownerAdmin
    console.log("\n🔍 Checking clients...");
    const orphanedClients = await User.countDocuments({
      role: "client",
      $or: [{ ownerAdmin: null }, { ownerAdmin: { $exists: false } }],
    });

    if (orphanedClients > 0) {
      console.log(`  ⚠ Found ${orphanedClients} client(s) without ownerAdmin`);
      issues += orphanedClients;
    } else {
      console.log("  ✓ All clients have ownerAdmin assigned");
    }

    // Check 4: Clients with invalid ownerAdmin
    const clientsWithInvalidOwner = await User.find({
      role: "client",
      ownerAdmin: { $ne: null },
    });
    let invalidOwnerCount = 0;

    for (const client of clientsWithInvalidOwner) {
      const owner = await User.findById(client.ownerAdmin);
      if (!owner || owner.role !== "admin") {
        invalidOwnerCount++;
      }
    }

    if (invalidOwnerCount > 0) {
      console.log(
        `  ⚠ Found ${invalidOwnerCount} client(s) with invalid ownerAdmin reference`
      );
      issues += invalidOwnerCount;
    } else {
      console.log("  ✓ All client ownerAdmin references are valid");
    }

    // Check 5: Bookings without ownerAdmin
    console.log("\n🔍 Checking bookings...");
    const orphanedBookings = await Booking.countDocuments({
      $or: [{ ownerAdmin: null }, { ownerAdmin: { $exists: false } }],
    });

    if (orphanedBookings > 0) {
      console.log(
        `  ⚠ Found ${orphanedBookings} booking(s) without ownerAdmin`
      );
      issues += orphanedBookings;
    } else {
      console.log("  ✓ All bookings have ownerAdmin assigned");
    }

    // Check 6: Bookings with mismatched client-admin relationship
    const bookingsWithClient = await Booking.find({
      client: { $ne: null },
      ownerAdmin: { $ne: null },
    }).populate("client");

    let mismatchCount = 0;
    for (const booking of bookingsWithClient) {
      if (booking.client && booking.client.ownerAdmin) {
        if (
          booking.client.ownerAdmin.toString() !== booking.ownerAdmin.toString()
        ) {
          mismatchCount++;
        }
      }
    }

    if (mismatchCount > 0) {
      console.log(
        `  ⚠ Found ${mismatchCount} booking(s) with client-admin mismatch`
      );
      issues += mismatchCount;
    } else {
      console.log("  ✓ All booking client-admin relationships are consistent");
    }

    // Check 7: Availability without ownerAdmin
    console.log("\n🔍 Checking availability...");
    const orphanedAvailability = await Availability.countDocuments({
      $or: [{ ownerAdmin: null }, { ownerAdmin: { $exists: false } }],
    });

    if (orphanedAvailability > 0) {
      console.log(
        `  ⚠ Found ${orphanedAvailability} availability slot(s) without ownerAdmin`
      );
      issues += orphanedAvailability;
    } else {
      console.log("  ✓ All availability slots have ownerAdmin assigned");
    }

    // Summary
    console.log("\n" + "=".repeat(50));
    if (issues === 0) {
      console.log("✅ Database validation passed! No issues found.");
    } else {
      console.log(`⚠ Database validation found ${issues} issue(s).`);
      console.log("\nRecommended actions:");
      console.log("  1. Run: node server/scripts/migrateToMultiTenant.js");
      console.log("  2. Run this validation again to verify");
    }
    console.log("=".repeat(50) + "\n");
  } catch (error) {
    console.error("❌ Validation failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

validateDatabase();
