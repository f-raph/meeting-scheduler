const { google } = require("googleapis");
const Availability = require("../models/Availability");
const Booking = require("../models/Booking");

class GoogleCalendarService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Set credentials if refresh token is available
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      });
    }

    this.calendar = google.calendar({ version: "v3", auth: this.oauth2Client });
  }

  // IN: services/googleCalendar.js
  // REPLACE the ENTIRE 'getAvailableSlots' function with this:

  async getAvailableSlots(date, duration = 60) {
    try {
      // Force local date parsing
      const targetDate = new Date(date + "T00:00:00");
      const dayOfWeek = targetDate.getDay();

      // --- Step 1: Get Master Rules (from your app's database) ---
      const availability = await Availability.find({
        $or: [
          { dayOfWeek, isActive: true, specificDate: null },
          {
            specificDate: {
              $gte: new Date(new Date(targetDate).setHours(0, 0, 0, 0)),
              $lt: new Date(new Date(targetDate).setHours(23, 59, 59, 999)),
            },
            isActive: true,
          },
        ],
      });

      if (!availability.length) {
        return [];
      }

      // --- Step 2: Get App's Existing Bookings (from your app's database) ---
      const bookingsStartTime = new Date(targetDate).setHours(0, 0, 0, 0);
      const bookingsEndTime = new Date(targetDate).setHours(23, 59, 59, 999);

      const existingBookings = await Booking.find({
        startTime: {
          $gte: bookingsStartTime,
          $lt: bookingsEndTime,
        },
        status: { $in: ["confirmed", "pending"] },
      });

      // --- Step 3: Get Google Calendar Busy Times (if configured) ---
      const timeMin = new Date(targetDate).setHours(0, 0, 0, 0);
      const timeMax = new Date(targetDate).setHours(23, 59, 59, 999);
      let googleBusyTimes = [];

      if (this.oauth2Client.credentials?.refresh_token) {
        try {
          const freeBusyResponse = await this.calendar.freebusy.query({
            resource: {
              timeMin: new Date(timeMin).toISOString(),
              timeMax: new Date(timeMax).toISOString(),
              items: [{ id: "primary" }],
            },
          });
          googleBusyTimes = freeBusyResponse.data.calendars.primary.busy || [];
        } catch (fbError) {
          console.error(
            "Failed to fetch Google Calendar free/busy times:",
            fbError
          );
          // Continue without google busy times
          googleBusyTimes = [];
        }
      } else {
        // Not configured - skip Google busy checks
        googleBusyTimes = [];
      }

      // --- Step 4: Calculate Final Slots (combine app bookings + google busy times) ---
      const availableSlots = [];

      for (const slot of availability) {
        const slots = this.generateTimeSlots(
          targetDate,
          slot.startTime,
          slot.endTime,
          duration,
          slot.breakTimes || [],
          existingBookings,
          googleBusyTimes
        );
        availableSlots.push(...slots);
      }

      return availableSlots.sort(
        (a, b) => new Date(a.startTime) - new Date(b.startTime)
      );
    } catch (error) {
      console.error("Get available slots error:", error);
      throw new Error("Failed to get available slots");
    }
  }

  // 2nd Version
  // async getAvailableSlots(date, duration = 60) {
  //   try {
  //     // *** THIS IS THE FIX ***
  //     // We append 'T00:00:00' to force the date to be parsed
  //     // in the server's local timezone, not as UTC.
  //     const targetDate = new Date(date + "T00:00:00");
  //     // ***********************

  //     const dayOfWeek = targetDate.getDay();

  //     // --- Step 1: Get Master Rules (from your app's database) ---
  //     const availability = await Availability.find({
  //       $or: [
  //         { dayOfWeek, isActive: true, specificDate: null },
  //         {
  //           specificDate: {
  //             $gte: new Date(new Date(targetDate).setHours(0, 0, 0, 0)),
  //             $lt: new Date(new Date(targetDate).setHours(23, 59, 59, 999)),
  //           },
  //           isActive: true,
  //         },
  //       ],
  //     });

  //     if (!availability.length) {
  //       return [];
  //     }

  //     // --- Step 2: Get App's Existing Bookings (from your app's database) ---
  //     // We use 'new Date(targetDate)' to avoid mutating the original
  //     const bookingsStartTime = new Date(targetDate).setHours(0, 0, 0, 0);
  //     const bookingsEndTime = new Date(targetDate).setHours(23, 59, 59, 999);

  //     const existingBookings = await Booking.find({
  //       startTime: {
  //         $gte: bookingsStartTime,
  //         $lt: bookingsEndTime,
  //       },
  //       status: { $in: ["confirmed", "pending"] },
  //     });

  //     // --- Step 3: Get Google Calendar Busy Times (NEW) ---
  //     // We use 'new Date(targetDate)' to avoid mutating the original
  //     const timeMin = new Date(targetDate).setHours(0, 0, 0, 0);
  //     const timeMax = new Date(targetDate).setHours(23, 59, 59, 999);
  //     let googleBusyTimes = [];

  //     try {
  //       const freeBusyResponse = await this.calendar.freebusy.query({
  //         resource: {
  //           // .toISOString() is correct here, as Google API needs UTC
  //           timeMin: new Date(timeMin).toISOString(),
  //           timeMax: new Date(timeMax).toISOString(),
  //           items: [{ id: "primary" }], // Checks your primary calendar
  //         },
  //       });
  //       googleBusyTimes = freeBusyResponse.data.calendars.primary.busy;
  //     } catch (fbError) {
  //       console.error(
  //         "Failed to fetch Google Calendar free/busy times:",
  //         fbError
  //       );
  //       // Continue without this check if Google API fails
  //     }

  //     // --- Step 4: Calculate Final Slots (Modified) ---
  //     const availableSlots = [];

  //     for (const slot of availability) {
  //       // We now pass all 3 conflict lists to the helper function
  //       const slots = this.generateTimeSlots(
  //         targetDate, // Pass the original local date
  //         slot.startTime,
  //         slot.endTime,
  //         duration,
  //         slot.breakTimes || [],
  //         existingBookings,
  //         googleBusyTimes // <--- The new argument
  //       );
  //       availableSlots.push(...slots);
  //     }

  //     return availableSlots.sort(
  //       (a, b) => new Date(a.startTime) - new Date(b.startTime)
  //     );
  //   } catch (error) {
  //     console.error("Get available slots error:", error);
  //     throw new Error("Failed to get available slots");
  //   }
  // }

  // 1st Version
  // async getAvailableSlots(date, duration = 60) {
  //   try {
  //     const targetDate = new Date(date);
  //     const dayOfWeek = targetDate.getDay();

  //     // --- Step 1: Get Master Rules (from your app's database) ---
  //     const availability = await Availability.find({
  //       $or: [
  //         { dayOfWeek, isActive: true, specificDate: null },
  //         {
  //           specificDate: {
  //             $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
  //             $lt: new Date(targetDate.setHours(23, 59, 59, 999)),
  //           },
  //           isActive: true,
  //         },
  //       ],
  //     });

  //     if (!availability.length) {
  //       return [];
  //     }

  //     // --- Step 2: Get App's Existing Bookings (from your app's database) ---
  //     const existingBookings = await Booking.find({
  //       startTime: {
  //         $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
  //         $lt: new Date(targetDate.setHours(23, 59, 59, 999)),
  //       },
  //       status: { $in: ["confirmed", "pending"] },
  //     });

  //     // --- Step 3: Get Google Calendar Busy Times (NEW) ---
  //     const timeMin = new Date(targetDate.setHours(0, 0, 0, 0));
  //     const timeMax = new Date(targetDate.setHours(23, 59, 59, 999));
  //     let googleBusyTimes = [];

  //     try {
  //       const freeBusyResponse = await this.calendar.freebusy.query({
  //         resource: {
  //           timeMin: timeMin.toISOString(),
  //           timeMax: timeMax.toISOString(),
  //           items: [{ id: "primary" }], // Checks your primary calendar
  //         },
  //       });
  //       googleBusyTimes = freeBusyResponse.data.calendars.primary.busy;
  //     } catch (fbError) {
  //       console.error(
  //         "Failed to fetch Google Calendar free/busy times:",
  //         fbError
  //       );
  //       // Continue without this check if Google API fails
  //     }

  //     // --- Step 4: Calculate Final Slots (Modified) ---
  //     const availableSlots = [];

  //     for (const slot of availability) {
  //       // We now pass all 3 conflict lists to the helper function
  //       const slots = this.generateTimeSlots(
  //         targetDate,
  //         slot.startTime,
  //         slot.endTime,
  //         duration,
  //         slot.breakTimes || [],
  //         existingBookings,
  //         googleBusyTimes // <--- The new argument
  //       );
  //       availableSlots.push(...slots);
  //     }

  //     return availableSlots.sort(
  //       (a, b) => new Date(a.startTime) - new Date(b.startTime)
  //     );
  //   } catch (error) {
  //     console.error("Get available slots error:", error);
  //     throw new Error("Failed to get available slots");
  //   }
  // }

  /**
   * Helper function to generate time slots, now with 3 conflict checks:
   * 1. breakTimes (from your app)
   * 2. existingBookings (from your app)
   * 3. googleBusyTimes (from Google Calendar)
   */
  generateTimeSlots(
    date,
    startTime,
    endTime,
    duration,
    breakTimes,
    existingBookings,
    googleBusyTimes
  ) {
    const slots = [];
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);

    let currentTime = new Date(date);
    currentTime.setHours(startHour, startMin, 0, 0);

    const endDateTime = new Date(date);
    endDateTime.setHours(endHour, endMin, 0, 0);

    while (currentTime < endDateTime) {
      const slotEnd = new Date(currentTime.getTime() + duration * 60 * 1000);

      if (slotEnd <= endDateTime) {
        // Check 1: Conflict with break times (from your app)
        const isBreakTime = breakTimes.some((breakTime) => {
          const [breakStartHour, breakStartMin] = breakTime.startTime
            .split(":")
            .map(Number);
          const [breakEndHour, breakEndMin] = breakTime.endTime
            .split(":")
            .map(Number);

          const breakStart = new Date(date);
          breakStart.setHours(breakStartHour, breakStartMin, 0, 0);

          const breakEnd = new Date(date);
          breakEnd.setHours(breakEndHour, breakEndMin, 0, 0);

          return currentTime < breakEnd && slotEnd > breakStart;
        });

        // Check 2: Conflict with existing bookings (from your app)
        const isBooked = existingBookings.some((booking) => {
          return currentTime < booking.endTime && slotEnd > booking.startTime;
        });

        // Check 3: Conflict with Google Calendar busy times (NEW)
        const isGoogleBusy = googleBusyTimes.some((busySlot) => {
          const busyStart = new Date(busySlot.start);
          const busyEnd = new Date(busySlot.end);

          // Check for any overlap
          return currentTime < busyEnd && slotEnd > busyStart;
        });

        // Only add slot if it's not a break, not booked, not busy, and not in the past
        if (
          !isBreakTime &&
          !isBooked &&
          !isGoogleBusy &&
          currentTime > new Date()
        ) {
          slots.push({
            startTime: new Date(currentTime),
            endTime: new Date(slotEnd),
            duration,
          });
        }
      }

      // Move to next slot (usually 15 or 30 minute intervals)
      currentTime.setMinutes(
        currentTime.getMinutes() + (duration >= 60 ? 30 : 15)
      );
    }

    return slots;
  }

  async createEvent({
    startTime,
    endTime,
    title,
    description,
    attendeeEmail,
    clientName,
    meetingType,
  }) {
    try {
      // Create Google Meet link
      const meetingId = this.generateMeetingId();
      const meetLink = `https://meet.google.com/${meetingId}`;

      const event = {
        summary: title,
        description: `
${description}

Meeting Type: ${meetingType}
Client: ${clientName}
Meeting Link: ${meetLink}

Please join the meeting using the link above.
        `.trim(),
        start: {
          dateTime: startTime.toISOString(),
          timeZone: "UTC",
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: "UTC",
        },
        attendees: [
          { email: attendeeEmail },
          { email: process.env.ADMIN_EMAIL },
        ],
        conferenceData: {
          createRequest: {
            requestId: meetingId,
            conferenceSolutionKey: {
              type: "hangoutsMeet",
            },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 }, // 24 hours before
            { method: "email", minutes: 60 }, // 1 hour before
            { method: "popup", minutes: 15 }, // 15 minutes before
          ],
        },
      };

      const response = await this.calendar.events.insert({
        calendarId: "primary",
        resource: event,
        conferenceDataVersion: 1,
        sendNotifications: true,
      });

      return {
        id: response.data.id,
        meetLink:
          response.data.conferenceData?.entryPoints?.[0]?.uri || meetLink,
        htmlLink: response.data.htmlLink,
      };
    } catch (error) {
      console.error("Create calendar event error:", error);
      throw new Error("Failed to create calendar event");
    }
  }

  async cancelEvent(eventId) {
    try {
      await this.calendar.events.delete({
        calendarId: "primary",
        eventId: eventId,
        sendNotifications: true,
      });

      return { success: true };
    } catch (error) {
      console.error("Cancel calendar event error:", error);
      throw new Error("Failed to cancel calendar event");
    }
  }

  async updateEvent(eventId, updates) {
    try {
      const response = await this.calendar.events.patch({
        calendarId: "primary",
        eventId: eventId,
        resource: updates,
        sendNotifications: true,
      });

      return response.data;
    } catch (error) {
      console.error("Update calendar event error:", error);
      throw new Error("Failed to update calendar event");
    }
  }

  generateMeetingId() {
    // Generate a random meeting ID similar to Google Meet format
    const chars = "abcdefghijklmnopqrstuvwxyz";
    const segments = [];

    for (let i = 0; i < 3; i++) {
      let segment = "";
      for (let j = 0; j < 4; j++) {
        segment += chars[Math.floor(Math.random() * chars.length)];
      }
      segments.push(segment);
    }

    return segments.join("-");
  }
}

