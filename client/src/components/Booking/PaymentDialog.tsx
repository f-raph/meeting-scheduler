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
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  Chip,
} from "@mui/material";
import { useMutation } from "react-query";
import { paymentsApi } from "../../services/api";
import { toast } from "react-toastify";

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
  currency = "USD",
  onSuccess,
}) => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [gateway, setGateway] = useState<"flutterwave" | "paystack">(
    "flutterwave"
  );

  const initializePaymentMutation = useMutation(
    () => paymentsApi.initializePayment(bookingId, gateway),
    {
      onSuccess: (response) => {
        // Redirect to payment gateway page
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Complete Your Payment</DialogTitle>
      <DialogContent>
        <Typography variant="h6" gutterBottom>
          Payment Details
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Total Amount:{" "}
          <strong>
            {currency} {amount.toLocaleString()}
          </strong>
        </Typography>

        <FormControl component="fieldset" sx={{ mb: 3, width: "100%" }}>
          <FormLabel component="legend" sx={{ mb: 1 }}>
            Select Payment Method
          </FormLabel>
          <RadioGroup
            value={gateway}
            onChange={(e) =>
              setGateway(e.target.value as "flutterwave" | "paystack")
            }
          >
            <Box
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                mb: 1,
                p: 2,
              }}
            >
              <FormControlLabel
                value="flutterwave"
                control={<Radio />}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body1">Flutterwave</Typography>
                    <Chip label="Recommended" color="primary" size="small" />
                  </Box>
                }
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ ml: 4 }}
              >
                Fast, secure payment with multiple options
              </Typography>
            </Box>

            <Box
              sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2 }}
            >
              <FormControlLabel
                value="paystack"
                control={<Radio />}
                label={
                  <Typography variant="body1">
                    Paystack (Alternative)
                  </Typography>
                }
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ ml: 4 }}
              >
                Backup payment option
              </Typography>
            </Box>
          </RadioGroup>
        </FormControl>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 2 }}>
          You will be redirected to a secure payment page to complete your
          transaction. After successful payment, you'll receive your meeting
          details and calendar invite.
        </Alert>

        <Typography variant="body2" color="text.secondary">
          Supported payment methods:
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
          • Bank cards (Visa, Mastercard, Verve)
          <br />• Bank transfer
          <br />• USSD
          <br />• Mobile money
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          onClick={handlePayment}
          variant="contained"
          disabled={processing}
          startIcon={processing ? <CircularProgress size={20} /> : null}
        >
          {processing
            ? "Redirecting..."
            : `Pay ${currency} ${amount.toLocaleString()}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentDialog;
