import React from "react";
import {
  Container,
  Typography,
  Button,
  Box,
  Grid,
  Card,
  CardContent,
  alpha,
} from "@mui/material";
import { Link } from "react-router-dom";
import {
  CalendarMonth,
  Payment,
  VideoCall,
  TrendingUp,
  CheckCircle,
  Speed,
  Security,
  Public,
} from "@mui/icons-material";
import { useWithSlug } from "../hooks/useTenantSlug";

const Home: React.FC = () => {
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

  const features = [
    {
      icon: <CalendarMonth sx={{ fontSize: 40 }} />,
      title: "Smart Scheduling",
      description:
        "Availability management with automatic conflict detection and Google Calendar sync.",
    },
    {
      icon: <Payment sx={{ fontSize: 40 }} />,
      title: "Multi-Currency Payments",
      description:
        "Accept payments in USD, EUR, GBP, NGN and more with instant payouts.",
    },
    {
      icon: <VideoCall sx={{ fontSize: 40 }} />,
      title: "Instant Meet Links",
      description:
        "Automatic Google Meet integration with calendar invites sent to all attendees.",
    },
    {
      icon: <TrendingUp sx={{ fontSize: 40 }} />,
      title: "Analytics Dashboard",
      description:
        "Track bookings, revenue, and client engagement with real-time insights.",
    },
    {
      icon: <Speed sx={{ fontSize: 40 }} />,
      title: "Instant Payouts",
      description: "Receive payments directly to your bank account instantly.",
    },
    {
      icon: <Public sx={{ fontSize: 40 }} />,
      title: "Global Ready",
      description:
        "Support for multiple currencies and international payment methods out of the box.",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Create Your Account",
      description: "Sign up in seconds and get your personalized booking link",
    },
    {
      number: "02",
      title: "Set Your Availability",
      description:
        "Define your working hours and meeting types with custom pricing",
    },
    {
      number: "03",
      title: "Share Your Link",
      description:
        "Share your unique booking link and let clients schedule instantly",
    },
    {
      number: "04",
      title: "Get Paid Automatically",
      description:
        "Receive payments and calendar invites without lifting a finger",
    },
  ];

  return (
    <Box sx={{ bgcolor: "transparent", minHeight: "100vh", color: brand.text }}>
      {/* Hero Section */}
      <Box
        sx={{
          background:
            "linear-gradient(145deg, rgba(10, 27, 50, 0.96) 0%, rgba(10, 35, 63, 0.96) 45%, rgba(16, 57, 93, 0.94) 100%)",
          pt: { xs: 8, md: 12 },
          pb: { xs: 12, md: 16 },
          position: "relative",
          overflow: "hidden",
          borderBottom: `1px solid ${brand.border}`,
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.45)",
        }}
      >
        {/* Decorative gradient orbs */}
        <Box
          sx={{
            position: "absolute",
            top: "-12%",
            right: "-8%",
            width: "520px",
            height: "520px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(25, 193, 255, 0.22) 0%, transparent 70%)",
            filter: "blur(68px)",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            bottom: "-18%",
            left: "-8%",
            width: "620px",
            height: "620px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(245, 194, 66, 0.12) 0%, transparent 70%)",
            filter: "blur(90px)",
          }}
        />

        <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: "2.5rem", md: "3.5rem", lg: "4rem" },
                  fontWeight: 800,
                  lineHeight: 1.2,
                  mb: 3,
                  background:
                    "linear-gradient(120deg, #19c1ff 0%, #7ce3ff 45%, #f5c242 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Schedule Meetings That Drive Results
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  color: brand.muted,
                  mb: 4,
                  lineHeight: 1.6,
                  fontSize: { xs: "1rem", md: "1.25rem" },
                }}
              >
                The all-in-one scheduling platform with smart availability,
                secure payments, and instant video conferencing. Get paid while
                you sleep.
              </Typography>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <Button
                  variant="contained"
                  size="large"
                  component={Link}
                  to={withSlug("/register")}
                  sx={{
                    bgcolor: brand.cyan,
                    color: "#04111f",
                    px: 4,
                    py: 1.5,
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    borderRadius: 2,
                    textTransform: "none",
                    boxShadow: "0 12px 30px rgba(25, 193, 255, 0.35)",
                    "&:hover": {
                      bgcolor: brand.cyanStrong,
                      boxShadow: "0 14px 36px rgba(15, 154, 216, 0.42)",
                      transform: "translateY(-2px)",
                    },
                    transition: "all 0.3s ease",
                  }}
                >
                  Sign Up Free
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  component={Link}
                  to={withSlug("/book")}
                  sx={{
                    borderColor: brand.yellow,
                    color: brand.text,
                    px: 4,
                    py: 1.5,
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    borderRadius: 2,
                    textTransform: "none",
                    "&:hover": {
                      borderColor: brand.cyan,
                      bgcolor: alpha(brand.cyan, 0.12),
                    },
                  }}
                >
                  Book a Meeting
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  position: "relative",
                  borderRadius: 4,
                  overflow: "hidden",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                }}
              >
                <Box
                  component="img"
                  src="/images/hero-meeting.png"
                  alt="Professional video meeting dashboard"
                  sx={{
                    width: "100%",
                    height: "400px",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Stats Section */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Grid container spacing={4}>
          {[
            { number: "50K+", label: "Meetings Scheduled" },
            { number: "99.9%", label: "Uptime Guarantee" },
            { number: "150+", label: "Countries Supported" },
            { number: "<2min", label: "Average Setup Time" },
          ].map((stat, index) => (
            <Grid item xs={6} md={3} key={index}>
              <Box sx={{ textAlign: "center" }}>
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 800,
                    background:
                      "linear-gradient(135deg, #19c1ff 0%, #f5c242 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    mb: 1,
                  }}
                >
                  {stat.number}
                </Typography>
                <Typography variant="body2" sx={{ color: brand.muted }}>
                  {stat.label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Features Section */}
      <Box sx={{ bgcolor: brand.surfaceAlt, py: 12 }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: "center", mb: 8 }}>
            <Typography
              variant="overline"
              sx={{ color: brand.cyan, fontWeight: 600, letterSpacing: 2 }}
            >
              POWERFUL FEATURES
            </Typography>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: "2rem", md: "3rem" },
                fontWeight: 800,
                mt: 2,
                mb: 2,
                color: brand.text,
              }}
            >
              Everything You Need to Succeed
            </Typography>
            <Typography
              variant="h6"
              sx={{ color: brand.muted, maxWidth: "600px", mx: "auto" }}
            >
              Professional scheduling tools designed for modern businesses
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {features.map((feature, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card
                  sx={{
                    bgcolor: brand.surface,
                    border: "1px solid",
                    borderColor: brand.border,
                    borderRadius: 3,
                    height: "100%",
                    transition: "all 0.3s ease",
                    boxShadow: "0 16px 44px rgba(0, 0, 0, 0.35)",
                    overflow: "hidden",
                    "&:hover": {
                      borderColor: brand.cyan,
                      transform: "translateY(-6px)",
                      boxShadow: "0 18px 48px rgba(25, 193, 255, 0.18)",
                    },
                  }}
                >
                  <Box
                    sx={{
                      position: "relative",
                      height: "300px",
                      backgroundImage: `url(/images/feature-${index + 1}.jpg)`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      "&::before": {
                        content: '""',
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundImage: `url(/images/feature-${
                          index + 1
                        }.jpg)`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        filter: "blur(8px)",
                        maskImage:
                          "linear-gradient(to top, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.8) 20%, rgba(0, 0, 0, 0.5) 40%, rgba(0, 0, 0, 0.15) 60%, rgba(0, 0, 0, 0) 100%)",
                        WebkitMaskImage:
                          "linear-gradient(to top, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.8) 20%, rgba(0, 0, 0, 0.5) 40%, rgba(0, 0, 0, 0.15) 60%, rgba(0, 0, 0, 0) 100%)",
                        zIndex: 0,
                      },
                    }}
                  >
                    <CardContent
                      sx={{
                        position: "relative",
                        zIndex: 1,
                        p: 1.5,
                        pb: 2,
                      }}
                    >
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 700,
                          mb: 0.5,
                          color: brand.surfaceAlt,
                        }}
                      >
                        {feature.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: brand.surfaceAlt, lineHeight: 1.4 }}
                      >
                        {feature.description}
                      </Typography>
                    </CardContent>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* How It Works Section */}
      <Container maxWidth="lg" sx={{ py: 12 }}>
        <Box sx={{ textAlign: "center", mb: 8 }}>
          <Typography
            variant="overline"
            sx={{ color: brand.cyan, fontWeight: 600, letterSpacing: 2 }}
          >
            SIMPLE PROCESS
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: "2rem", md: "3rem" },
              fontWeight: 800,
              mt: 2,
              mb: 2,
              color: brand.text,
            }}
          >
            Get Started in Minutes
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {steps.map((step, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Box sx={{ position: "relative" }}>
                <Typography
                  variant="h2"
                  sx={{
                    fontSize: "4rem",
                    fontWeight: 900,
                    color: alpha(brand.cyan, 0.2),
                    mb: 2,
                  }}
                >
                  {step.number}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, mb: 1, color: brand.text }}
                >
                  {step.title}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: brand.muted, lineHeight: 1.7 }}
                >
                  {step.description}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* CTA Section */}
      <Box
        sx={{
          background:
            "linear-gradient(135deg, #0f2f5b 0%, #0a1f3c 60%, #123d6b 100%)",
          py: 12,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Container
          maxWidth="md"
          sx={{ textAlign: "center", position: "relative", zIndex: 1 }}
        >
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: "2rem", md: "3rem" },
              fontWeight: 800,
              mb: 3,
              color: brand.text,
            }}
          >
            Ready to Transform Your Scheduling?
          </Typography>
          <Typography variant="h6" sx={{ mb: 4, color: brand.muted }}>
            Join thousands of professionals who save time and get paid faster
          </Typography>
          <Button
            variant="contained"
            size="large"
            component={Link}
            to={withSlug("/register")}
            sx={{
              bgcolor: brand.yellow,
              color: "#0a1f33",
              px: 6,
              py: 2,
              fontSize: "1.1rem",
              fontWeight: 700,
              borderRadius: 2,
              textTransform: "none",
              boxShadow: "0 16px 40px rgba(245, 194, 66, 0.28)",
              "&:hover": {
                bgcolor: "#e6b637",
                transform: "scale(1.05)",
                boxShadow: "0 18px 44px rgba(230, 182, 55, 0.32)",
              },
              transition: "all 0.3s ease",
            }}
          >
            Start Your Free Trial
          </Button>
          <Typography variant="body2" sx={{ mt: 3, color: brand.muted }}>
            No credit card required • Free forever for your first 10 bookings
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default Home;
