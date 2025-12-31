# Meeting Scheduler

A full-stack multi-tenant meeting scheduler application with Paystack payment integration, Google Calendar sync, and Google Meet integration.

## Features

- **Multi-Tenant Architecture**: Each admin has their own booking page with unique slug
- **Public Booking Interface**: Anyone can view available times and schedule meetings
- **Payment Integration**: Paystack payment processing with split payments to admin subaccounts
- **Google Calendar Integration**: Automatic calendar event creation
- **Google Meet**: Automatic meeting link generation
- **Admin Dashboard**: View all clients and bookings
- **Email Notifications**: Automated reminders and confirmations
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

### Backend

- Node.js with Express
- MongoDB with Mongoose
- Paystack for payments (split payments with subaccounts)
- Google Calendar API
- JWT authentication
- Nodemailer for emails

### Frontend

- React with TypeScript
- Material-UI for components
- React Query for state management
- React Router for navigation

## Payment Flow

### Multi-Tenant Split Payments

This application uses Paystack split payments to enable a multi-tenant system where:

1. **Platform Owner** owns the main Paystack account
2. **Admins (Tenants)** each have a Paystack subaccount
3. **Clients** pay for bookings, and funds are automatically split

### How It Works

1. **Admin Onboarding**: When an admin registers, they can set up their Paystack subaccount in Settings
2. **Payment Initialization**: When a client books a meeting:
   - The system resolves the admin from the URL slug
   - Fetches the admin's `subaccount_code` from the database
   - Initializes payment with Paystack including the subaccount for split
3. **Payment Processing**: Paystack handles the payment and automatically splits funds
4. **Verification**: Payment is verified via Paystack API and webhooks
5. **Confirmation**: Booking is confirmed and Google Calendar event is created

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or Atlas)
- Google Cloud Platform account
- Paystack account

### Backend Setup

1. **Clone and install dependencies:**

   ```bash
   cd server
   npm install
   ```

2. **Environment Configuration:**

   ```bash
   cp .env.example .env
   ```

   Fill in the following environment variables:

   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/meeting-scheduler

   # JWT Secret
   JWT_SECRET=your_very_secure_jwt_secret_key_here

   # Paystack Keys
   PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
   PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key

   # Optional: Platform fee percentage (0-100, default 0 means 100% to admin)
   PLATFORM_FEE_PERCENT=0

   # Client URL (for payment callbacks)
   CLIENT_URL=http://localhost:3000

   # Google Calendar/Meet
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret

   # Email Configuration
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

3. **Google Calendar API Setup:**

   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Calendar API
   - Create credentials (OAuth 2.0)
   - Add authorized redirect URIs

