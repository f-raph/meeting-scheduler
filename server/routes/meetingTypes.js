const express = require("express");
const { body, validationResult } = require("express-validator");
const MeetingType = require("../models/MeetingType");
const { auth, adminAuth } = require("../middleware/auth");

const router = express.Router();

// Get all meeting types for the current tenant (public - guests need this for booking)
router.get("/", async (req, res) => {
  try {
    const query = {
      ownerAdmin: req.tenantAdminId,
      isActive: true,
    };

    const meetingTypes = await MeetingType.find(query).sort({ name: 1 });

    res.json({ meetingTypes });
  } catch (error) {
    console.error("Get meeting types error:", error);
    res.status(500).json({ error: "Failed to get meeting types" });
  }
});

// Get all meeting types including inactive (admin only)
router.get("/all", auth, adminAuth, async (req, res) => {
  try {
    const meetingTypes = await MeetingType.find({
      ownerAdmin: req.tenantAdminId,
    }).sort({ name: 1 });

    res.json({ meetingTypes });
  } catch (error) {
    console.error("Get all meeting types error:", error);
    res.status(500).json({ error: "Failed to get meeting types" });
  }
});

// Get single meeting type
router.get("/:id", auth, async (req, res) => {
  try {
    const meetingType = await MeetingType.findOne({
      _id: req.params.id,
      ownerAdmin: req.tenantAdminId,
    });

    if (!meetingType) {
      return res.status(404).json({ error: "Meeting type not found" });
    }

    res.json({ meetingType });
  } catch (error) {
    console.error("Get meeting type error:", error);
    res.status(500).json({ error: "Failed to get meeting type" });
  }
});

// Create meeting type (admin only)
router.post(
  "/",
  auth,
  adminAuth,
  [
    body("name").notEmpty().trim().withMessage("Name is required"),
    body("price").isNumeric().withMessage("Price must be a number"),
    body("duration")
      .isInt({ min: 15, max: 480 })
      .withMessage("Duration must be between 15 and 480 minutes"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, price, currency, duration, color, isActive } =
        req.body;

      const meetingType = new MeetingType({
        name,
        description,
        price: price || 0,
        currency: currency || "NGN",
        duration,
        color: color || "#1976d2",
        isActive: isActive !== undefined ? isActive : true,
        ownerAdmin: req.tenantAdminId,
      });

      await meetingType.save();

      res.status(201).json({
        message: "Meeting type created successfully",
        meetingType,
      });
    } catch (error) {
      console.error("Create meeting type error:", error);
      res.status(500).json({ error: "Failed to create meeting type" });
    }
  }
);

// Update meeting type (admin only)
router.put(
  "/:id",
  auth,
  adminAuth,
  [
    body("name").optional().trim(),
    body("price").optional().isNumeric(),
    body("duration").optional().isInt({ min: 15, max: 480 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const meetingType = await MeetingType.findOne({
        _id: req.params.id,
        ownerAdmin: req.tenantAdminId,
      });

      if (!meetingType) {
        return res.status(404).json({ error: "Meeting type not found" });
      }

      const { name, description, price, currency, duration, color, isActive } =
        req.body;

      if (name !== undefined) meetingType.name = name;
      if (description !== undefined) meetingType.description = description;
      if (price !== undefined) meetingType.price = price;
      if (currency !== undefined) meetingType.currency = currency;
      if (duration !== undefined) meetingType.duration = duration;
      if (color !== undefined) meetingType.color = color;
      if (isActive !== undefined) meetingType.isActive = isActive;

      await meetingType.save();

      res.json({
        message: "Meeting type updated successfully",
        meetingType,
      });
    } catch (error) {
      console.error("Update meeting type error:", error);
      res.status(500).json({ error: "Failed to update meeting type" });
    }
  }
);

// Delete meeting type (admin only)
router.delete("/:id", auth, adminAuth, async (req, res) => {
  try {
    const meetingType = await MeetingType.findOne({
      _id: req.params.id,
      ownerAdmin: req.tenantAdminId,
    });

    if (!meetingType) {
      return res.status(404).json({ error: "Meeting type not found" });
    }

    await meetingType.deleteOne();

    res.json({ message: "Meeting type deleted successfully" });
  } catch (error) {
    console.error("Delete meeting type error:", error);
    res.status(500).json({ error: "Failed to delete meeting type" });
  }
});

module.exports = router;
