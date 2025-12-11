# Flutterwave Integration Guide

## Overview

This system now supports dual payment gateways with automatic fund transfers:

- **Flutterwave**: Primary payment gateway (default)
- **Paystack**: Alternative payment gateway (fallback)
- **100% Split**: All payments go to tenants (platform is free)

## Payment Flow

### Flutterwave Payment (Default)

```
1. Client selects Flutterwave → Hosted checkout (Standard) on Flutterwave
2. Flutterwave automatically splits 100% to tenant's Flutterwave subaccount
3. Booking confirmed, calendar event created
```

### Paystack Payment (Alternative)

```
1. Client selects Paystack → Pays via Paystack
2. Money lands in platform's Paystack account
3. System automatically transfers 100% to tenant's Flutterwave account via API
4. Booking confirmed, calendar event created
```

## Paystack-to-Flutterwave Transfer

When a Paystack payment is verified, the system automatically:

1. **Detects Paystack payment** via `booking.paymentGateway === "paystack"`
2. **Fetches tenant's Flutterwave account details** from `User.flutterwave`
3. **Initiates transfer** using Flutterwave Transfer API:
   ```javascript
   await flutterwaveService.transfer({
     amount: booking.amount,
     account_bank: admin.flutterwave.accountBank,
     account_number: admin.flutterwave.accountNumber,
     narration: `Payment transfer for booking ${booking._id}`,
     reference: `PSFW-${booking._id}-${Date.now()}`,
   });
   ```
4. **Transfer is non-fatal** - booking is confirmed even if transfer fails (you can retry manually)

## Setup Instructions

### 1. Get Flutterwave API Keys

1. Sign up at https://flutterwave.com
2. Go to Settings → API Keys
3. Copy:
   - Public Key: `FLWPUBK_TEST-...`
   - Secret Key: `FLWSECK_TEST-...`
   - Encryption Key: `FLWSECK_TEST-...`

### 2. Add to Environment Variables

```bash
# server/.env
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-your_key_here
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-your_key_here
FLUTTERWAVE_SECRET_HASH=your_webhook_secret_hash_here
# Optional for inline (not used in hosted checkout):
# FLUTTERWAVE_ENCRYPTION_KEY=FLWSECK_TEST-your_key_here
```

**Important**: The `FLUTTERWAVE_SECRET_HASH` is used to verify webhook signatures. You can generate it yourself (any random string) or get it from Flutterwave dashboard. The encryption key is **not** required for the hosted Standard checkout flow we use; keep it only if you plan to support inline/card encryption flows.

### 3. Configure Webhook URL (Optional for Testing)

**Note**: Webhooks are optional. You can test payments without webhooks - the verify-payment endpoint handles payment confirmation.

In your Flutterwave dashboard (only needed if you want real-time webhook notifications):

1. Go to **Settings** → **Webhooks**
2. Set webhook URL based on your environment:
   - **Local Development with webhooks**: `https://your-ngrok-url.ngrok-free.app/api/payments/flutterwave-webhook`
     - Only needed if testing webhook functionality
     - Requires ngrok to expose localhost
   - **Production**: `https://yourdomain.com/api/payments/flutterwave-webhook`
3. Set Secret Hash to the same value as `FLUTTERWAVE_SECRET_HASH` in your `.env`
4. Select events to listen for: **charge.completed**
5. Save settings

**For basic testing**: Skip webhook setup. Payment verification works without webhooks via the `/verify-payment` endpoint.

### 4. Admin Setup (Per Tenant)

Each admin needs to configure their Flutterwave account:

1. Login to admin dashboard
2. Go to **Admin Settings** → **Flutterwave Account Setup**
3. Fill in:
   - Business Name
   - Business Email
   - Country
   - Bank (dropdown dynamically loads based on country)
   - Account Number
4. Click **Save** - system creates Flutterwave subaccount

### 5. Testing

**Flutterwave has TEST MODE** - you can test everything locally without ngrok!

#### Test Flutterwave Payment (No ngrok needed):

1. Use test API keys (those starting with `FLWPUBK_TEST` and `FLWSECK_TEST`)
2. Client selects Flutterwave payment
3. Use Flutterwave test cards:
   - **Card Number**: `5531886652142950`
   - **CVV**: `564`
   - **Expiry**: Any future date
   - **PIN**: `3310`
   - **OTP**: `12345`
