export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'client';
  phone?: string;
  timezone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  _id: string;
  client: User;
  startTime: string;
  endTime: string;
  duration: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  meetingType: 'consultation' | 'follow-up' | 'project-discussion';
  description?: string;
  notes?: string;
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'failed';
  paymentIntentId?: string;
  amount: number;
  currency: string;
  googleEventId?: string;
  meetingLink?: string;
  calendarEventCreated: boolean;
  reminderSent: boolean;
  reminderSentAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  duration: number;
}

export interface Availability {
  _id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
  isActive: boolean;
  specificDate?: string;
  breakTimes: BreakTime[];
  createdAt: string;
  updatedAt: string;
}

export interface BreakTime {
  startTime: string;
  endTime: string;
  description?: string;
}

export interface DashboardStats {
  totalBookings: number;
  totalClients: number;
  monthlyBookings: number;
  weeklyBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  monthlyRevenue: number;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  timezone?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface BookingFormData {
  startTime: string;
  endTime: string;
  meetingType: string;
  description?: string;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AvailableSlotsResponse {
  availableSlots: TimeSlot[];
}

export interface BookingsResponse {
  bookings: Booking[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ClientWithStats extends User {
  bookingCount: number;
  totalSpent: number;
}