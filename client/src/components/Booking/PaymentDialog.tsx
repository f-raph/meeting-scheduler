import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useMutation } from "react-query";
import { paymentsApi } from "../../services/api";

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  amount: number;
  currency?: string;
  onSuccess: () => void;
}

const PaymentDialog: React.FC<PaymentDialogProps> = ({
  open,
  onClose,
  bookingId,
  amount,
  currency = "GHS",
  // onSuccess is not used here since we redirect to Paystack
  // Payment success is handled on the callback page
  onSuccess: _onSuccess,
}) => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const initializePaymentMutation = useMutation(
    () => paymentsApi.initializePayment(bookingId),
    {
      onSuccess: (response: { data: { authorization_url: string } }) => {
        // Redirect to Paystack payment page
        window.location.href = response.data.authorization_url;
      },
      onError: (error: any) => {
        setError(error.response?.data?.error || "Failed to initialize payment");
        setProcessing(false);
      },
    }
  );

  const handlePayment = async () => {
    setProcessing(true);
    setError("");

    try {
      await initializePaymentMutation.mutateAsync();
    } catch (err: any) {
      setError(err.message || "Payment initialization failed");
      setProcessing(false);
    }
  };

  const formatCurrency = (amt: number, curr: string) => {
    const symbols: { [key: string]: string } = {
      NGN: "₦",
      USD: "$",
      EUR: "€",
      GBP: "£",
      GHS: "₵",
      KES: "KSh",
      ZAR: "R",
    };
    const symbol = symbols[curr] || curr + " ";
    return `${symbol}${amt.toLocaleString()}`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Complete Your Payment</DialogTitle>
      <DialogContent>
        <Typography variant="h6" gutterBottom>
          Payment Details
        </Typography>

        <Box
          sx={{
            bgcolor: "primary.main",
            color: "white",
            p: 3,
            borderRadius: 2,
            textAlign: "center",
            mb: 3,
          }}
        >
          <Typography variant="overline" sx={{ opacity: 0.8 }}>
            Total Amount
          </Typography>
          <Typography variant="h4" fontWeight="bold">
            {formatCurrency(amount, currency)}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 2 }}>
          You will be redirected to Paystack's secure payment page to complete
          your transaction. After successful payment, you'll receive your
          meeting details and calendar invite.
        </Alert>

        <Box sx={{ bgcolor: "rgba(25, 193, 255, 0.08)", p: 2, borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle2" gutterBottom>
            Supported payment methods:
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • Bank cards (Visa, Mastercard, Verve)
            <br />
            • Bank transfer
            <br />
            • USSD
            <br />
            • Mobile money
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          onClick={handlePayment}
          variant="contained"
          size="large"
          disabled={processing}
          startIcon={processing ? <CircularProgress size={20} /> : null}
        >
          {processing ? "Redirecting..." : `Pay ${formatCurrency(amount, currency)}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentDialog;