4. Complete payment
5. Click "I have paid" on your booking page
6. System calls `/verify-payment` endpoint → Booking confirmed
7. Payment splits 100% to tenant's Flutterwave subaccount (in test mode)

**Webhooks are optional** - the manual verify step works without webhooks.

#### Test Paystack Payment:

1. Use test API keys (those starting with `sk_test` and `pk_test`)
2. Client selects Paystack payment
3. Use Paystack test card:
   - **Card Number**: `4084084084084081`
   - **CVV**: `408`
   - **Expiry**: Any future date
4. Complete payment
5. System auto-transfers 100% to tenant's Flutterwave account (test mode)

## Database Schema Changes

### User Model (server/models/User.js)

```javascript
flutterwave: {
  subaccountId: String,       // Flutterwave subaccount ID
  subaccountCode: String,     // Flutterwave subaccount code
  businessName: String,
  businessEmail: String,
  accountBank: String,        // Bank code (e.g., "044")
  accountNumber: String,
  bankName: String,           // Display name
  splitValue: Number,         // 1 = 100%
}
```

### Booking Model (server/models/Booking.js)

```javascript
paymentGateway: {
  type: String,
  enum: ["flutterwave", "paystack"],
  default: "flutterwave"
}
```

## API Changes

### Webhooks

**Flutterwave Webhook**: `POST /api/payments/flutterwave-webhook`