module.exports = new GoogleCalendarService();

// const { google } = require('googleapis');
// const Availability = require('../models/Availability');
// const Booking = require('../models/Booking');

// class GoogleCalendarService {
//   constructor() {
//     this.oauth2Client = new google.auth.OAuth2(
//       process.env.GOOGLE_CLIENT_ID,
//       process.env.GOOGLE_CLIENT_SECRET,
//       process.env.GOOGLE_REDIRECT_URI
//     );

//     // Set credentials if refresh token is available
//     if (process.env.GOOGLE_REFRESH_TOKEN) {
//       this.oauth2Client.setCredentials({
//         refresh_token: process.env.GOOGLE_REFRESH_TOKEN
//       });
//     }

//     this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
//   }

//   async getAvailableSlots(date, duration = 60) {
//     try {
//       const targetDate = new Date(date);
//       const dayOfWeek = targetDate.getDay();

//       // Get availability for this day
//       const availability = await Availability.find({
//         $or: [
//           { dayOfWeek, isActive: true, specificDate: null },
//           {
//             specificDate: {
//               $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
//               $lt: new Date(targetDate.setHours(23, 59, 59, 999))
//             },
//             isActive: true
//           }
//         ]
//       });

//       if (!availability.length) {
//         return [];
//       }

//       // Get existing bookings for this date
//       const existingBookings = await Booking.find({
//         startTime: {
//           $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
//           $lt: new Date(targetDate.setHours(23, 59, 59, 999))
//         },
//         status: { $in: ['confirmed', 'pending'] }
//       });

