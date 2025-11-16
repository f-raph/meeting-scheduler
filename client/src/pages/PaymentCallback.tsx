import React, { useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Container,
  Paper,
  Typography,
  CircularProgress,
  Button,
  Box,
} from "@mui/material";
import { CheckCircle, Error } from "@mui/icons-material";
import { useMutation } from "react-query";
import { paymentsApi } from "../services/api";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";

const PaymentCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasVerified = useRef(false);
  const { isAuthenticated, user } = useAuth();

  console.log(
    "[PaymentCallback] Component rendered. isAuthenticated:",
    isAuthenticated,
    "user:",
    user
  );

  const {
    mutate: verifyPayment,
    isLoading,
    isSuccess,
    isError,
  } = useMutation((reference: string) => paymentsApi.verifyPayment(reference), {
    onSuccess: (data) => {
      console.log("[PaymentCallback] Payment verification succeeded:", data);
      const bookingId = data?.data?.booking?.id;
      if (bookingId) {
        toast.success(
          "Payment verified successfully! Your meeting is confirmed."
        );
        // Redirect to booking details after a short delay
        setTimeout(() => {
          navigate(`/bookings/${bookingId}`);
        }, 1500);
      } else {
        toast.success(
          "Payment verified successfully! Your meeting is confirmed."
        );
      }
    },
    onError: (error: any) => {
      console.error("[PaymentCallback] Payment verification failed:", error);
      console.error("Error details:", error?.response?.data || error?.message);
    },
  });

  // Trigger payment verification on mount
  useEffect(() => {
    // Prevent double-calling in React StrictMode
    if (hasVerified.current) {
      console.log("[PaymentCallback] Already verified, skipping...");
      return;
    }

    // Check if user is authenticated
    if (!isAuthenticated) {
      console.log(
        "[PaymentCallback] User not authenticated, waiting for auth..."
      );
      return;
    }

    const reference =
      searchParams.get("reference") || searchParams.get("trxref");

    console.log(
      "[PaymentCallback] Component mounted with reference:",
      reference
    );

    if (reference) {
      console.log(
        `[PaymentCallback] Calling verifyPayment with reference: ${reference}`
      );
      hasVerified.current = true;
      verifyPayment(reference);
    } else {
      console.error("[PaymentCallback] No reference found in URL.");
      hasVerified.current = true; // Mark as verified to avoid retry attempts
    }
    // Only run on mount - empty dependency array is intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoToBookings = () => {
    navigate("/my-bookings");
  };

  const handleTryAgain = () => {
    navigate("/book");
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: "center" }}>
        {!isAuthenticated && (
          <Box>
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Loading...
            </Typography>
            <Typography color="text.secondary">
              Please wait while we prepare your payment verification.
            </Typography>
          </Box>
        )}

        {isAuthenticated && (
          <>
            {/* STATE 1: LOADING */}
            {isLoading && (
              <Box>
                <CircularProgress size={60} sx={{ mb: 2 }} />
                <Typography variant="h5" gutterBottom>
                  Verifying Payment...
                </Typography>
                <Typography color="text.secondary">
                  Please wait while we confirm your payment.
                </Typography>
              </Box>
            )}

            {/* STATE 2: SUCCESS */}
            {isSuccess && (
              <Box>
                <CheckCircle
                  sx={{ fontSize: 80, color: "success.main", mb: 2 }}
                />
                <Typography variant="h4" gutterBottom color="success.main">
                  Payment Successful!
                </Typography>
                {/* ... (rest of the success UI) ... */}
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleGoToBookings}
                >
                  View My Bookings
                </Button>
              </Box>
            )}

            {/* STATE 3: FAILED */}
            {isError && (
              <Box>
                <Error sx={{ fontSize: 80, color: "error.main", mb: 2 }} />
                <Typography variant="h4" gutterBottom color="error.main">
                  Payment Failed
                </Typography>
                {/* ... (rest of the error UI) ... */}
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleTryAgain}
                >
                  Try Again
                </Button>
              </Box>
            )}
          </>
        )}
      </Paper>
    </Container>
  );
};

export default PaymentCallback;

// import React, { useEffect, useState } from "react";
// import { useSearchParams, useNavigate } from "react-router-dom";
// import {
//   Container,
//   Paper,
//   Typography,
//   CircularProgress,
//   Alert,
//   Button,
//   Box,
// } from "@mui/material";
// import { CheckCircle, Error } from "@mui/icons-material";
// import { useMutation } from "react-query";
// import { paymentsApi } from "../services/api";
// import { toast } from "react-toastify";

