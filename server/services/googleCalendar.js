const { google } = require('googleapis');
const Availability = require('../models/Availability');
const Booking = require('../models/Booking');

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
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });
    }

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  async getAvailableSlots(date, duration = 60) {
    try {
      const targetDate = new Date(date);
      const dayOfWeek = targetDate.getDay();

      // Get availability for this day
      const availability = await Availability.find({
        $or: [
          { dayOfWeek, isActive: true, specificDate: null },
          { 
            specificDate: {
              $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
              $lt: new Date(targetDate.setHours(23, 59, 59, 999))
            },
            isActive: true
          }
        ]
      });

      if (!availability.length) {
        return [];
      }

      // Get existing bookings for this date
      const existingBookings = await Booking.find({
        startTime: {
          $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
          $lt: new Date(targetDate.setHours(23, 59, 59, 999))
        },
        status: { $in: ['confirmed', 'pending'] }
      });

      const availableSlots = [];

      for (const slot of availability) {
        const slots = this.generateTimeSlots(
          targetDate,
          slot.startTime,
          slot.endTime,
          duration,
          slot.breakTimes || [],
          existingBookings
        );
        availableSlots.push(...slots);
      }

      return availableSlots.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    } catch (error) {
      console.error('Get available slots error:', error);
      throw new Error('Failed to get available slots');
    }
  }

  generateTimeSlots(date, startTime, endTime, duration, breakTimes, existingBookings) {
    const slots = [];
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    let currentTime = new Date(date);
    currentTime.setHours(startHour, startMin, 0, 0);

    const endDateTime = new Date(date);
    endDateTime.setHours(endHour, endMin, 0, 0);

    while (currentTime < endDateTime) {
      const slotEnd = new Date(currentTime.getTime() + duration * 60 * 1000);

      if (slotEnd <= endDateTime) {
        // Check if this slot conflicts with break times
        const isBreakTime = breakTimes.some(breakTime => {
          const [breakStartHour, breakStartMin] = breakTime.startTime.split(':').map(Number);
          const [breakEndHour, breakEndMin] = breakTime.endTime.split(':').map(Number);

          const breakStart = new Date(date);
          breakStart.setHours(breakStartHour, breakStartMin, 0, 0);

          const breakEnd = new Date(date);
          breakEnd.setHours(breakEndHour, breakEndMin, 0, 0);

          return (currentTime < breakEnd && slotEnd > breakStart);
        });

        // Check if this slot conflicts with existing bookings
        const isBooked = existingBookings.some(booking => {
          return (currentTime < booking.endTime && slotEnd > booking.startTime);
        });

        // Only add slot if it's not in break time, not booked, and not in the past
        if (!isBreakTime && !isBooked && currentTime > new Date()) {
          slots.push({
            startTime: new Date(currentTime),
            endTime: new Date(slotEnd),
            duration
          });
        }
      }

      // Move to next slot (usually 15 or 30 minute intervals)
      currentTime.setMinutes(currentTime.getMinutes() + (duration >= 60 ? 30 : 15));
    }

    return slots;
  }

  async createEvent({ startTime, endTime, title, description, attendeeEmail, clientName, meetingType }) {
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
          timeZone: 'UTC',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'UTC',
        },
        attendees: [
          { email: attendeeEmail },
          { email: process.env.ADMIN_EMAIL }
        ],
        conferenceData: {
          createRequest: {
            requestId: meetingId,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24 hours before
            { method: 'email', minutes: 60 }, // 1 hour before
            { method: 'popup', minutes: 15 }, // 15 minutes before
          ],
        },
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        conferenceDataVersion: 1,
        sendNotifications: true
      });

      return {
        id: response.data.id,
        meetLink: response.data.conferenceData?.entryPoints?.[0]?.uri || meetLink,
        htmlLink: response.data.htmlLink
      };
    } catch (error) {
      console.error('Create calendar event error:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  async cancelEvent(eventId) {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendNotifications: true
      });

      return { success: true };
    } catch (error) {
      console.error('Cancel calendar event error:', error);
      throw new Error('Failed to cancel calendar event');
    }
  }

  async updateEvent(eventId, updates) {
    try {
      const response = await this.calendar.events.patch({
        calendarId: 'primary',
        eventId: eventId,
        resource: updates,
        sendNotifications: true
      });

      return response.data;
    } catch (error) {
      console.error('Update calendar event error:', error);
      throw new Error('Failed to update calendar event');
    }
  }

  generateMeetingId() {
    // Generate a random meeting ID similar to Google Meet format
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const segments = [];
    
    for (let i = 0; i < 3; i++) {
      let segment = '';
      for (let j = 0; j < 4; j++) {
        segment += chars[Math.floor(Math.random() * chars.length)];
      }
      segments.push(segment);
    }
    
    return segments.join('-');
  }
}

module.exports = new GoogleCalendarService();