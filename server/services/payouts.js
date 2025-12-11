const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const User = require("../models/User");
const paymentService = require("./payment");

/**
 * Daily payout processor
 * - Finds all paid bookings that haven't been paid out per admin
 * - Aggregates totals and initiates a single transfer per admin
 * - Marks bookings as paid out
 */
async function runDailyPayouts({ dryRun = false } = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Aggregate per admin
    const sums = await Booking.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          payoutStatus: { $ne: "paid" },
          ownerAdmin: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$ownerAdmin",
          totalAmount: { $sum: "$amount" },
          bookings: { $push: "$_id" },
          count: { $sum: 1 },
        },
      },
    ]);

    const results = [];

    for (const row of sums) {
      const adminId = row._id;
      const total = row.totalAmount;
      const bookingIds = row.bookings;

      const admin = await User.findById(adminId).session(session);
      if (!admin) {
        results.push({ adminId, status: "skipped", reason: "admin-not-found" });
        continue;
      }
      if (!(admin.payout?.enabled && admin.payout?.recipientCode)) {
        results.push({
          adminId,
          status: "skipped",
          reason: "payout-disabled-or-missing-recipient",
        });
        continue;
      }

      const reference = `payout_${adminId}_${Date.now()}`;

      if (!dryRun) {
        await Booking.updateMany(
          { _id: { $in: bookingIds } },
          { $set: { payoutStatus: "queued" } },
          { session }
        );

        try {
          await paymentService.initiateTransfer({
            amount: total,
            recipient: admin.payout.recipientCode,
            reason: "Daily tenant payout",
            reference,
          });

          await Booking.updateMany(
            { _id: { $in: bookingIds } },
            {
              $set: {
                payoutStatus: "paid",
                paidOutAt: new Date(),
                payoutBatchId: reference,
              },
            },
            { session }
          );

          results.push({
            adminId,
            status: "paid",
            total,
            count: bookingIds.length,
            reference,
          });
        } catch (err) {
          // Roll back queued status on failure of transfer
          await Booking.updateMany(
            { _id: { $in: bookingIds } },
            { $set: { payoutStatus: "pending" } },
            { session }
          );
          results.push({ adminId, status: "failed", error: err.message });
        }
      } else {
        results.push({
          adminId,
          status: "dry-run",
          total,
          count: bookingIds.length,
        });
      }
    }

    await session.commitTransaction();
    session.endSession();

    return { ok: true, results };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("runDailyPayouts error:", error);
    return { ok: false, error: error.message };
  }
}

module.exports = { runDailyPayouts };
