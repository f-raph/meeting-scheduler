import React from "react";
import { Routes, Route } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { CircularProgress, Box } from "@mui/material";

// Components
import Navbar from "./components/Layout/Navbar";
import ProtectedRoute from "./components/Auth/ProtectedRoute";

// Pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import BookingPage from "./pages/BookingPage";
import BookingDetails from "./pages/BookingDetails";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import AdminAvailability from "./pages/AdminAvailability";
import AdminSettings from "./pages/AdminSettings";
import PaymentCallback from "./pages/PaymentCallback";
import GoogleCalendarCallback from "./pages/GoogleCalendarCallback";

const App: React.FC = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div className="App">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/book" element={<BookingPage />} />
        <Route path="/bookings/:bookingId" element={<BookingDetails />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute adminOnly>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/availability"
          element={
            <ProtectedRoute adminOnly>
              <AdminAvailability />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute adminOnly>
              <AdminSettings />
            </ProtectedRoute>
          }
        />
        <Route path="/payment/callback" element={<PaymentCallback />} />
        <Route
          path="/admin/google-calendar/callback"
          element={<GoogleCalendarCallback />}
        />

        {/**
         * Tenant-scoped route duplicates using :slug prefix
         * This allows shareable links like /john/book while reusing existing pages.
         */}
        <Route path=":slug/" element={<Home />} />
        <Route path=":slug/login" element={<Login />} />
        <Route path=":slug/register" element={<Register />} />
        <Route path=":slug/book" element={<BookingPage />} />
        <Route path=":slug/bookings/:bookingId" element={<BookingDetails />} />
        <Route
          path=":slug/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path=":slug/admin/*"
          element={
            <ProtectedRoute adminOnly>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path=":slug/admin/availability"
          element={
            <ProtectedRoute adminOnly>
              <AdminAvailability />
            </ProtectedRoute>
          }
        />
        <Route
          path=":slug/admin/settings"
          element={
            <ProtectedRoute adminOnly>
              <AdminSettings />
            </ProtectedRoute>
          }
        />
        <Route path=":slug/payment/callback" element={<PaymentCallback />} />
        <Route
          path=":slug/admin/google-calendar/callback"
          element={<GoogleCalendarCallback />}
        />
      </Routes>
    </div>
  );
};

export default App;
