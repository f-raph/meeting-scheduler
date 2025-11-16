const nodemailer = require("nodemailer");
const { format } = require("date-fns");

// Email configuration - uses Ethereal for development or SendGrid/Gmail for production
let transporter;

const initializeEmailService = async () => {
  if (process.env.NODE_ENV === "production") {
    // Production: Use SendGrid or Gmail
    if (process.env.SENDGRID_API_KEY) {
      transporter = nodemailer.createTransport({
        host: "smtp.sendgrid.net",
        port: 587,
        auth: {
          user: "apikey",
          pass: process.env.SENDGRID_API_KEY,
        },
      });
    } else if (process.env.GMAIL_EMAIL && process.env.GMAIL_PASSWORD) {
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_EMAIL,
          pass: process.env.GMAIL_PASSWORD,
        },
      });
    } else {
      console.warn("No email service configured for production");
      return false;
    }
  } else {
    // Development: Use Ethereal (free test email service)
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log("✓ Email service initialized with Ethereal test account");
      console.log(`  Test emails can be viewed at: https://ethereal.email`);
    } catch (err) {
      console.error("Failed to initialize email service:", err.message);
      return false;
    }
  }

  return true;
};

const sendBookingConfirmationEmail = async (booking, user) => {
  if (!transporter) {
    console.warn("Email service not initialized");
    return;
  }

  try {
    const startTime = new Date(booking.startTime);
    const endTime = new Date(booking.endTime);

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: #1976d2; padding: 20px; border-radius: 8px 8px 0 0; color: white;">
          <h2 style="margin: 0;">Booking Confirmed! ✓</h2>
        </div>
        
        <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>Hello <strong>${user.firstName} ${user.lastName}</strong>,</p>
          
          <p>Your meeting has been successfully booked and payment has been received. Here are your booking details:</p>
          
          <div style="background-color: #f0f7ff; padding: 20px; border-left: 4px solid #1976d2; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #1976d2;">Meeting Details</h3>
            <p><strong>Date:</strong> ${format(
              startTime,
              "EEEE, MMMM d, yyyy"
            )}</p>
            <p><strong>Time:</strong> ${format(startTime, "h:mm a")} - ${format(
      endTime,
      "h:mm a"
    )}</p>
            <p><strong>Type:</strong> ${
              booking.meetingType.charAt(0).toUpperCase() +
              booking.meetingType.slice(1).replace(/-/g, " ")
            }</p>
            <p><strong>Duration:</strong> ${booking.duration} minutes</p>
            <p><strong>Amount Paid:</strong> ${booking.currency.toUpperCase()} ${Number(
      booking.amount
    ).toLocaleString()}</p>
          </div>

          ${
            booking.meetingLink
              ? `
            <div style="background-color: #e8f5e9; padding: 20px; border-left: 4px solid #4caf50; margin: 20px 0; border-radius: 4px;">
              <h3 style="margin-top: 0; color: #2e7d32;">Google Meet Ready</h3>
              <p>Your Google Meet link is ready. You can join the meeting using this link:</p>
              <p><a href="${booking.meetingLink}" style="display: inline-block; background-color: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Join Google Meet</a></p>
              <p style="color: #666; font-size: 12px;">You can also view this link in your booking details on our platform.</p>
            </div>
          `
              : ""
          }

          ${
            booking.description
              ? `
            <div style="background-color: #fff3e0; padding: 20px; border-left: 4px solid #ff9800; margin: 20px 0; border-radius: 4px;">
              <h3 style="margin-top: 0; color: #e65100;">Additional Notes</h3>
              <p>${booking.description}</p>
            </div>
          `
              : ""
          }

          <div style="margin: 30px 0; padding: 20px; background-color: #f5f5f5; border-radius: 4px;">
            <h3 style="margin-top: 0;">What's Next?</h3>
            <ul style="margin: 0; padding-left: 20px; color: #555;">
              <li>Add this meeting to your calendar</li>
              <li>Test your audio/video before the meeting</li>
              <li>Join a few minutes early if possible</li>
              <li>If you need to reschedule, visit your booking details</li>
            </ul>
          </div>

          <div style="border-top: 1px solid #ddd; margin-top: 30px; padding-top: 20px; color: #999; font-size: 12px;">
            <p>If you have any questions or need to cancel, please log in to your account and manage your bookings.</p>
            <p style="margin-bottom: 0;">
              <strong>Meeting Scheduler Support Team</strong><br/>
              This is an automated message, please do not reply to this email.
            </p>
          </div>
        </div>
      </div>
    `;

    const emailText = `
Booking Confirmed!

Hello ${user.firstName} ${user.lastName},

Your meeting has been successfully booked. Here are your details:

Date: ${format(startTime, "EEEE, MMMM d, yyyy")}
Time: ${format(startTime, "h:mm a")} - ${format(endTime, "h:mm a")}
Type: ${booking.meetingType}
Duration: ${booking.duration} minutes
Amount Paid: ${booking.currency.toUpperCase()} ${Number(
      booking.amount
    ).toLocaleString()}

${booking.meetingLink ? `Google Meet Link: ${booking.meetingLink}\n` : ""}

${booking.description ? `Notes: ${booking.description}\n` : ""}

You can view your booking details and meet link on our platform.

Thank you!
Meeting Scheduler Support Team
    `.trim();

    const mailOptions = {
      from: process.env.SENDER_EMAIL || "noreply@meetingscheduler.com",
      to: user.email,
      subject: `Meeting Confirmed - ${format(startTime, "MMM d, yyyy")}`,
      html: emailHtml,
      text: emailText,
    };

    const info = await transporter.sendMail(mailOptions);

    if (process.env.NODE_ENV === "development") {
      console.log(`✓ Booking confirmation email sent`);
      console.log(`  Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }

    return true;
  } catch (error) {
    console.error("Failed to send booking confirmation email:", error.message);
    // Don't throw - email failure shouldn't block booking
    return false;
  }
};

