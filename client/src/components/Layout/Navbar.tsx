import React from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  alpha,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { CalendarMonth } from "@mui/icons-material";
import { useAuth } from "../../contexts/AuthContext";
import { useWithSlug } from "../../hooks/useTenantSlug";

const brand = {
  surface: "#0f2547",
  surfaceAlt: "#12305a",
  cyan: "#19c1ff",
  cyanStrong: "#0f9ad8",
  yellow: "#f5c242",
  text: "#e5f0ff",
  muted: "#b7c8e8",
  border: "rgba(255, 255, 255, 0.12)",
};

const Navbar: React.FC = () => {
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const withSlug = useWithSlug();

  const handleLogout = () => {
    logout();
    navigate(withSlug("/"));
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        background:
          "linear-gradient(120deg, rgba(13, 38, 70, 0.92) 0%, rgba(10, 26, 48, 0.9) 100%)",
        backdropFilter: "blur(18px)",
        borderBottom: "1px solid",
        borderColor: alpha(brand.cyan, 0.18),
        boxShadow: "0 18px 40px rgba(0, 0, 0, 0.45)",
      }}
    >
      <Container maxWidth="lg">
        <Toolbar sx={{ px: { xs: 0 }, minHeight: { xs: 64, sm: 70 } }}>
          {/* Logo */}
          <Box
            component={Link}
            to={withSlug("/")}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              textDecoration: "none",
              color: "white",
              mr: 4,
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                background: "linear-gradient(135deg, #19c1ff 0%, #0f9ad8 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CalendarMonth sx={{ fontSize: 20, color: "white" }} />
            </Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: "1.1rem",
                letterSpacing: "-0.5px",
                display: { xs: "none", sm: "block" },
                color: brand.text,
              }}
            >
              MeetSync
            </Typography>
          </Box>

          {/* Navigation Links */}
          <Box sx={{ flexGrow: 1, display: "flex", gap: 1 }}>
            {isAuthenticated && isAdmin && (
              <Button
                component={Link}
                to={withSlug("/admin")}
                sx={{
                  color: brand.text,
                  textTransform: "none",
                  fontSize: "0.95rem",
                  fontWeight: 500,
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  "&:hover": {
                    bgcolor: alpha(brand.cyan, 0.12),
                  },
                }}
              >
                Dashboard
              </Button>
            )}
          </Box>

          {/* Right Side Actions */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {!isAuthenticated ? (
              <>
                <Button
                  component={Link}
                  to={withSlug("/book")}
                  sx={{
                    color: brand.text,
                    textTransform: "none",
                    fontSize: "0.95rem",
                    fontWeight: 500,
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    "&:hover": {
                      bgcolor: alpha(brand.cyan, 0.12),
                    },
                  }}
                >
                  Book Meeting
                </Button>
                <Button
                  component={Link}
                  to={withSlug("/login")}
                  sx={{
                    color: brand.text,
                    textTransform: "none",
                    fontSize: "0.95rem",
                    fontWeight: 500,
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    "&:hover": {
                      bgcolor: alpha(brand.cyan, 0.12),
                    },
                  }}
                >
                  Sign In
                </Button>
                <Button
                  variant="contained"
                  component={Link}
                  to={withSlug("/register")}
                  sx={{
                    bgcolor: brand.cyan,
                    color: "#04111f",
                    textTransform: "none",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    px: 3,
                    py: 1,
                    borderRadius: 2,
                    boxShadow: "0 12px 28px rgba(25, 193, 255, 0.35)",
                    "&:hover": {
                      bgcolor: brand.cyanStrong,
                      boxShadow: "0 14px 32px rgba(15, 154, 216, 0.4)",
                    },
                  }}
                >
                  Start Free
                </Button>
              </>
            ) : (
              <>
                <Button
                  component={Link}
                  to={withSlug("/admin/settings")}
                  sx={{
                    color: brand.text,
                    textTransform: "none",
                    fontSize: "0.95rem",
                    fontWeight: 500,
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    "&:hover": {
                      bgcolor: alpha(brand.cyan, 0.12),
                    },
                  }}
                >
                  Settings
                </Button>
                <Button
                  onClick={handleLogout}
                  sx={{
                    color: "#f87171",
                    textTransform: "none",
                    fontSize: "0.95rem",
                    fontWeight: 500,
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    "&:hover": {
                      bgcolor: alpha("#ef4444", 0.14),
                    },
                  }}
                >
                  Sign Out
                </Button>
              </>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Navbar;
