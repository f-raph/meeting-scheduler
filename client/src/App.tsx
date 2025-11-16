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
import MyBookings from "./pages/MyBookings";
import BookingDetails from "./pages/BookingDetails";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import AdminAvailability from "./pages/AdminAvailability";
import PaymentCallback from "./pages/PaymentCallback";

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
        <Route
          path="/my-bookings"
          element={
            <ProtectedRoute>
              <MyBookings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/:bookingId"
          element={
            <ProtectedRoute>
              <BookingDetails />
            </ProtectedRoute>
          }
        />
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
        <Route path="/payment/callback" element={<PaymentCallback />} />
      </Routes>
    </div>
  );
};

export default App;
