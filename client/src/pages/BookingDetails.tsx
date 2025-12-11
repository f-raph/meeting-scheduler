import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Chip,
  Grid,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
} from "@mui/material";
import { format } from "date-fns";
import { useQuery, useMutation } from "react-query";
import { bookingsApi } from "../services/api";
import {
  CheckCircle,
  Error,
  Schedule,
  VideoCall,
  Payment,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import { useWithSlug } from "../hooks/useTenantSlug";
import PaymentDialog from "../components/Booking/PaymentDialog";

interface BookingDetailsData {
  _id: string;
  startTime: string;
  endTime: string;
  status: string;
  paymentStatus: string;
  meetingType: string;
  description: string;
  amount: number;
  currency: string;
  meetingLink?: string;
  client: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  duration: number;
  notes?: string;
}

const BookingDetails: React.FC = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const withSlug = useWithSlug();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const {
    data: bookingData,
    isLoading,
    error,
  } = useQuery(
    ["booking", bookingId],
    () => bookingsApi.getBooking(bookingId || ""),
    {
      enabled: !!bookingId,
    }
  );

  const cancelMutation = useMutation(
    () => bookingsApi.cancelBooking(bookingId || "", "Cancelled by user"),
    {
      onSuccess: () => {
        toast.success("Booking cancelled successfully");
        setCancelDialogOpen(false);
        setTimeout(() => navigate(withSlug("/")), 1500);
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || "Failed to cancel booking");
      },
    }
  );

  const booking: BookingDetailsData | undefined = bookingData?.data?.booking;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "success";
      case "pending":
        return "warning";
      case "cancelled":
        return "error";
      case "completed":
        return "info";
      default:
        return "default";
    }
  };

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus) {
      case "paid":
        return "success";
      case "pending":
        return "warning";
      case "failed":
        return "error";
      case "refunded":
        return "info";
      default:
        return "default";
    }
  };

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "400px",
          }}
        >
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !booking) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          Failed to load booking details. Please try again later.
        </Alert>
        <Button
          variant="contained"
          onClick={() => navigate(withSlug("/my-bookings"))}
          sx={{ mt: 2 }}
        >
          Back to My Bookings
        </Button>
      </Container>
    );
  }

  const isUpcoming = new Date(booking.startTime) > new Date();
  const canCancel =
    booking.status === "pending" ||
    (booking.status === "confirmed" && isUpcoming);

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h3" component="h1">
          Booking Details
        </Typography>
        <Button variant="outlined" onClick={() => navigate(withSlug("/"))}>
          Back to Home
        </Button>
      </Box>

      <Paper elevation={3} sx={{ p: 4 }}>
        {/* Status Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Status
          </Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Chip
              icon={
                booking.status === "confirmed" ? <CheckCircle /> : <Schedule />
              }
              label={`Booking: ${
                booking.status.charAt(0).toUpperCase() + booking.status.slice(1)
              }`}
              color={getStatusColor(booking.status) as any}
              variant="outlined"
            />
            <Chip
              icon={
                booking.paymentStatus === "paid" ? <CheckCircle /> : <Error />
              }
              label={`Payment: ${
                booking.paymentStatus.charAt(0).toUpperCase() +
                booking.paymentStatus.slice(1)
              }`}
              color={getPaymentStatusColor(booking.paymentStatus) as any}
              variant="outlined"
            />
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Meeting Details */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Meeting Details
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Meeting Type:</strong>
              </Typography>
              <Typography variant="body1" gutterBottom>
                {booking.meetingType.charAt(0).toUpperCase() +
                  booking.meetingType.slice(1).replace(/-/g, " ")}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Duration:</strong>
              </Typography>
              <Typography variant="body1" gutterBottom>
                {booking.duration} minutes
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Date:</strong>
              </Typography>
              <Typography variant="body1" gutterBottom>
                {format(new Date(booking.startTime), "EEEE, MMMM d, yyyy")}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Time:</strong>
              </Typography>
              <Typography variant="body1" gutterBottom>
                {format(new Date(booking.startTime), "h:mm a")} -{" "}
                {format(new Date(booking.endTime), "h:mm a")}
              </Typography>
            </Grid>
            {booking.description && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Description:</strong>
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {booking.description}
                </Typography>
              </Grid>
            )}
            {booking.notes && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Notes:</strong>
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {booking.notes}
                </Typography>
              </Grid>
            )}
          </Grid>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Payment Details */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Payment Details
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Amount:</strong>
              </Typography>
              <Typography variant="body1" gutterBottom>
                {booking.currency.toUpperCase()}{" "}
                {Number(booking.amount).toLocaleString()}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Status:</strong>
              </Typography>
              <Typography variant="body1" gutterBottom>
                {booking.paymentStatus.charAt(0).toUpperCase() +
                  booking.paymentStatus.slice(1)}
              </Typography>
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Meeting Link Section */}
        {booking.status === "confirmed" && booking.meetingLink && (
          <>
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                Meeting Link
              </Typography>
              <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2 }}>
                Your Google Meet link is ready. Click the button below to join.
              </Alert>
              <Button
                variant="contained"
                color="success"
                href={booking.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<VideoCall />}
              >
                Join Google Meet
              </Button>
            </Box>
            <Divider sx={{ my: 3 }} />
          </>
        )}

        {/* Action Buttons */}
        <Box
          sx={{
            display: "flex",
            gap: 2,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          {/* Retry Payment Button for pending payments */}
          {booking.status === "pending" &&
            booking.paymentStatus === "pending" && (
              <Button
                variant="contained"
                color="primary"
                onClick={() => setPaymentDialogOpen(true)}
                startIcon={<Payment />}
              >
                Complete Payment
              </Button>
            )}

          {booking.status === "confirmed" &&
            booking.meetingLink &&
            isUpcoming && (
              <Button
                variant="contained"
                color="primary"
                href={booking.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<VideoCall />}
              >
                Join Meeting Now
              </Button>
            )}

          {canCancel && (
            <Button
              variant="outlined"
              color="error"
              onClick={() => setCancelDialogOpen(true)}
              disabled={cancelMutation.isLoading}
            >
              Cancel Booking
            </Button>
          )}

          <Button variant="outlined" onClick={() => navigate(withSlug("/"))}>
            Back to Home
          </Button>
        </Box>
      </Paper>

      {/* Cancel Confirmation Dialog */}
      <Dialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
      >
        <DialogTitle>Cancel Booking</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to cancel this booking?
          </Typography>
          {booking.paymentStatus === "paid" && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Since payment has been made, you will receive a refund to your
              original payment method.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>
            Keep Booking
          </Button>
          <Button
            onClick={() => cancelMutation.mutate()}
            color="error"
            variant="contained"
            disabled={cancelMutation.isLoading}
          >
            {cancelMutation.isLoading ? "Cancelling..." : "Cancel Booking"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Dialog for retrying payment */}
      {booking && (
        <PaymentDialog
          open={paymentDialogOpen}
          onClose={() => setPaymentDialogOpen(false)}
          bookingId={booking._id}
          amount={booking.amount}
          onSuccess={() => {
            setPaymentDialogOpen(false);
            toast.success("Redirecting to payment...");
            // Note: User will be redirected to Paystack, then back to payment callback
            // which will handle the success flow
          }}
        />
      )}
    </Container>
  );
};

export default BookingDetails;