//       const availableSlots = [];

//       for (const slot of availability) {
//         const slots = this.generateTimeSlots(
//           targetDate,
//           slot.startTime,
//           slot.endTime,
//           duration,
//           slot.breakTimes || [],
//           existingBookings
//         );
//         availableSlots.push(...slots);
//       }

//       return availableSlots.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
//     } catch (error) {
//       console.error('Get available slots error:', error);
//       throw new Error('Failed to get available slots');
//     }
//   }

//   generateTimeSlots(date, startTime, endTime, duration, breakTimes, existingBookings) {
//     const slots = [];
//     const [startHour, startMin] = startTime.split(':').map(Number);
//     const [endHour, endMin] = endTime.split(':').map(Number);

//     let currentTime = new Date(date);
//     currentTime.setHours(startHour, startMin, 0, 0);

//     const endDateTime = new Date(date);
//     endDateTime.setHours(endHour, endMin, 0, 0);

//     while (currentTime < endDateTime) {
//       const slotEnd = new Date(currentTime.getTime() + duration * 60 * 1000);

//       if (slotEnd <= endDateTime) {
//         // Check if this slot conflicts with break times
//         const isBreakTime = breakTimes.some(breakTime => {
//           const [breakStartHour, breakStartMin] = breakTime.startTime.split(':').map(Number);
//           const [breakEndHour, breakEndMin] = breakTime.endTime.split(':').map(Number);

