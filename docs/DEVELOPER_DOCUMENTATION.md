# Meeting Scheduler – Developer Documentation

This document is a concise guide to the features, architecture, and workflows implemented in the Meeting Scheduler codebase. It focuses on how the system works today so contributors can navigate and extend it safely.

## High-Level Capabilities

- Public booking with availability-aware slot selection and duration limits.
- Dual payments: Flutterwave (default) and Paystack (fallback) with automatic Paystack → Flutterwave transfer.
- Google Calendar and Google Meet creation; free/busy merging for conflict checks.
- Tenant-aware routing via slugs; admin-only dashboards, availability, meeting types, payouts, and client lists.
- JWT authentication with React/Express guards; email notifications on confirmation.
- Responsive React + Material UI frontend with React Query data fetching and Axios interceptors.

## Architecture Overview

- **Backend**: Node.js/Express (`server/`), MongoDB via Mongoose models, service layer for payments (Paystack + Flutterwave), Google Calendar, email, payouts. Runs on port 5000; CORS expects `CLIENT_URL`.
- **Frontend**: React + TypeScript (`client/`), Material UI, React Router v6, React Query, Axios instance with JWT header injection and 401 handling. CRA proxy forwards `/api` to backend in dev.
- **Auth**: JWTs issued from `/api/auth/login|register`, stored in `localStorage`, decoded in `AuthContext`, and injected into Axios. `ProtectedRoute` enforces admin-only pages.
- **Tenancy**: Tenant admin resolved from path/header/query slug; requests attach `req.tenantAdminId` for isolation of bookings, availability, meeting types.

## Core Flows

### Booking Lifecycle

1. **Slots**: Client fetches `/api/bookings/available-slots` (and `/api/availability` for calendar UI). Slots combine weekly availability + specific-date overrides + break times + existing `pending|confirmed` bookings + Google Calendar busy blocks (when connected) per admin.
2. **Booking Creation**: `POST /api/bookings` validates future date, duration (30–180 min), and conflicts; sets `ownerAdmin`, meeting type, and amount.
3. **Payment Initialization**: `POST /api/payments/initialize-payment` chooses gateway (`flutterwave` default, `paystack` optional), persists `paymentIntentId`, and returns checkout URL + reference. Callback URL includes tenant slug.
4. **Payment Verification**: `POST /api/payments/verify-payment` looks up booking by `paymentIntentId`, verifies with the correct gateway, sets `paymentStatus=paid` and `status=confirmed`, and attempts Paystack → Flutterwave transfer when gateway is Paystack.
5. **Calendar + Link**: On success, tries Google Calendar event creation (per-admin OAuth if connected; falls back to global refresh token when provided). Stores `googleEventId`, `meetingLink`, `calendarEventCreated`.
6. **Email**: Sends confirmation email (non-fatal on failure).
7. **Webhook Paths**: `POST /api/payments/flutterwave-webhook` (JSON) and `POST /api/payments/webhook` (Paystack, raw body) also mark paid/confirmed and attempt calendar + email.

### Availability & Scheduling

- Admins define weekly windows, optional specific-date overrides, and break blocks. Stored in `Availability` with 24h `HH:MM` strings, `timezone`, `isActive` flag.
- Slot generation splits windows into `duration`-sized blocks, excluding breaks, conflicting bookings, and Google Calendar busy intervals. Results are sorted chronologically.

### Payments

- **Flutterwave (default)**: Hosted checkout; supports subaccounts for 100% tenant split. `tx_ref` stored on booking. Webhook signature checked via `FLUTTERWAVE_SECRET_HASH`.
- **Paystack (fallback)**: Hosted checkout; optional Paystack subaccount. On verification, the system transfers 100% of the amount to tenant’s Flutterwave bank details (non-fatal if transfer fails). Paystack webhook requires raw body and `x-paystack-signature`.
- Amounts are stored in naira (converted to kobo for API calls). `booking.paymentStatus` transitions `pending → paid → refunded/failed` and `status` moves to `confirmed` on verify.

### Calendar Integration

- Per-admin OAuth tokens stored on `User.googleCalendar`; fetches free/busy to avoid conflicts and creates events + Meet links on confirmation. Falls back to global OAuth client if configured.
- If Google API fails, booking confirmation proceeds without blocking.

### Tenancy & Routing

