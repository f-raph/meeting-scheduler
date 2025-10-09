import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  register: (userData: any) =>
    api.post('/auth/register', userData),
  
  getProfile: () =>
    api.get('/auth/me'),
  
  updateProfile: (userData: any) =>
    api.put('/auth/profile', userData),
};

// Bookings API
export const bookingsApi = {
  getAvailableSlots: (date: string, duration?: number) =>
    api.get('/bookings/available-slots', { params: { date, duration } }),
  
  createBooking: (bookingData: any) =>
    api.post('/bookings', bookingData),
  
  getMyBookings: (params?: any) =>
    api.get('/bookings/my-bookings', { params }),
  
  getBooking: (id: string) =>
    api.get(`/bookings/${id}`),
  
  cancelBooking: (id: string, reason?: string) =>
    api.put(`/bookings/${id}/cancel`, { reason }),
};

// Payments API
export const paymentsApi = {
  initializePayment: (bookingId: string) =>
    api.post('/payments/initialize-payment', { bookingId }),
  
  verifyPayment: (reference: string) =>
    api.post('/payments/verify-payment', { reference }),
};

// Availability API
export const availabilityApi = {
  getAvailability: (date?: string) =>
    api.get('/availability', { params: { date } }),
  
  getDayAvailability: (dayOfWeek: number) =>
    api.get(`/availability/day/${dayOfWeek}`),
  
  createAvailability: (availabilityData: any) =>
    api.post('/availability', availabilityData),
  
  updateAvailability: (id: string, availabilityData: any) =>
    api.put(`/availability/${id}`, availabilityData),
  
  deleteAvailability: (id: string) =>
    api.delete(`/availability/${id}`),
};

// Admin API
export const adminApi = {
  getDashboard: () =>
    api.get('/admin/dashboard'),
  
  getAllBookings: (params?: any) =>
    api.get('/admin/bookings', { params }),
  
  getAllClients: (params?: any) =>
    api.get('/admin/clients', { params }),
  
  getClient: (id: string) =>
    api.get(`/admin/clients/${id}`),
  
  updateBookingStatus: (id: string, status: string) =>
    api.put(`/admin/bookings/${id}/status`, { status }),
  
  getRevenueAnalytics: (period?: string) =>
    api.get('/admin/analytics/revenue', { params: { period } }),
};