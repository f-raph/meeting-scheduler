import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Chip,
  Button,
  Card,
  CardContent,
  CardActions,
  Alert,
} from "@mui/material";
import { useQuery } from "react-query";
import { format } from "date-fns";
import { bookingsApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useWithSlug } from "../hooks/useTenantSlug";

interface Booking {
  _id: string;
  startTime: string;
  endTime: string;
  status: string;
  paymentStatus: string;
  meetingType: string;
  description: string;
  amount: number;
  meetingLink?: string;
}

const MyBookings: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const withSlug = useWithSlug();

  const {
    data: bookingsData,
    isLoading,
    error,
  } = useQuery(["my-bookings"], () => bookingsApi.getMyBookings(), {
    enabled: isAuthenticated,
  });

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
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography>Loading your bookings...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          Failed to load bookings. Please try again later.
        </Alert>
      </Container>
    );
  }

  const bookings = bookingsData?.data?.bookings || [];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        My Bookings
      </Typography>

      {bookings.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No bookings found
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            You haven't booked any meetings yet.
          </Typography>
          <Button variant="contained" href="/book">
            Book Your First Meeting
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {bookings.map((booking: Booking) => (
            <Grid item xs={12} md={6} lg={4} key={booking._id}>
              <Card elevation={3}>
                <CardContent>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mb: 2,
                    }}
                  >
                    <Chip
                      label={booking.status}
                      color={getStatusColor(booking.status) as any}
                      size="small"
                    />
                    <Chip
                      label={booking.paymentStatus}
                      color={
                        getPaymentStatusColor(booking.paymentStatus) as any
                      }
                      size="small"
                      variant="outlined"
                    />
                  </Box>

                  <Typography variant="h6" gutterBottom>
                    {booking.meetingType.charAt(0).toUpperCase() +
                      booking.meetingType.slice(1)}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    <strong>Date:</strong>{" "}
                    {format(new Date(booking.startTime), "EEEE, MMMM d, yyyy")}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    <strong>Time:</strong>{" "}
                    {format(new Date(booking.startTime), "h:mm a")} -{" "}
                    {format(new Date(booking.endTime), "h:mm a")}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    <strong>Amount:</strong> ${booking.amount}
                  </Typography>

                  {booking.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      <strong>Description:</strong> {booking.description}
                    </Typography>
                  )}

                  {booking.meetingLink && booking.status === "confirmed" && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="primary" gutterBottom>
                        <strong>Meeting Link Available</strong>
                      </Typography>
                    </Box>
                  )}
                </CardContent>

                <CardActions>
                  {booking.meetingLink && booking.status === "confirmed" && (
                    <Button
                      size="small"
                      variant="contained"
                      href={booking.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Join Meeting
                    </Button>
                  )}

                  {booking.status === "pending" && (
                    <Button size="small" color="secondary">
                      Cancel Booking
                    </Button>
                  )}

                  <Button
                    size="small"
                    onClick={() =>
                      navigate(withSlug(`/bookings/${booking._id}`))
                    }
                  >
                    View Details
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default MyBookings;