- Receives notifications from Flutterwave when payments complete
- Verifies signature using `FLUTTERWAVE_SECRET_HASH`
- Automatically confirms bookings and creates calendar events
- Header: `verif-hash` (Flutterwave's signature)

**Paystack Webhook**: `POST /api/payments/webhook`

- Receives notifications from Paystack
- Verifies signature using `PAYSTACK_SECRET_KEY`
- Header: `x-paystack-signature`

### Initialize Payment

**Endpoint**: `POST /api/payments/initialize-payment`

**Request**:

```json
{
  "bookingId": "64abc...",
  "gateway": "flutterwave" // or "paystack"
}
```

**Response**:

```json
{
  "authorization_url": "https://checkout.flutterwave.com/...",
  "reference": "TX-1234567890-abc123",
  "gateway": "flutterwave"
}
```

### Verify Payment

**Endpoint**: `POST /api/payments/verify-payment`

**Request**:

```json
{
  "reference": "TX-1234567890-abc123"
}
```

**Response**:

```json
{
  "message": "Payment verified and booking confirmed",
  "booking": {
    "id": "64abc...",
    "status": "confirmed",
    "paymentStatus": "paid",
    "meetingLink": "https://meet.google.com/...",
    "startTime": "2025-12-25T10:00:00Z",
    "endTime": "2025-12-25T11:00:00Z"
  }
}
```

## Flutterwave Service Methods

### `initializePayment(amount, email, metadata, slug, subaccountId)`

Initializes a Flutterwave payment with automatic split to subaccount.

### `verifyPayment(transaction_id)`

Verifies a Flutterwave payment by transaction ID or tx_ref.

### `createSubaccount({account_bank, account_number, business_name, business_email})`

Creates a Flutterwave subaccount for a tenant (100% split).

### `transfer({amount, account_bank, account_number, narration, reference})`

Transfers funds to a bank account (used for Paystack → Flutterwave transfers).

### `getBanks()`

Fetches list of Nigerian banks with codes for account setup.

## Nigerian Bank Codes (Common)

| Bank Name     | Code |
| ------------- | ---- |
| Access Bank   | 044  |
| GTBank        | 058  |
| First Bank    | 011  |
| UBA           | 033  |
| Zenith Bank   | 057  |
| Wema Bank     | 035  |
| Sterling Bank | 232  |
| Providus Bank | 101  |

Full list available via: `GET /api/admin/flutterwave/banks`

## Error Handling

### Transfer Failures

If Paystack-to-Flutterwave transfer fails:

1. **Booking is still confirmed** (customer sees confirmed status)
2. **Error is logged** to console
3. **Manual action required**: Admin should:
   - Check Flutterwave dashboard for transfer status
   - Verify tenant's bank details are correct
   - Retry transfer manually if needed

### Verification Failures

If payment verification fails:

1. Booking remains in `pending` status
2. Client sees error message
3. They can retry payment or contact support

## Production Checklist

- [ ] Move Flutterwave app from "Test" to "Live" mode
- [ ] Update `.env` with live Flutterwave keys (remove `_TEST` suffix)
- [ ] Configure webhook URL in Flutterwave dashboard (Settings → Webhooks)
- [ ] Set `FLUTTERWAVE_SECRET_HASH` in production environment
- [ ] Test webhook delivery with Flutterwave's webhook tester
- [ ] Verify bank account details for all tenants
- [ ] Set up monitoring for failed transfers
- [ ] Configure Flutterwave settlement schedule (daily/weekly)
- [ ] Enable SSL/HTTPS for webhook endpoint (required)

## Webhook Setup Details

**Important**: Webhooks are NOT required for testing. They're only needed for:

- Real-time payment notifications (alternative to manual verify)
- Production environments where you want automatic confirmation

**For local testing**: Use test mode API keys and the `/verify-payment` endpoint. Skip webhooks entirely.

### When Do You Need Webhooks?

**You DON'T need webhooks for:**

- ✅ Testing payments locally with test cards
- ✅ Manual payment verification (clicking "I have paid")
- ✅ Development and testing

**You DO need webhooks for:**

- ⚡ Automatic real-time payment confirmation (no manual verify step)
- 🚀 Production deployments
- 📊 Logging all payment events automatically

### Local Testing with ngrok (Optional):

Only if you want to test webhook functionality specifically:

1. Install ngrok: `npm install -g ngrok` (or download from https://ngrok.com)
2. Start your **backend server**:
   ```bash
   cd server
   npm run dev  # Runs on port 5000
   ```
3. In a **new terminal**, start ngrok:
   ```bash
   ngrok http 5000
   ```
4. Copy the **HTTPS URL** from ngrok output (e.g., `https://abc123.ngrok-free.app`)
5. Set webhook URL in Flutterwave dashboard:
   ```
   https://abc123.ngrok-free.app/api/payments/flutterwave-webhook
   ```
6. Keep ngrok running while testing webhooks

### Production Webhook URL:

```
https://yourdomain.com/api/payments/flutterwave-webhook
```

### Webhook Secret Hash:

The secret hash is used to verify that webhook requests are genuinely from Flutterwave. You can:

1. **Generate your own**: Any secure random string (e.g., `openssl rand -hex 32`)
2. **Use Flutterwave's**: They may provide one in the dashboard

**Important**: Use the same value in both:

- `.env` file: `FLUTTERWAVE_SECRET_HASH=your_hash_here`
- Flutterwave dashboard webhook settings

### Webhook Events:

The system listens for:

- `charge.completed` - Payment succeeded or failed

### Testing Webhooks:

**Local testing (with ngrok running):**

```bash
# Replace with your ngrok URL and secret hash
curl -X POST https://your-ngrok-url.ngrok-free.app/api/payments/flutterwave-webhook \
  -H "Content-Type: application/json" \
  -H "verif-hash: your_secret_hash_here" \
  -d '{
    "event": "charge.completed",
    "data": {
      "id": 12345,
      "tx_ref": "TX-1234567890-abc123",
      "status": "successful",
      "amount": 5000,
      "currency": "NGN",
      "customer": {
        "email": "customer@example.com"
      }
    }
  }'
```

**Direct localhost test (only works from your machine):**

```bash
curl -X POST http://localhost:5000/api/payments/flutterwave-webhook \
  -H "Content-Type: application/json" \
  -H "verif-hash: your_secret_hash_here" \
  -d '{
    "event": "charge.completed",
    "data": {
      "id": 12345,
      "tx_ref": "TX-1234567890-abc123",
      "status": "successful",
      "amount": 5000,
      "currency": "NGN",
      "customer": {
        "email": "customer@example.com"
      }
    }
  }'
```

**Note**: Flutterwave can only send webhooks to the ngrok URL, not localhost.

## Frontend Changes Needed

1. **PaymentDialog.tsx**: Add gateway selection (Flutterwave/Paystack radio buttons)
2. **AdminSettings.tsx**: Add Flutterwave account setup form
3. **api.ts**: Update payment initialization to include gateway parameter

## Support

For Flutterwave API issues:

- Documentation: https://developer.flutterwave.com/docs
- Support: support@flutterwave.com
- Dashboard: https://dashboard.flutterwave.com

For Paystack Transfer API:

- Documentation: https://paystack.com/docs/api/transfer
- Support: support@paystack.com
