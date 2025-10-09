import React, { useState } from 'react';
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
} from '@mui/material';
import { useMutation } from 'react-query';
import { paymentsApi } from '../../services/api';
import { toast } from 'react-toastify';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  amount: number;
  onSuccess: () => void;
}

const PaymentDialog: React.FC<PaymentDialogProps> = ({
  open,
  onClose,
  bookingId,
  amount,
  onSuccess,
}) => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const initializePaymentMutation = useMutation(
    () => paymentsApi.initializePayment(bookingId),
    {
      onSuccess: (response) => {
        // Redirect to Paystack payment page
        window.location.href = response.data.authorization_url;
      },
      onError: (error: any) => {
        setError(error.response?.data?.error || 'Failed to initialize payment');
        setProcessing(false);
      },
    }
  );

  const handlePayment = async () => {
    setProcessing(true);
    setError('');
    
    try {
      await initializePaymentMutation.mutateAsync();
    } catch (err: any) {
      setError(err.message || 'Payment initialization failed');
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
          Total Amount: <strong>₦{amount.toLocaleString()}</strong>
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 2 }}>
          You will be redirected to Paystack's secure payment page to complete your transaction.
          After successful payment, you'll receive your meeting details and calendar invite.
        </Alert>

        <Typography variant="body2" color="text.secondary">
          Supported payment methods:
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
          • Bank cards (Visa, Mastercard, Verve)
          • Bank transfer
          • USSD
          • Mobile money
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
          {processing ? 'Redirecting...' : `Pay ₦${amount.toLocaleString()}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentDialog;