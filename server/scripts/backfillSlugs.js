require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

(async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/meeting-scheduler",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
    console.log("Connected");

    const admins = await User.find({
      role: "admin",
      $or: [{ slug: { $exists: false } }, { slug: null }],
    });

    for (const admin of admins) {
      const base =
        admin.firstName || admin.lastName
          ? `${admin.firstName || ""}-${admin.lastName || ""}`
          : (admin.email || "").split("@")[0];
      const candidate = slugify(base) || slugify(admin.email);

      let unique = candidate;
      let i = 1;
      // Ensure uniqueness
      // eslint-disable-next-line no-await-in-loop
      while (await User.exists({ slug: unique })) {
        i += 1;
        unique = `${candidate}-${i}`;
      }
      admin.slug = unique;
      // eslint-disable-next-line no-await-in-loop
      await admin.save();
      console.log(`Updated admin ${admin.email} -> slug: ${admin.slug}`);
    }

    console.log("Done");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
