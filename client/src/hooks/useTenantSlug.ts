import { useLocation } from "react-router-dom";
import { useMemo } from "react";

/**
 * Extract tenant slug from current URL path and provide helper to prefix paths
 * Returns { tenantSlug: string, withSlug: (path: string) => string }
 */
export const useTenantSlug = () => {
  const location = useLocation();

  const tenantSlug = useMemo(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return "";

    const first = segments[0];
    // Exclude known app routes - these are not tenant slugs
    const appRoutes = [
      "login",
      "register",
      "book",
      "bookings",
      "profile",
      "admin",
      "payment",
    ];

    if (appRoutes.includes(first)) return "";

    // Otherwise, treat first segment as tenant slug
    return first;
  }, [location.pathname]);

  const withSlug = useMemo(
    () => (path: string) => tenantSlug ? `/${tenantSlug}${path}` : path,
    [tenantSlug]
  );

  return { tenantSlug, withSlug };
};

/**
 * Helper hook that returns just the withSlug function
 */
export const useWithSlug = () => {
  const { withSlug } = useTenantSlug();
  return withSlug;
};