//           const breakStart = new Date(date);
//           breakStart.setHours(breakStartHour, breakStartMin, 0, 0);

//           const breakEnd = new Date(date);
//           breakEnd.setHours(breakEndHour, breakEndMin, 0, 0);

//           return (currentTime < breakEnd && slotEnd > breakStart);
//         });

//         // Check if this slot conflicts with existing bookings
//         const isBooked = existingBookings.some(booking => {
//           return (currentTime < booking.endTime && slotEnd > booking.startTime);
//         });

//         // Only add slot if it's not in break time, not booked, and not in the past
//         if (!isBreakTime && !isBooked && currentTime > new Date()) {
//           slots.push({
//             startTime: new Date(currentTime),
//             endTime: new Date(slotEnd),
//             duration
//           });
//         }
//       }

//       // Move to next slot (usually 15 or 30 minute intervals)
//       currentTime.setMinutes(currentTime.getMinutes() + (duration >= 60 ? 30 : 15));
//     }

//     return slots;
//   }

//   async createEvent({ startTime, endTime, title, description, attendeeEmail, clientName, meetingType }) {
//     try {
//       // Create Google Meet link
//       const meetingId = this.generateMeetingId();
//       const meetLink = `https://meet.google.com/${meetingId}`;

//       const event = {
//         summary: title,
//         description: `
// ${description}