4. **Paystack Setup (Ghana):**
   - Create a [Paystack Ghana account](https://paystack.com/gh)
   - Get API keys from dashboard
   - Set up webhook endpoint: `https://yourdomain.com/api/webhooks/paystack`
   - Add webhook events: `charge.success`, `charge.failed`, `transfer.success`, `transfer.failed`, `refund.processed`
   - Ensure your account is verified for Ghana operations
   - The webhook handler verifies signatures using `x-paystack-signature` header

### Frontend Setup

1. **Install dependencies:**

   ```bash
   cd client
   npm install
   ```

2. **Environment Configuration:**
   ```bash
   # Create .env file in client directory
   REACT_APP_API_URL=http://localhost:5000/api
   REACT_APP_PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key
   ```

### Running the Application

1. **Start MongoDB** (if running locally)

2. **Start the backend:**

   ```bash
   cd server
   npm run dev
   ```

3. **Start the frontend:**

   ```bash
   cd client
   npm start
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Admin Setup

### Create Admin User

1. Register a new user through the frontend at `/register`
2. Users are automatically assigned the admin role

### Configure Payments

1. Login to admin dashboard
2. Go to Settings → Payment Setup
3. Enter your Ghanaian bank details:
   - Business Name
   - Bank
   - Account Number
4. The system will verify your account and create a Paystack subaccount
5. All future payments will be split automatically to your account

### Set Availability

1. Go to Admin Dashboard → Availability
2. Set your available time slots for each day
3. Configure break times and special dates

## Usage

### For Clients

1. Visit an admin's booking page: `https://yourdomain.com/{admin-slug}`
2. Select a meeting type
3. Choose a date and available time slot
4. Fill in contact information
5. Pay via Paystack
6. Receive calendar invite and meeting link

### For Admin

1. Login to admin dashboard
2. View all bookings and clients
3. Manage availability schedules
4. Configure meeting types and pricing
5. View revenue analytics

## API Endpoints

### Public Endpoints

- `GET /api/availability` - Get available time slots
- `GET /api/bookings/available-slots` - Get specific date availability
- `GET /api/meeting-types` - Get available meeting types

### Authentication

- `POST /api/auth/register` - Register new admin
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Bookings

- `POST /api/bookings` - Create new booking
- `GET /api/bookings/:id` - Get booking details
- `PUT /api/bookings/:id/cancel` - Cancel booking

### Payments

- `POST /api/payments/initialize-payment` - Initialize Paystack payment with split to admin's subaccount
- `POST /api/payments/verify-payment` - Verify payment after Paystack callback
- `GET /api/payments/status/:reference` - Get payment status by reference

### Webhooks

- `POST /api/webhooks/paystack` - Secure Paystack webhook handler (signature verified)

### Admin Only

- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/bookings` - All bookings
- `GET /api/admin/clients` - All clients
- `POST /api/admin/setup-subaccount` - Create Paystack subaccount
- `GET /api/admin/subaccount-status` - Get subaccount status
- `GET /api/admin/banks` - Get list of Ghanaian banks
- `GET /api/admin/resolve-account` - Verify bank account details

## Database Schema

### User (Admin)
```javascript
{
  email: String,
  password: String (hashed),
  firstName: String,
  lastName: String,
  role: "admin",
  slug: String (unique),
  paystack: {
    subaccountCode: String,
    subaccountId: String,
    businessName: String,
    settlementBank: String,
    accountNumber: String,
    percentageCharge: Number,
    isVerified: Boolean
  },
  googleCalendar: {
    connected: Boolean,
    accessToken: String,
    refreshToken: String,
    calendarId: String
  }
}
```

### Booking
```javascript
{
  ownerAdmin: ObjectId (ref: User),
  clientName: String,
  clientEmail: String,
  clientPhone: String,
  startTime: Date,
  endTime: Date,
  duration: Number,
  status: "pending" | "confirmed" | "cancelled" | "completed",
  meetingType: String,
  paymentStatus: "pending" | "paid" | "refunded" | "failed",
  paymentIntentId: String,  // Paystack transaction reference
  paymentGateway: "paystack",
  subaccountCode: String,   // Admin's subaccount for split payment
  amount: Number,
  currency: String,
  paidAt: Date,             // Timestamp when payment was confirmed
  refundedAt: Date,         // Timestamp when refund was processed
  refundAmount: Number,     // Amount refunded (if any)
  googleEventId: String,
  meetingLink: String,
  payoutStatus: "pending" | "queued" | "paid",
  paidOutAt: Date           // Timestamp when admin was paid out
}
```

## Deployment

### Backend Deployment

1. Deploy to a Node.js hosting provider (Render, Railway, Heroku, etc.)
2. Set all environment variables
3. Ensure MongoDB connection is configured
4. Set up Paystack webhook URL pointing to your deployed API

### Frontend Deployment

1. Build the project:
   ```bash
   npm run build
   ```
2. Deploy build folder to Netlify, Vercel, or similar
3. Set environment variables in hosting dashboard
4. Configure redirects for React Router

## Security Considerations

- Use strong JWT secrets
- Enable CORS only for your domain
- Use HTTPS in production
- Validate all inputs
- Implement rate limiting
- Regular security updates
- Never expose Paystack secret key to frontend

## Troubleshooting

### Common Issues

1. **Calendar Events Not Creating**
   - Check Google API credentials
   - Verify OAuth tokens are valid
   - Ensure Calendar API is enabled

2. **Payments Failing**
   - Verify Paystack keys are correct
   - Check webhook configuration
   - Test with Paystack test cards:
     - Success: 4084 0840 8408 4081 (any expiry, any CVV)
     - Failed: 4084 0840 8408 4085

3. **Subaccount Creation Failing**
   - Verify Ghanaian bank account details
   - Check that bank code is correct (GH format)
   - Ensure account number is valid for Ghana

4. **Email Notifications Not Sending**
   - Configure SMTP credentials
   - Check spam folders
   - For Gmail, use App Passwords

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## License

MIT License - see LICENSE file for details