- Tenant slug resolved from URL first segment or `x-tenant-slug` header/query; requests without slug are rejected. Frontend hook `useTenantSlug` prefixes tenant-aware routes; public non-slug routes stay global (`/login`, `/register`, `/book`, `/bookings`, `/profile`, `/admin`, `/payment`).

## Data Model Snapshot

- **User**: Admins only; includes `slug`, payout configs, Paystack subaccount, Flutterwave subaccount (100% split), Google Calendar tokens, status flags, timestamps. Auto-slug generation ensures uniqueness.
- **Availability**: Day-of-week or specific-date window with `startTime`, `endTime`, optional `breakTimes`, `timezone`, `isActive`, and `ownerAdmin` link.
- **MeetingType**: Admin-scoped catalog entry with `name`, `description`, `duration` (15–480), `price`, `currency`, `color`, `isActive`, `ownerAdmin`.
- **Booking**: Captures `ownerAdmin`, client contact, `startTime/endTime`, `duration`, `meetingType`/`meetingTypeId`, notes, `paymentStatus`, `paymentIntentId`, `paymentGateway`, `amount`, `currency`, calendar fields, reminders, payout status.

## API Surface (current highlights)

- **Auth**: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.
- **Availability**: `GET /api/availability`, `GET /api/bookings/available-slots`; admin CRUD via `POST /api/availability`, `PUT /api/availability/:id`.
- **Bookings**: `POST /api/bookings` (create), `GET /api/bookings/my-bookings` (user), `PUT /api/bookings/:id/cancel` (with refund attempt when paid), admin listing via `GET /api/admin/bookings` and `GET /api/admin/clients`.
- **Payments**: `POST /api/payments/initialize-payment`, `POST /api/payments/verify-payment`, `POST /api/payments/flutterwave-webhook`, `POST /api/payments/webhook` (Paystack). Admin bank catalog: `GET /api/admin/flutterwave/banks`.
- **Admin**: `GET /api/admin/dashboard` stats, meeting type management via `server/routes/meetingTypes.js`, payout helpers in `server/services/payouts.js`.

## Frontend Notes

- Auth context decodes JWT, stores user, and injects Bearer tokens via Axios interceptors. 401 responses trigger logout.
- `ProtectedRoute` guards admin pages; `useAuth().isAdmin` drives access. Admin pages include Availability, Settings (Flutterwave/Paystack setup), Dashboard, Meeting Types, and Bookings.
- Booking UI uses React Hook Form + Yup for validation; PaymentDialog initializes payment and redirects to gateway. `PaymentCallback` verifies payment and surfaces errors; `BookingDetails` shows meeting link once confirmed.
- Shared formatting helpers live in `client/src/utils/dateTime.ts`.

## Configuration & Environment

- Backend expects: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, `PAYSTACK_*`, `FLUTTERWAVE_*` (incl. `FLUTTERWAVE_SECRET_HASH`), `GOOGLE_*` (ID, secret, redirect, refresh token), `MEETING_FEE`, optional SMTP/SendGrid/Gmail for email.
- Frontend expects: `REACT_APP_API_URL`, `REACT_APP_PAYSTACK_PUBLIC_KEY`, and Flutterwave public key if surfaced in UI.
- Keep Paystack webhook route `express.raw` (do not apply JSON middleware before it). Flutterwave webhook uses `express.json` locally in the route.

## Local Development

1. Install deps: `cd server && npm install`; `cd client && npm install`.
2. Seed admin: register via UI, then update `role` to `admin` (and optional `slug`) in MongoDB.
3. Start services: `cd server && npm run dev`; `cd client && npm start` (proxy serves `/api`).
4. Validate with `GET /api/health`; ensure MongoDB is reachable. Payments need test keys; Google Calendar optional for local runs.

## Where to Look in Code

- Payments: `server/routes/payments.js`, `server/services/flutterwave.js`, `server/services/payment.js`.
- Scheduling: `server/services/googleCalendar.js`, `server/models/Availability.js`.
- Booking rules: `server/routes/bookings.js`, `server/models/Booking.js`.
- Auth & Tenancy: `server/middleware/auth.js`, `server/middleware/tenant.js`, `client/src/contexts/AuthContext.tsx`, `client/src/hooks/useTenantSlug.ts`.
- Admin UI: `client/src/pages/Admin*` and related components.
