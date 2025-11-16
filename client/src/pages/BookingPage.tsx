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
  Chip,
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
import { bookingsApi, paymentsApi } from "../services/api"; // Import paymentsApi
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-toastify";

interface TimeSlot {
  startTime: string;
  endTime: string;
  duration: number;
}

const BookingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingData, setBookingData] = useState({
    meetingType: "consultation",
    description: "",
  });

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
        toast.success("Booking created. Redirecting to payment...");
        queryClient.invalidateQueries(["available-slots"]);
        setShowBookingForm(false);
        setSelectedSlot(null);

        // This is the new part: get the booking ID and trigger Step 2
        const newBookingId = response.data.booking._id;
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
    // (No change here)
    if (!isAuthenticated) {
      toast.info("Please login to book a meeting");
      return;
    }
    setSelectedSlot(slot);
    setShowBookingForm(true);
  };

  const handleBookingSubmit = () => {
    // (No change here)
    if (!selectedSlot) return;

    const bookingPayload = {
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
      meetingType: bookingData.meetingType,
      description: bookingData.description,
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
                tileDisabled={({ date }) => {
                  return date.getDay() === 0 || date.getDay() === 6;
                }}
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
                        <Chip
                          label={`${slot.duration} min`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
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
        <Paper elevation={1} sx={{ p: 3, backgroundColor: "grey.50" }}>
          <Typography variant="h6" gutterBottom>
            Consultation Fee: $50 for 60 minutes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Includes Google Meet link, calendar invite, and email confirmations
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

          <TextField
            select
            fullWidth
            label="Meeting Type"
            value={bookingData.meetingType}
            onChange={(e) =>
              setBookingData({ ...bookingData, meetingType: e.target.value })
            }
            sx={{ mb: 2 }}
            disabled={isBookingLoading}
          >
            <MenuItem value="consultation">Initial Consultation</MenuItem>
            <MenuItem value="follow-up">Follow-up Meeting</MenuItem>
            <MenuItem value="project-discussion">Project Discussion</MenuItem>
          </TextField>

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
            disabled={isBookingLoading}
            startIcon={
              isBookingLoading ? (
                <CircularProgress size={20} color="inherit" />
              ) : null
            }
          >
            {isBookingLoading ? "Processing..." : "Confirm & Pay $50"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BookingPage;

// import React, { useState } from 'react';
// import {
//   Container,
//   Typography,
//   Box,
//   Paper,
//   Grid,
//   Button,
//   Card,
//   CardContent,
//   Chip,
//   Dialog,
//   DialogTitle,
//   DialogContent,
//   DialogActions,
//   TextField,
//   MenuItem,
//   Alert,
// } from '@mui/material';
// import { useQuery, useMutation, useQueryClient } from 'react-query';
// import { format } from 'date-fns';
// import Calendar from 'react-calendar';
// import 'react-calendar/dist/Calendar.css';
// import { bookingsApi } from '../services/api';
// import { useAuth } from '../contexts/AuthContext';
// import { toast } from 'react-toastify';

// interface TimeSlot {
//   startTime: string;
//   endTime: string;
//   duration: number;
// }

// const BookingPage: React.FC = () => {
//   const { isAuthenticated } = useAuth();
//   const queryClient = useQueryClient();
//   const [selectedDate, setSelectedDate] = useState<Date>(new Date());
//   const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
//   const [showBookingForm, setShowBookingForm] = useState(false);
//   const [bookingData, setBookingData] = useState({
//     meetingType: 'consultation',
//     description: '',
//   });

//   // Get available slots for selected date
//   const { data: slotsData, isLoading: slotsLoading } = useQuery(
//     ['available-slots', format(selectedDate, 'yyyy-MM-dd')],
//     () => bookingsApi.getAvailableSlots(format(selectedDate, 'yyyy-MM-dd')),
//     {
//       enabled: !!selectedDate,
//     }
//   );

//   // Create booking mutation
//   const createBookingMutation = useMutation(
//     (data: any) => bookingsApi.createBooking(data),
//     {
//       onSuccess: (response) => {
//         toast.success('Booking created successfully!');
//         queryClient.invalidateQueries(['available-slots']);
//         setShowBookingForm(false);
//         setSelectedSlot(null);
//         // Redirect to payment page or show payment component
//         console.log('Booking created:', response.data);
//       },
//       onError: (error: any) => {
//         toast.error(error.response?.data?.error || 'Failed to create booking');
//       },
//     }
//   );

//   const handleDateChange = (value: any) => {
//     if (value instanceof Date) {
//       setSelectedDate(value);
//       setSelectedSlot(null);
//     }
//   };

//   const handleSlotSelect = (slot: TimeSlot) => {
//     if (!isAuthenticated) {
//       toast.info('Please login to book a meeting');
//       return;
//     }
//     setSelectedSlot(slot);
//     setShowBookingForm(true);
//   };

//   const handleBookingSubmit = () => {
//     if (!selectedSlot) return;

//     const bookingPayload = {
//       startTime: selectedSlot.startTime,
//       endTime: selectedSlot.endTime,
//       meetingType: bookingData.meetingType,
//       description: bookingData.description,
//     };

//     createBookingMutation.mutate(bookingPayload);
//   };

//   const availableSlots = slotsData?.data?.availableSlots || [];

//   return (
//     <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
//       <Typography variant="h3" component="h1" gutterBottom align="center">
//         Book a Meeting
//       </Typography>
//       <Typography
//         variant="h6"
//         component="p"
//         align="center"
//         color="text.secondary"
//         sx={{ mb: 4 }}
//       >
//         Select a date and time that works for you
//       </Typography>

//       <Grid container spacing={4}>
//         {/* Calendar Section */}
//         <Grid item xs={12} md={6}>
//           <Paper elevation={3} sx={{ p: 3 }}>
//             <Typography variant="h5" gutterBottom>
//               Select Date
//             </Typography>
//             <Box sx={{ display: 'flex', justifyContent: 'center' }}>
//               <Calendar
//                 onChange={handleDateChange}
//                 value={selectedDate}
//                 minDate={new Date()}
//                 maxDate={new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)} // 90 days ahead
//                 tileDisabled={({ date }) => {
//                   // Disable weekends (can be customized based on availability)
//                   return date.getDay() === 0 || date.getDay() === 6;
//                 }}
//               />
//             </Box>
//           </Paper>
//         </Grid>

//         {/* Time Slots Section */}
//         <Grid item xs={12} md={6}>
//           <Paper elevation={3} sx={{ p: 3 }}>
//             <Typography variant="h5" gutterBottom>
//               Available Times
//             </Typography>
//             <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
//               {format(selectedDate, 'EEEE, MMMM d, yyyy')}
//             </Typography>

//             {slotsLoading ? (
//               <Typography>Loading available times...</Typography>
//             ) : availableSlots.length === 0 ? (
//               <Alert severity="info">
//                 No available time slots for this date. Please select another date.
//               </Alert>
//             ) : (
//               <Grid container spacing={2}>
//                 {availableSlots.map((slot: TimeSlot, index: number) => (
//                   <Grid item xs={6} sm={4} key={index}>
//                     <Card
//                       sx={{
//                         cursor: 'pointer',
//                         '&:hover': {
//                           backgroundColor: 'action.hover',
//                         },
//                         border: selectedSlot === slot ? 2 : 0,
//                         borderColor: 'primary.main',
//                       }}
//                       onClick={() => handleSlotSelect(slot)}
//                     >
//                       <CardContent sx={{ textAlign: 'center', py: 2 }}>
//                         <Typography variant="body1" fontWeight="medium">
//                           {format(new Date(slot.startTime), 'h:mm a')}
//                         </Typography>
//                         <Chip
//                           label={`${slot.duration} min`}
//                           size="small"
//                           color="primary"
//                           variant="outlined"
//                         />
//                       </CardContent>
//                     </Card>
//                   </Grid>
//                 ))}
//               </Grid>
//             )}
//           </Paper>
//         </Grid>
//       </Grid>

//       {/* Pricing Info */}
//       <Box sx={{ mt: 4, textAlign: 'center' }}>
//         <Paper elevation={1} sx={{ p: 3, backgroundColor: 'grey.50' }}>
//           <Typography variant="h6" gutterBottom>
//             Consultation Fee: $50 for 60 minutes
//           </Typography>
//           <Typography variant="body2" color="text.secondary">
//             Includes Google Meet link, calendar invite, and email confirmations
//           </Typography>
//         </Paper>
//       </Box>

//       {/* Booking Form Dialog */}
//       <Dialog open={showBookingForm} onClose={() => setShowBookingForm(false)} maxWidth="sm" fullWidth>
//         <DialogTitle>Confirm Your Booking</DialogTitle>
//         <DialogContent>
//           {selectedSlot && (
//             <Box sx={{ mb: 3 }}>
//               <Typography variant="h6" gutterBottom>
//                 Selected Time:
//               </Typography>
//               <Typography variant="body1" color="primary">
//                 {format(new Date(selectedSlot.startTime), 'EEEE, MMMM d, yyyy')} at{' '}
//                 {format(new Date(selectedSlot.startTime), 'h:mm a')} -{' '}
//                 {format(new Date(selectedSlot.endTime), 'h:mm a')}
//               </Typography>
//             </Box>
//           )}

//           <TextField
//             select
//             fullWidth
//             label="Meeting Type"
//             value={bookingData.meetingType}
//             onChange={(e) => setBookingData({ ...bookingData, meetingType: e.target.value })}
//             sx={{ mb: 2 }}
//           >
//             <MenuItem value="consultation">Initial Consultation</MenuItem>
//             <MenuItem value="follow-up">Follow-up Meeting</MenuItem>
//             <MenuItem value="project-discussion">Project Discussion</MenuItem>
//           </TextField>

//           <TextField
//             fullWidth
//             multiline
//             rows={4}
//             label="Meeting Description (Optional)"
//             placeholder="Please describe what you'd like to discuss..."
//             value={bookingData.description}
//             onChange={(e) => setBookingData({ ...bookingData, description: e.target.value })}
//           />

//           <Alert severity="info" sx={{ mt: 2 }}>
//             After confirming, you'll be redirected to secure payment processing.
//             Once payment is complete, you'll receive a calendar invite and Google Meet link.
//           </Alert>
//         </DialogContent>
//         <DialogActions>
//           <Button onClick={() => setShowBookingForm(false)}>
//             Cancel
//           </Button>
//           <Button
//             onClick={handleBookingSubmit}
//             variant="contained"
//             disabled={createBookingMutation.isLoading}
//           >
//             {createBookingMutation.isLoading ? 'Creating...' : 'Confirm & Pay $50'}
//           </Button>
//         </DialogActions>
//       </Dialog>
//     </Container>
//   );
// };

// export default BookingPage;
