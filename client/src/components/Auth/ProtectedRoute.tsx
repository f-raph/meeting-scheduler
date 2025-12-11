import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Box, CircularProgress } from "@mui/material";
import { useTenantSlug } from "../../hooks/useTenantSlug";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  adminOnly = false,
}) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const { withSlug } = useTenantSlug();

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="50vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={withSlug("/login")} replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to={withSlug("/")} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
