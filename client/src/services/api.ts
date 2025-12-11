import axios from "axios";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Tenant slug from URL first segment, e.g., /john/book
    try {
      const path = window.location.pathname || "/";
      const segments = path.split("/").filter(Boolean);
      const first = segments[0] || "";

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

      // Only treat first segment as slug if it's not an app route
      const slug = first && !appRoutes.includes(first) ? first : "";

      if (slug) {
        // Attach header for backward compatibility
        (config.headers as any)["X-Tenant-Slug"] = slug;

        // Prefix URL for tenant-scoped routes (bookings, payments, availability, admin, auth)
        const needsPrefix = [
          "/bookings",
          "/payments",
          "/availability",
          "/admin",
          "/auth",
          "/meeting-types",
        ];

        const url = config.url || "";
        if (needsPrefix.some((p) => url.startsWith(p))) {
          config.url = `/t/${slug}${url}`;
        }
      }
    } catch {
      // ignore
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),

  register: (userData: any) => api.post("/auth/register", userData),

  getProfile: () => api.get("/auth/me"),

  updateProfile: (userData: any) => api.put("/auth/profile", userData),
};

// Bookings API
export const bookingsApi = {
  getAvailableSlots: (date: string, duration?: number) =>
    api.get("/bookings/available-slots", { params: { date, duration } }),

  createBooking: (bookingData: any) => api.post("/bookings", bookingData),

  getMyBookings: (params?: any) => api.get("/bookings/my-bookings", { params }),

  getBooking: (id: string) => api.get(`/bookings/${id}`),

  cancelBooking: (id: string, reason?: string) =>
    api.put(`/bookings/${id}/cancel`, { reason }),
};

// Payments API
export const paymentsApi = {
  initializePayment: (
    bookingId: string,
    gateway?: "flutterwave" | "paystack"
  ) => api.post("/payments/initialize-payment", { bookingId, gateway }),

  verifyPayment: (reference: string) =>
    api.post("/payments/verify-payment", { reference }),
};

// Availability API
export const availabilityApi = {
  getAvailability: (date?: string) =>
    api.get("/availability", { params: { date } }),

  getDayAvailability: (dayOfWeek: number) =>
    api.get(`/availability/day/${dayOfWeek}`),

  createAvailability: (availabilityData: any) =>
    api.post("/availability", availabilityData),

  updateAvailability: (id: string, availabilityData: any) =>
    api.put(`/availability/${id}`, availabilityData),

  deleteAvailability: (id: string) => api.delete(`/availability/${id}`),
};

// Admin API
export const adminApi = {
  getDashboard: () => api.get("/admin/dashboard"),

  getAllBookings: (params?: any) => api.get("/admin/bookings", { params }),

  getAllClients: (params?: any) => api.get("/admin/clients", { params }),

  getClient: (id: string) => api.get(`/admin/clients/${id}`),

  updateBookingStatus: (id: string, status: string) =>
    api.put(`/admin/bookings/${id}/status`, { status }),

  getRevenueAnalytics: (period?: string) =>
    api.get("/admin/analytics/revenue", { params: { period } }),

  // Paystack subaccount management
  setupSubaccount: (data: {
    businessName: string;
    settlementBank: string;
    accountNumber: string;
    percentageCharge?: number;
  }) => api.post("/admin/setup-subaccount", data),

  getSubaccountStatus: () => api.get("/admin/subaccount-status"),

  // Flutterwave subaccount management
  setupFlutterwave: (data: {
    businessName: string;
    businessEmail: string;
    accountBank: string;
    accountNumber: string;
    bankName?: string;
    country?: string;
    currency?: string;
  }) => api.post("/admin/setup-flutterwave", data),

  getFlutterwaveStatus: () => api.get("/admin/flutterwave-status"),

  getFlutterwaveBanks: (country?: string) =>
    api.get("/admin/flutterwave/banks", { params: { country } }),

  getFlutterwaveCountries: () => api.get("/admin/flutterwave/countries"),
};

// Google Calendar API
export const googleCalendarApi = {
  connect: () => api.get("/google-calendar/connect"),

  handleCallback: (code: string) =>
    api.post("/google-calendar/callback", { code }),

  getStatus: () => api.get("/google-calendar/status"),

  disconnect: () => api.post("/google-calendar/disconnect"),

  refreshToken: () => api.post("/google-calendar/refresh"),
};

// Meeting Types API
export const meetingTypesApi = {
  getAll: () => api.get("/meeting-types"),

  getAllIncludingInactive: () => api.get("/meeting-types/all"),

  getOne: (id: string) => api.get(`/meeting-types/${id}`),

  create: (data: {
    name: string;
    description?: string;
    price: number;
    currency?: string;
    duration: number;
    color?: string;
    isActive?: boolean;
  }) => api.post("/meeting-types", data),

  update: (id: string, data: any) => api.put(`/meeting-types/${id}`, data),

  delete: (id: string) => api.delete(`/meeting-types/${id}`),
};
