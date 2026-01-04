import React, { useState } from "react";
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { format } from "date-fns";
import Calendar from "react-calendar";
// @ts-ignore: no type declarations for this CSS side-effect import
import "react-calendar/dist/Calendar.css";
import { bookingsApi, paymentsApi, meetingTypesApi } from "../services/api";
import { useWithSlug } from "../hooks/useTenantSlug";
import { toast } from "react-toastify";

interface TimeSlot {
  startTime: string;
  endTime: string;
  duration: number;
}

const BookingPage: React.FC = () => {
  const withSlug = useWithSlug();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingData, setBookingData] = useState({
    meetingType: "consultation",
    meetingTypeId: "",
    description: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
  });

  // Get available meeting types
  const { data: meetingTypesData } = useQuery(
    ["meeting-types"],
    () => meetingTypesApi.getAll(),
    {
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    }
  );

  const meetingTypes = meetingTypesData?.data?.meetingTypes || [];

  // Get available slots for selected date (No change here)
  const { data: slotsData, isLoading: slotsLoading } = useQuery(
    ["available-slots", format(selectedDate, "yyyy-MM-dd")],
    () => bookingsApi.getAvailableSlots(format(selectedDate, "yyyy-MM-dd")),
    {
      enabled: !!selectedDate,
    }
  );

  // --- NEW: Step 2 Mutation (Initialize Payment) ---
  const initializePaymentMutation = useMutation(
    (bookingId: string) => paymentsApi.initializePayment(bookingId),
    {
      onSuccess: (response) => {
        // This is the redirect!
        const { authorization_url } = response.data;
        if (authorization_url) {
          window.location.href = authorization_url;
        } else {
          toast.error("Could not get payment link. Please try again.");
        }
      },
      onError: (error: any) => {
        toast.error(
          error.response?.data?.error || "Failed to initialize payment"
        );
      },
    }
  );

  // --- MODIFIED: Step 1 Mutation (Create Booking) ---
  const createBookingMutation = useMutation(
    (data: any) => bookingsApi.createBooking(data),
    {
      onSuccess: (response) => {
        const { booking, isFree } = response.data;

        queryClient.invalidateQueries(["available-slots"]);
        setShowBookingForm(false);
        setSelectedSlot(null);

        // If free meeting, show success and redirect to booking details
        if (isFree) {
          toast.success(
            "Free booking confirmed! Check your email for meeting details."
          );
          setTimeout(() => {
            window.location.href = withSlug(`/bookings/${booking._id}`);
          }, 2000);
          return;
        }

        // For paid meetings, initialize payment
        toast.success("Booking created. Redirecting to payment...");
        const newBookingId = booking._id;
        if (newBookingId) {
          initializePaymentMutation.mutate(newBookingId);
        } else {
          toast.error("Could not get booking ID. Please try again.");
        }
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || "Failed to create booking");
      },
    }
  );

  const handleDateChange = (value: any) => {
    // (No change here)
    if (value instanceof Date) {
      setSelectedDate(value);
      setSelectedSlot(null);
    }
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setShowBookingForm(true);
  };

  const handleBookingSubmit = () => {
    if (!selectedSlot) return;

    // Validate client info
    if (!bookingData.clientName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!bookingData.clientEmail.trim()) {
      toast.error("Please enter your email");
      return;
    }

    const bookingPayload = {
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
      meetingType: bookingData.meetingType,
      meetingTypeId: bookingData.meetingTypeId || undefined,
      description: bookingData.description,
      clientName: bookingData.clientName,
      clientEmail: bookingData.clientEmail,
      clientPhone: bookingData.clientPhone,
    };

    createBookingMutation.mutate(bookingPayload);
  };

  // We need one "loading" state for this whole process
  const isBookingLoading =
    createBookingMutation.isLoading || initializePaymentMutation.isLoading;

  const availableSlots = slotsData?.data?.availableSlots || [];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* (No change to the main page UI, only the Dialog) */}
      <Typography variant="h3" component="h1" gutterBottom align="center">
        Book a Meeting
      </Typography>
      <Typography
        variant="h6"
        component="p"
        align="center"
        color="text.secondary"
        sx={{ mb: 4 }}
      >
        Select a date and time that works for you
      </Typography>

      <Grid container spacing={4}>
        {/* Calendar Section */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Select Date
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Calendar
                onChange={handleDateChange}
                value={selectedDate}
                minDate={new Date()}
                maxDate={new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)} // 90 days ahead
              />
            </Box>
          </Paper>
        </Grid>

        {/* Time Slots Section */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Available Times
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </Typography>

            {slotsLoading ? (
              <Typography>Loading available times...</Typography>
            ) : availableSlots.length === 0 ? (
              <Alert severity="info">
                No available time slots for this date. Please select another
                date.
              </Alert>
            ) : (
              <Grid container spacing={2}>
                {availableSlots.map((slot: TimeSlot, index: number) => (
                  <Grid item xs={6} sm={4} key={index}>
                    <Card
                      sx={{
                        cursor: "pointer",
                        "&:hover": {
                          backgroundColor: "action.hover",
                        },
                        border: selectedSlot === slot ? 2 : 0,
                        borderColor: "primary.main",
                      }}
                      onClick={() => handleSlotSelect(slot)}
                    >
                      <CardContent sx={{ textAlign: "center", py: 2 }}>
                        <Typography variant="body1" fontWeight="medium">
                          {format(new Date(slot.startTime), "h:mm a")}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Pricing Info */}
      <Box sx={{ mt: 4, textAlign: "center" }}>
        <Paper
          elevation={1}
          sx={{
            p: 3,
            backgroundColor: "#12305a",
            border: "1px solid rgba(25, 193, 255, 0.18)",
          }}
        >
          <Typography variant="h6" gutterBottom sx={{ color: "#e5f0ff" }}>
            Select a meeting type above to see pricing and duration
          </Typography>
          <Typography variant="body2" sx={{ color: "#b7c8e8" }}>
            Each booking includes Google Meet link, calendar invite, and email
            confirmations
          </Typography>
        </Paper>
      </Box>

      {/* Booking Form Dialog (MODIFIED) */}
      <Dialog
        open={showBookingForm}
        onClose={() => setShowBookingForm(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Your Booking</DialogTitle>
        <DialogContent>
          {selectedSlot && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Selected Time:
              </Typography>
              <Typography variant="body1" color="primary">
                {format(new Date(selectedSlot.startTime), "EEEE, MMMM d, yyyy")}{" "}
                at {format(new Date(selectedSlot.startTime), "h:mm a")} -{" "}
                {format(new Date(selectedSlot.endTime), "h:mm a")}
              </Typography>
            </Box>
          )}

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Your Information
          </Typography>

          <TextField
            fullWidth
            required
            label="Full Name"
            value={bookingData.clientName}
            onChange={(e) =>
              setBookingData({ ...bookingData, clientName: e.target.value })
            }
            sx={{ mb: 2 }}
            disabled={isBookingLoading}
          />

          <TextField
            fullWidth
            required
            type="email"
            label="Email Address"
            value={bookingData.clientEmail}
            onChange={(e) =>
              setBookingData({ ...bookingData, clientEmail: e.target.value })
            }
            sx={{ mb: 2 }}
            disabled={isBookingLoading}
            helperText="Meeting confirmation will be sent to this email"
          />

          <TextField
            fullWidth
            label="Phone Number (Optional)"
            value={bookingData.clientPhone}
            onChange={(e) =>
              setBookingData({ ...bookingData, clientPhone: e.target.value })
            }
            sx={{ mb: 3 }}
            disabled={isBookingLoading}
          />

          {meetingTypes.length > 0 ? (
            <TextField
              select
              fullWidth
              label="Meeting Type"
              value={bookingData.meetingTypeId}
              onChange={(e) => {
                const selectedType = meetingTypes.find(
                  (t: any) => t._id === e.target.value
                );
                setBookingData({
                  ...bookingData,
                  meetingTypeId: e.target.value,
                  meetingType: selectedType?.name || "consultation",
                });
              }}
              sx={{ mb: 2 }}
              disabled={isBookingLoading}
              required
            >
              {meetingTypes.map((type: any) => (
                <MenuItem key={type._id} value={type._id}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      gap: 1,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          backgroundColor: type.color || "#19c1ff",
                          border: "1px solid rgba(0,0,0,0.12)",
                        }}
                      />
                      <Typography>{type.name}</Typography>
                    </Box>
                    <Typography color="text.secondary" sx={{ ml: 2 }}>
                      {type.currency || "USD"} {type.price.toLocaleString()} •{" "}
                      {type.duration}min
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <Alert severity="warning" sx={{ mb: 2 }}>
              No meeting types available. Please contact the administrator.
            </Alert>
          )}

          <TextField
            fullWidth
            multiline
            rows={4}
            label="Meeting Description (Optional)"
            placeholder="Please describe what you'd like to discuss..."
            value={bookingData.description}
            onChange={(e) =>
              setBookingData({ ...bookingData, description: e.target.value })
            }
            disabled={isBookingLoading}
          />

          <Alert severity="info" sx={{ mt: 2 }}>
            After confirming, you'll be redirected to secure payment processing.
            Once payment is complete, you'll receive a calendar invite and
            Google Meet link.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowBookingForm(false)}
            disabled={isBookingLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleBookingSubmit}
            variant="contained"
            disabled={
              isBookingLoading ||
              !bookingData.meetingTypeId ||
              !bookingData.clientName.trim() ||
              !bookingData.clientEmail.trim()
            }
            startIcon={
              isBookingLoading ? (
                <CircularProgress size={20} color="inherit" />
              ) : null
            }
          >
            {isBookingLoading
              ? "Processing..."
              : bookingData.meetingTypeId
              ? (() => {
                  const selectedType = meetingTypes.find(
                    (t: any) => t._id === bookingData.meetingTypeId
                  );
                  return selectedType?.price === 0
                    ? "Confirm Free Booking"
                    : `Confirm & Pay ${selectedType?.currency || "USD"} ${
                        selectedType?.price.toLocaleString() || 0
                      }`;
                })()
              : "Select Meeting Type"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BookingPage;
