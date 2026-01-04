import React, { useState } from "react";
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Link as MuiLink,
  Grid,
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
  Person,
  Phone,
  CalendarMonth,
} from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";
import { useWithSlug } from "../hooks/useTenantSlug";

const Register: React.FC = () => {
  const { register } = useAuth();
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
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const { confirmPassword, ...registerData } = formData;
      await register(registerData);

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

  const inputStyles = {
    "& .MuiOutlinedInput-root": {
      bgcolor: alpha(brand.surfaceAlt, 0.72),
      color: brand.text,
      "& fieldset": { borderColor: alpha(brand.cyan, 0.16) },
      "&:hover fieldset": { borderColor: alpha(brand.cyan, 0.35) },
      "&.Mui-focused fieldset": { borderColor: brand.cyan },
    },
    "& .MuiInputLabel-root": { color: brand.muted },
    "& .MuiInputLabel-root.Mui-focused": { color: brand.cyan },
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
          top: -150,
          left: -140,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(25, 193, 255, 0.22) 0%, transparent 70%)",
          opacity: 0.2,
          filter: "blur(70px)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          bottom: -140,
          right: -110,
          width: 460,
          height: 460,
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
            Start your scheduling business
          </Typography>
          <Typography
            variant="h6"
            sx={{ color: brand.muted, mb: 4, lineHeight: 1.6 }}
          >
            Create your admin account and get your own booking page.
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[
              "Custom availability settings",
              "Automated booking confirmations",
              "Integrated payment processing",
              "Google Calendar sync",
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

      {/* Right side - Register form */}
      <Box
        sx={{
          flex: { xs: 1, md: 0.8 },
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          p: { xs: 3, sm: 4 },
          overflowY: "auto",
        }}
      >
        <Container maxWidth="sm">
          <Box
            sx={{
              bgcolor: alpha(brand.surface, 0.92),
              backdropFilter: "blur(20px)",
              borderRadius: 4,
              p: { xs: 4, sm: 6 },
              my: 4,
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
              Create Your Admin Account
            </Typography>
            <Typography
              sx={{
                color: brand.muted,
                mb: 4,
                textAlign: "center",
              }}
            >
              Get your personalized booking page • Accept payments • Manage
              clients
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
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    autoComplete="given-name"
                    name="firstName"
                    required
                    fullWidth
                    id="firstName"
                    label="First Name"
                    autoFocus
                    value={formData.firstName}
                    onChange={handleChange}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person sx={{ color: brand.muted }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={inputStyles}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    id="lastName"
                    label="Last Name"
                    name="lastName"
                    autoComplete="family-name"
                    value={formData.lastName}
                    onChange={handleChange}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person sx={{ color: brand.muted }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={inputStyles}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    required
                    fullWidth
                    id="email"
                    label="Email Address"
                    name="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Email sx={{ color: brand.muted }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={inputStyles}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    id="phone"
                    label="Phone Number"
                    name="phone"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Phone sx={{ color: brand.muted }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={inputStyles}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    required
                    fullWidth
                    name="password"
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    id="password"
                    autoComplete="new-password"
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
                    sx={inputStyles}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    required
                    fullWidth
                    name="confirmPassword"
                    label="Confirm Password"
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    value={formData.confirmPassword}
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
                            onClick={() =>
                              setShowConfirmPassword(!showConfirmPassword)
                            }
                            edge="end"
                            sx={{ color: brand.muted }}
                          >
                            {showConfirmPassword ? (
                              <VisibilityOff />
                            ) : (
                              <Visibility />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={inputStyles}
                  />
                </Grid>
              </Grid>

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
                {loading ? "Creating Account..." : "Sign Up"}
              </Button>

              <Box textAlign="center">
                <Typography sx={{ color: brand.muted, display: "inline" }}>
                  Already have an account?{" "}
                </Typography>
                <MuiLink
                  component={Link}
                  to={withSlug("/login")}
                  sx={{
                    color: brand.cyan,
                    fontWeight: 600,
                    textDecoration: "none",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  Sign In
                </MuiLink>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default Register;