// Meeting Type: ${meetingType}
// Client: ${clientName}
// Meeting Link: ${meetLink}

// Please join the meeting using the link above.
//         `.trim(),
//         start: {
//           dateTime: startTime.toISOString(),
//           timeZone: 'UTC',
//         },
//         end: {
//           dateTime: endTime.toISOString(),
//           timeZone: 'UTC',
//         },
//         attendees: [
//           { email: attendeeEmail },
//           { email: process.env.ADMIN_EMAIL }
//         ],
//         conferenceData: {
//           createRequest: {
//             requestId: meetingId,
//             conferenceSolutionKey: {
//               type: 'hangoutsMeet'
//             }
//           }
//         },
//         reminders: {
//           useDefault: false,
//           overrides: [
//             { method: 'email', minutes: 24 * 60 }, // 24 hours before
//             { method: 'email', minutes: 60 }, // 1 hour before
//             { method: 'popup', minutes: 15 }, // 15 minutes before
//           ],
//         },
//       };

//       const response = await this.calendar.events.insert({
//         calendarId: 'primary',
//         resource: event,
//         conferenceDataVersion: 1,
//         sendNotifications: true
//       });

//       return {
//         id: response.data.id,
//         meetLink: response.data.conferenceData?.entryPoints?.[0]?.uri || meetLink,
//         htmlLink: response.data.htmlLink
//       };
//     } catch (error) {
//       console.error('Create calendar event error:', error);
//       throw new Error('Failed to create calendar event');
//     }
//   }

//   async cancelEvent(eventId) {
//     try {
//       await this.calendar.events.delete({
//         calendarId: 'primary',
//         eventId: eventId,
//         sendNotifications: true
//       });

//       return { success: true };
//     } catch (error) {
//       console.error('Cancel calendar event error:', error);
//       throw new Error('Failed to cancel calendar event');
//     }
//   }

//   async updateEvent(eventId, updates) {
//     try {
//       const response = await this.calendar.events.patch({
//         calendarId: 'primary',
//         eventId: eventId,
//         resource: updates,
//         sendNotifications: true
//       });

//       return response.data;
//     } catch (error) {
//       console.error('Update calendar event error:', error);
//       throw new Error('Failed to update calendar event');
//     }
//   }

//   generateMeetingId() {
//     // Generate a random meeting ID similar to Google Meet format
//     const chars = 'abcdefghijklmnopqrstuvwxyz';
//     const segments = [];

//     for (let i = 0; i < 3; i++) {
//       let segment = '';
//       for (let j = 0; j < 4; j++) {
//         segment += chars[Math.floor(Math.random() * chars.length)];
//       }
//       segments.push(segment);
//     }

//     return segments.join('-');
//   }
// }

// module.exports = new GoogleCalendarService();
