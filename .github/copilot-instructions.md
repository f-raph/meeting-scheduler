# Meeting Scheduler - Copilot Instructions

This is a full-stack meeting scheduler application with the following features:

## Project Structure
- **Backend**: Node.js/Express with MongoDB, Paystack payments, Google Calendar integration
- **Frontend**: React/TypeScript with Material-UI, React Query, React Router

## Key Implementation Details
- JWT authentication with role-based access (admin/user)
- Paystack payment integration (converted from Stripe)
- Google Calendar API for event creation and Google Meet links
- MongoDB models: User, Booking, Availability
- Admin dashboard for managing bookings and clients
- Responsive Material-UI design

## Environment Requirements
- MongoDB database connection
- Google Calendar API credentials with service account
- Paystack API keys (test/live)
- JWT secret for authentication

## Development Commands
- Backend: `cd server && npm run dev`
- Frontend: `cd client && npm start`
- Frontend runs on port 3001, Backend on port 5000

## Recent Changes
- Migrated from Stripe to Paystack payment processing
- Updated all payment flows to use Paystack's initialize/verify pattern
- Frontend uses Paystack's redirect-based payment flow
- Added payment callback page for verification

## Important Notes
- Admin users can manage availability and view all bookings
- Payment verification happens via webhook integration
- Google Calendar events are automatically created with Meet links
- All payment amounts are in Nigerian Naira (NGN)
