# Meeting Scheduler

A full-stack meeting scheduler application with payment integration, Google Calendar sync, and Google Meet integration.

## Features

- **Public Booking Interface**: Anyone can view available times and schedule meetings
- **Payment Integration**: Paystack payment processing for meeting fees
- **Google Calendar Integration**: Automatic calendar event creation
- **Google Meet**: Automatic meeting link generation
- **Admin Dashboard**: View all clients and bookings
- **Email Notifications**: Automated reminders and confirmations
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

### Backend

- Node.js with Express
- MongoDB with Mongoose
- Paystack for payments
- Google Calendar API
- JWT authentication
- Nodemailer for emails

### Frontend

- React with TypeScript
- Material-UI for components
- React Query for state management
- React Router for navigation
- Paystack Elements for payments

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or Atlas)
- Google Cloud Platform account
- Stripe account

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
   WEBHOOK_SECRET=your_webhook_secret

   # Google Calendar/Meet
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REFRESH_TOKEN=your_google_refresh_token

   # Admin Settings
   ADMIN_EMAIL=your@email.com
   MEETING_FEE=50.00
   ```

3. **Google Calendar API Setup:**

   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Calendar API
   - Create credentials (OAuth 2.0)
   - Add authorized redirect URIs
   - Get refresh token using OAuth playground

4. **Paystack Setup:**
   - Create Paystack account
   - Get API keys from dashboard
   - Set up webhook endpoint: `https://yourdomain.com/api/payments/webhook`
   - Add webhook events: `charge.success`, `charge.failed`

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

## Initial Setup

### Create Admin User

1. Register a new user through the frontend
2. Manually update the user's role in MongoDB:
   ```javascript
   db.users.updateOne(
     { email: "admin@yourdomain.com" },
     { $set: { role: "admin" } }
   );
   ```

### Set Availability

1. Login as admin
2. Go to Admin Dashboard
3. Set your available time slots
4. Configure break times and special dates

## Usage

### For Clients

1. Visit the homepage
2. Select a date and available time slot
3. Fill in contact information
4. Pay the registration fee
5. Receive calendar invite and meeting link

### For Admin

1. Login to admin dashboard
2. View all bookings and clients
3. Manage availability schedules
4. Process refunds if needed
5. View revenue analytics

## API Endpoints

### Public Endpoints

- `GET /api/availability` - Get available time slots
- `GET /api/bookings/available-slots` - Get specific date availability

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Bookings (Authenticated)

- `POST /api/bookings` - Create new booking
- `GET /api/bookings/my-bookings` - Get user's bookings
- `PUT /api/bookings/:id/cancel` - Cancel booking

### Payments

- `POST /api/payments/initialize` - Initialize payment
- `POST /api/payments/verify` - Verify payment
- `POST /api/payments/webhook` - Paystack webhook

### Admin Only

- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/bookings` - All bookings
- `GET /api/admin/clients` - All clients
- `POST /api/availability` - Create availability
- `PUT /api/availability/:id` - Update availability

## Deployment

### Backend Deployment (Heroku)

1. Install Heroku CLI
2. Create Heroku app:
   ```bash
   heroku create your-app-name
   ```
3. Set environment variables:
   ```bash
   heroku config:set MONGODB_URI=your_mongodb_uri
   heroku config:set JWT_SECRET=your_jwt_secret
   # ... set all environment variables
   ```
4. Deploy:
   ```bash
   git push heroku main
   ```

### Frontend Deployment (Netlify)

1. Build the project:
   ```bash
   npm run build
   ```
2. Deploy build folder to Netlify
3. Set environment variables in Netlify dashboard
4. Configure redirects for React Router

### Database (MongoDB Atlas)

1. Create MongoDB Atlas account
2. Create cluster and database
3. Get connection string
4. Update MONGODB_URI in environment variables

## Security Considerations

- Use strong JWT secrets
- Enable CORS only for your domain
- Use HTTPS in production
- Validate all inputs
- Implement rate limiting
- Regular security updates

## Troubleshooting

### Common Issues

1. **Calendar Events Not Creating**

   - Check Google API credentials
   - Verify refresh token is valid
   - Ensure Calendar API is enabled

2. **Payments Failing**

   - Verify Paystack keys are correct
   - Check webhook configuration
   - Test with Paystack test cards

3. **Email Notifications Not Sending**
   - Configure email service credentials
   - Check spam folders
   - Verify email templates

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## License

MIT License - see LICENSE file for details
