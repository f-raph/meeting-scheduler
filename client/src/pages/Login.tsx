import React, { useState } from "react";
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Link as MuiLink,
  alpha,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  CalendarMonth,
} from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";
import { useWithSlug } from "../hooks/useTenantSlug";

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const withSlug = useWithSlug();
  const brand = {
    navy: "#08162b",
    surface: "#0f2547",
    surfaceAlt: "#12305a",
    cyan: "#19c1ff",
    cyanStrong: "#0f9ad8",
    yellow: "#f5c242",
    text: "#e5f0ff",
    muted: "#b7c8e8",
    border: "rgba(255, 255, 255, 0.12)",
  };
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(formData.email, formData.password);

      // Get the user data from localStorage to check role and slug
      const token = localStorage.getItem("token");
      if (token) {
        const response = await fetch(
          `${
            process.env.REACT_APP_API_URL || "http://localhost:5000/api"
          }/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await response.json();

        // If admin with slug, redirect to their tenant URL
        if (data.user?.role === "admin" && data.user?.slug) {
          window.location.href = `/${data.user.slug}/admin`;
          return;
        }
      }

      navigate(withSlug("/"));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        background:
          "linear-gradient(145deg, #08162b 0%, #0b2344 45%, #12305a 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background decorative elements */}
      <Box
        sx={{
          position: "absolute",
          top: -120,
          right: -120,
          width: 440,
          height: 440,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(25, 193, 255, 0.22) 0%, transparent 70%)",
          opacity: 0.18,
          filter: "blur(68px)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          bottom: -180,
          left: -140,
          width: 540,
          height: 540,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(245, 194, 66, 0.16) 0%, transparent 70%)",
          opacity: 0.2,
          filter: "blur(78px)",
        }}
      />

      {/* Left side - Branding */}
      <Box
        sx={{
          flex: 1,
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          p: 8,
          position: "relative",
        }}
      >
        <Box sx={{ maxWidth: 500, zIndex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2.5,
                background: "linear-gradient(135deg, #19c1ff 0%, #0f9ad8 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CalendarMonth sx={{ fontSize: 32, color: "white" }} />
            </Box>
            <Typography
              variant="h4"
              sx={{ fontWeight: 700, color: brand.text }}
            >
              MeetSync
            </Typography>
          </Box>

          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              color: brand.text,
              mb: 3,
              lineHeight: 1.2,
            }}
          >
            Admin Portal
          </Typography>
          <Typography
            variant="h6"
            sx={{ color: brand.muted, mb: 4, lineHeight: 1.6 }}
          >
            Sign in to your admin dashboard to manage availability, view
            bookings, and track client meetings.
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[
              "Manage your availability",
              "Track all bookings in one place",
              "Automated calendar sync",
              "Instant meeting confirmations",
            ].map((feature, index) => (
              <Box key={index} sx={{ display: "flex", alignItems: "center" }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: brand.yellow,
                    mr: 2,
                  }}
                />
                <Typography sx={{ color: brand.text }}>{feature}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Right side - Login form */}
      <Box
        sx={{
          flex: { xs: 1, md: 0.8 },
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          p: { xs: 3, sm: 4 },
        }}
      >
        <Container maxWidth="sm">
          <Box
            sx={{
              bgcolor: alpha(brand.surface, 0.92),
              backdropFilter: "blur(20px)",
              borderRadius: 4,
              p: { xs: 4, sm: 6 },
              border: "1px solid",
              borderColor: alpha(brand.cyan, 0.18),
              boxShadow: "0 24px 70px rgba(0, 0, 0, 0.45)",
            }}
          >
            <Typography
              component="h1"
              variant="h4"
              sx={{
                fontWeight: 700,
                color: brand.text,
                mb: 1,
                textAlign: "center",
              }}
            >
              Sign In
            </Typography>
            <Typography
              sx={{
                color: brand.muted,
                mb: 4,
                textAlign: "center",
              }}
            >
              Admin access only • Clients don't need to login
            </Typography>

            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: 3,
                  bgcolor: alpha("#ef4444", 0.1),
                  border: "1px solid",
                  borderColor: alpha("#ef4444", 0.3),
                  color: "#fca5a5",
                  "& .MuiAlert-icon": { color: "#f87171" },
                }}
              >
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                autoFocus
                value={formData.email}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email sx={{ color: brand.muted }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    bgcolor: alpha(brand.surfaceAlt, 0.72),
                    color: brand.text,
                    "& fieldset": { borderColor: alpha(brand.cyan, 0.16) },
                    "&:hover fieldset": {
                      borderColor: alpha(brand.cyan, 0.35),
                    },
                    "&.Mui-focused fieldset": { borderColor: brand.cyan },
                  },
                  "& .MuiInputLabel-root": { color: brand.muted },
                  "& .MuiInputLabel-root.Mui-focused": { color: brand.cyan },
                }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type={showPassword ? "text" : "password"}
                id="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: brand.muted }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        sx={{ color: brand.muted }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    bgcolor: alpha(brand.surfaceAlt, 0.72),
                    color: brand.text,
                    "& fieldset": { borderColor: alpha(brand.cyan, 0.16) },
                    "&:hover fieldset": {
                      borderColor: alpha(brand.cyan, 0.35),
                    },
                    "&.Mui-focused fieldset": { borderColor: brand.cyan },
                  },
                  "& .MuiInputLabel-root": { color: brand.muted },
                  "& .MuiInputLabel-root.Mui-focused": { color: brand.cyan },
                }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{
                  mt: 4,
                  mb: 2,
                  py: 1.5,
                  bgcolor: brand.cyan,
                  color: "#04111f",
                  fontSize: "1rem",
                  fontWeight: 600,
                  textTransform: "none",
                  borderRadius: 2,
                  boxShadow: "0 10px 28px rgba(25, 193, 255, 0.32)",
                  "&:hover": {
                    bgcolor: brand.cyanStrong,
                    boxShadow: "0 12px 30px rgba(15, 154, 216, 0.4)",
                  },
                  "&:disabled": {
                    bgcolor: alpha(brand.cyan, 0.28),
                    color: alpha(brand.text, 0.5),
                  },
                }}
              >
                {loading ? "Signing In..." : "Sign In"}
              </Button>

              <Box textAlign="center">
                <Typography sx={{ color: brand.muted, display: "inline" }}>
                  Don't have an account?{" "}
                </Typography>
                <MuiLink
                  component={Link}
                  to={withSlug("/register")}
                  sx={{
                    color: brand.cyan,
                    fontWeight: 600,
                    textDecoration: "none",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  Sign Up
                </MuiLink>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default Login;