// const PaymentCallback: React.FC = () => {
//   const [searchParams] = useSearchParams();
//   const navigate = useNavigate();
//   const [verificationStatus, setVerificationStatus] = useState<
//     "loading" | "success" | "failed"
//   >("loading");
//   const [bookingDetails, setBookingDetails] = useState<any>(null);

//   const verifyPaymentMutation = useMutation(
//     (reference: string) => paymentsApi.verifyPayment(reference),
//     {
//       onSuccess: (response) => {
//         setVerificationStatus("success");
//         setBookingDetails(response.data.booking);
//         toast.success(
//           "Payment verified successfully! Your meeting is confirmed."
//         );
//       },
//       onError: (error: any) => {
//         setVerificationStatus("failed");
//         console.error("Payment verification failed:", error);
//       },
//     }
//   );

//   useEffect(() => {
//     const reference = searchParams.get("reference");
//     const status = searchParams.get("status");

//     if (reference) {
//       if (status === "success") {
//         verifyPaymentMutation.mutate(reference);
//       } else {
//         setVerificationStatus("failed");
//       }
//     } else {
//       setVerificationStatus("failed");
//     }
//   }, [searchParams]);

//   const handleGoToBookings = () => {
//     navigate("/my-bookings");
//   };

//   const handleTryAgain = () => {
//     navigate("/book");
//   };

//   return (
//     <Container maxWidth="sm" sx={{ mt: 8 }}>
//       <Paper elevation={3} sx={{ p: 4, textAlign: "center" }}>
//         {verificationStatus === "loading" && (
//           <Box>
//             <CircularProgress size={60} sx={{ mb: 2 }} />
//             <Typography variant="h5" gutterBottom>
//               Verifying Payment...
//             </Typography>
//             <Typography color="text.secondary">
//               Please wait while we confirm your payment.
//             </Typography>
//           </Box>
//         )}

//         {verificationStatus === "success" && (
//           <Box>
//             <CheckCircle sx={{ fontSize: 80, color: "success.main", mb: 2 }} />
//             <Typography variant="h4" gutterBottom color="success.main">
//               Payment Successful!
//             </Typography>
//             <Typography variant="h6" gutterBottom>
//               Your meeting has been confirmed
//             </Typography>

//             {bookingDetails && (
//               <Box sx={{ mt: 3, mb: 3, textAlign: "left" }}>
//                 <Alert severity="success" sx={{ mb: 2 }}>
//                   <Typography variant="body2">
//                     <strong>Meeting Details:</strong>
//                   </Typography>
//                   <Typography variant="body2">
//                     Date:{" "}
//                     {new Date(bookingDetails.startTime).toLocaleDateString()}
//                   </Typography>
//                   <Typography variant="body2">
//                     Time:{" "}
//                     {new Date(bookingDetails.startTime).toLocaleTimeString()} -{" "}
//                     {new Date(bookingDetails.endTime).toLocaleTimeString()}
//                   </Typography>
//                   {bookingDetails.meetingLink && (
//                     <Typography variant="body2">
//                       Meeting Link: Available in your bookings
//                     </Typography>
//                   )}
//                 </Alert>
//               </Box>
//             )}

//             <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
//               You will receive a calendar invite and email confirmation shortly.
//               Your Google Meet link is available in your bookings.
//             </Typography>

//             <Button
//               variant="contained"
//               size="large"
//               onClick={handleGoToBookings}
//               sx={{ mr: 2 }}
//             >
//               View My Bookings
//             </Button>
//           </Box>
//         )}

//         {verificationStatus === "failed" && (
//           <Box>
//             <Error sx={{ fontSize: 80, color: "error.main", mb: 2 }} />
//             <Typography variant="h4" gutterBottom color="error.main">
//               Payment Failed
//             </Typography>
//             <Typography variant="body1" gutterBottom>
//               We couldn't verify your payment. This could be due to:
//             </Typography>

//             <Typography
//               variant="body2"
//               color="text.secondary"
//               sx={{ mb: 3, textAlign: "left" }}
//             >
//               • Payment was not completed • Payment was cancelled • Network
//               connection issues • Technical error
//             </Typography>

//             <Alert severity="info" sx={{ mb: 3 }}>
//               If you believe this is an error and your payment was successful,
//               please contact support with your transaction reference.
//             </Alert>

//             <Box>
//               <Button
//                 variant="contained"
//                 size="large"
//                 onClick={handleTryAgain}
//                 sx={{ mr: 2 }}
//               >
//                 Try Again
//               </Button>
//               <Button
//                 variant="outlined"
//                 size="large"
//                 onClick={handleGoToBookings}
//               >
//                 View Bookings
//               </Button>
//             </Box>
//           </Box>
//         )}
//       </Paper>
//     </Container>
//   );
// };

// export default PaymentCallback;