const sendBookingCancellationEmail = async (booking, user, reason) => {
  if (!transporter) {
    console.warn("Email service not initialized");
    return;
  }

  try {
    const startTime = new Date(booking.startTime);

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: #d32f2f; padding: 20px; border-radius: 8px 8px 0 0; color: white;">
          <h2 style="margin: 0;">Booking Cancelled</h2>
        </div>
        
        <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>Hello <strong>${user.firstName} ${user.lastName}</strong>,</p>
          
          <p>Your booking has been cancelled.</p>
          
          <div style="background-color: #ffebee; padding: 20px; border-left: 4px solid #d32f2f; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #c62828;">Cancelled Meeting Details</h3>
            <p><strong>Date:</strong> ${format(
              startTime,
              "EEEE, MMMM d, yyyy"
            )}</p>
            <p><strong>Time:</strong> ${format(startTime, "h:mm a")}</p>
            <p><strong>Booking ID:</strong> ${booking._id}</p>
          </div>

          ${
            booking.paymentStatus === "paid"
              ? `
            <div style="background-color: #e3f2fd; padding: 20px; border-left: 4px solid #1976d2; margin: 20px 0; border-radius: 4px;">
              <h3 style="margin-top: 0; color: #1565c0;">Refund Status</h3>
              <p>Since payment was made, a refund of <strong>${booking.currency.toUpperCase()} ${Number(
                  booking.amount
                ).toLocaleString()}</strong> will be processed to your original payment method within 3-5 business days.</p>
            </div>
          `
              : ""
          }

          ${
            reason
              ? `
            <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 4px;">
              <h3 style="margin-top: 0;">Cancellation Reason</h3>
              <p>${reason}</p>
            </div>
          `
              : ""
          }

          <div style="border-top: 1px solid #ddd; margin-top: 30px; padding-top: 20px; color: #999; font-size: 12px;">
            <p>If you have any questions, please log in to your account or contact support.</p>
            <p style="margin-bottom: 0;">
              <strong>Meeting Scheduler Support Team</strong>
            </p>
          </div>
        </div>
      </div>
    `;

    const emailText = `
Booking Cancelled

Hello ${user.firstName} ${user.lastName},

Your booking has been cancelled.

Date: ${format(startTime, "EEEE, MMMM d, yyyy")}
Time: ${format(startTime, "h:mm a")}

${
  booking.paymentStatus === "paid"
    ? `Refund: ${booking.currency.toUpperCase()} ${Number(
        booking.amount
      ).toLocaleString()} will be processed within 3-5 business days.`
    : ""
}

${reason ? `Reason: ${reason}` : ""}

Thank you!
Meeting Scheduler Support Team
    `.trim();

    const mailOptions = {
      from: process.env.SENDER_EMAIL || "noreply@meetingscheduler.com",
      to: user.email,
      subject: `Booking Cancelled - ${format(startTime, "MMM d, yyyy")}`,
      html: emailHtml,
      text: emailText,
    };

    const info = await transporter.sendMail(mailOptions);

    if (process.env.NODE_ENV === "development") {
      console.log(`✓ Booking cancellation email sent`);
      console.log(`  Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }

    return true;
  } catch (error) {
    console.error("Failed to send booking cancellation email:", error.message);
    return false;
  }
};

module.exports = {
  initializeEmailService,
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
};
