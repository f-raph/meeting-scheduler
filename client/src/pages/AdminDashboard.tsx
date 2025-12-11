import React, { useMemo, useState } from "react";
import {
  Container,
  Typography,
  Box,
  Grid,
  Paper,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Tabs,
  Tab,
  TextField,
  MenuItem,
} from "@mui/material";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useQuery } from "react-query";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  People,
  Event,
  AttachMoney,
  TrendingUp,
  Download,
  Search,
} from "@mui/icons-material";
import { adminApi } from "../services/api";
import { useWithSlug } from "../hooks/useTenantSlug";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const COLORS = ["#19c1ff", "#f5c242", "#7ce3ff", "#0f9ad8", "#7dd3fc"];

const AdminDashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  // Removed client modal state - no longer tracking individual clients
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const navigate = useNavigate();
  const withSlug = useWithSlug();

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery(
    ["admin-dashboard"],
    () => adminApi.getDashboard()
  );
  const { data: bookingsData } = useQuery(["admin-bookings"], () =>
    adminApi.getAllBookings({ limit: 100 })
  );
  const { data: clientsData } = useQuery(["admin-clients"], () =>
    adminApi.getAllClients({ limit: 100 })
  );

  const filteredBookings = useMemo(() => {
    let filtered = bookingsData?.data?.bookings || [];
    if (statusFilter)
      filtered = filtered.filter((b: any) => b.status === statusFilter);
    if (paymentFilter)
      filtered = filtered.filter((b: any) => b.paymentStatus === paymentFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b: any) =>
          b.clientName?.toLowerCase().includes(q) ||
          b.clientEmail?.toLowerCase().includes(q)
      );
    }
    if (dateFromFilter) {
      const fromDate = new Date(dateFromFilter);
      filtered = filtered.filter((b: any) => new Date(b.startTime) >= fromDate);
    }
    if (dateToFilter) {
      const toDate = new Date(dateToFilter);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((b: any) => new Date(b.startTime) <= toDate);
    }
    return filtered;
  }, [
    bookingsData,
    statusFilter,
    paymentFilter,
    searchQuery,
    dateFromFilter,
    dateToFilter,
  ]);

  const bookingsByType = useMemo(() => {
    const types = bookingsData?.data?.bookings || [];
    const grouped: { [key: string]: number } = {};
    types.forEach((b: any) => {
      grouped[b.meetingType] = (grouped[b.meetingType] || 0) + 1;
    });
    return Object.entries(grouped).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, " "),
      value,
    }));
  }, [bookingsData]);

  const revenueByType = useMemo(() => {
    const types = bookingsData?.data?.bookings || [];
    const grouped: { [key: string]: number } = {};
    types.forEach((b: any) => {
      if (b.paymentStatus === "paid")
        grouped[b.meetingType] = (grouped[b.meetingType] || 0) + b.amount;
    });
    return Object.entries(grouped).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, " "),
      value: parseFloat(value.toFixed(2)),
    }));
  }, [bookingsData]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) =>
    setTabValue(newValue);
  // Removed client modal handlers - no longer tracking individual clients

  const handleExportBookings = () => {
    if (!filteredBookings || filteredBookings.length === 0) {
      alert("No bookings to export");
      return;
    }
    const headers = [
      "Client Name",
      "Email",
      "Phone",
      "Date",
      "Time",
      "Type",
      "Status",
      "Payment Status",
      "Amount",
    ];
    const rows = filteredBookings.map((booking: any) => [
      booking.clientName || "-",
      booking.clientEmail || "-",
      booking.clientPhone || "-",
      format(new Date(booking.startTime), "MMM d, yyyy"),
      format(new Date(booking.startTime), "h:mm a"),
      booking.meetingType,
      booking.status,
      booking.paymentStatus,
      booking.amount,
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bookings-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setStatusFilter("");
    setPaymentFilter("");
    setSearchQuery("");
    setDateFromFilter("");
    setDateToFilter("");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "success";
      case "pending":
        return "warning";
      case "cancelled":
        return "error";
      case "completed":
        return "info";
      default:
        return "default";
    }
  };

  if (dashboardLoading)
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography>Loading dashboard...</Typography>
      </Container>
    );

  const stats = dashboardData?.data?.statistics || {};
  const upcomingBookings = dashboardData?.data?.upcomingBookings || [];
  const recentBookings = dashboardData?.data?.recentBookings || [];
  const allBookings = bookingsData?.data?.bookings || [];
  const allClients = clientsData?.data?.clients || [];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Admin Dashboard
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ display: "flex", alignItems: "center" }}>
              <People sx={{ fontSize: 40, color: "primary.main", mr: 2 }} />
              <Box>
                <Typography variant="h4">{stats.totalClients || 0}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Unique Clients
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ display: "flex", alignItems: "center" }}>
              <Event sx={{ fontSize: 40, color: "primary.main", mr: 2 }} />
              <Box>
                <Typography variant="h4">{stats.totalBookings || 0}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Bookings
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ display: "flex", alignItems: "center" }}>
              <AttachMoney
                sx={{ fontSize: 40, color: "primary.main", mr: 2 }}
              />
              <Box>
                <Typography variant="h4">
                  ${stats.monthlyRevenue || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Monthly Revenue
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ display: "flex", alignItems: "center" }}>
              <TrendingUp sx={{ fontSize: 40, color: "primary.main", mr: 2 }} />
              <Box>
                <Typography variant="h4">
                  {stats.monthlyBookings || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  This Month
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Overview" />
          <Tab label="Bookings" />
          <Tab label="Clients" />
          <Tab label="Analytics" />
        </Tabs>
      </Paper>
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Upcoming Bookings
              </Typography>
              {upcomingBookings.length === 0 ? (
                <Typography color="text.secondary">
                  No upcoming bookings
                </Typography>
              ) : (
                upcomingBookings.slice(0, 5).map((booking: any) => (
                  <Box
                    key={booking._id}
                    sx={{
                      mb: 2,
                      pb: 2,
                      borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                    }}
                  >
                    <Typography variant="body1" fontWeight="medium">
                      {booking.clientName || "Guest"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {format(
                        new Date(booking.startTime),
                        "MMM d, yyyy h:mm a"
                      )}
                    </Typography>
                    <Chip
                      label={booking.status}
                      color={getStatusColor(booking.status) as any}
                      size="small"
                    />
                  </Box>
                ))
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Recent Bookings
              </Typography>
              {recentBookings.length === 0 ? (
                <Typography color="text.secondary">
                  No recent bookings
                </Typography>
              ) : (
                recentBookings.slice(0, 5).map((booking: any) => (
                  <Box
                    key={booking._id}
                    sx={{
                      mb: 2,
                      pb: 2,
                      borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                    }}
                  >
                    <Typography variant="body1" fontWeight="medium">
                      {booking.clientName || "Guest"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {format(new Date(booking.createdAt), "MMM d, yyyy")} - $
                      {booking.amount}
                    </Typography>
                    <Chip
                      label={booking.status}
                      color={getStatusColor(booking.status) as any}
                      size="small"
                    />
                  </Box>
                ))
              )}
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <Paper sx={{ mb: 3, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Filters & Search
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <Search sx={{ mr: 1, color: "text.secondary" }} />
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                select
                size="small"
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="confirmed">Confirmed</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                select
                size="small"
                label="Payment"
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                type="date"
                size="small"
                label="From"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                type="date"
                size="small"
                label="To"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                size="small"
                onClick={resetFilters}
                fullWidth
              >
                Reset
              </Button>
            </Grid>
          </Grid>
          <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredBookings.length} of {allBookings.length}
            </Typography>
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={handleExportBookings}
              size="small"
            >
              Export CSV
            </Button>
          </Box>
        </Paper>
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Client</TableCell>
                  <TableCell>Date & Time</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Payment</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredBookings.map((booking: any) => (
                  <TableRow key={booking._id}>
                    <TableCell>{booking.clientName || "Guest"}</TableCell>
                    <TableCell>
                      {format(
                        new Date(booking.startTime),
                        "MMM d, yyyy h:mm a"
                      )}
                    </TableCell>
                    <TableCell>{booking.meetingType}</TableCell>
                    <TableCell>
                      <Chip
                        label={booking.status}
                        color={getStatusColor(booking.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={booking.paymentStatus}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>${booking.amount}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={() =>
                          navigate(withSlug(`/bookings/${booking._id}`))
                        }
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </TabPanel>
      <TabPanel value={tabValue} index={2}>
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Bookings</TableCell>
                  <TableCell>Total Spent</TableCell>
                  <TableCell>Last Booking</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary">
                        No clients yet
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  allClients.map((client: any) => (
                    <TableRow key={client._id}>
                      <TableCell>{client.clientName || "-"}</TableCell>
                      <TableCell>{client.clientEmail || "-"}</TableCell>
                      <TableCell>{client.clientPhone || "-"}</TableCell>
                      <TableCell>{client.bookingCount || 0}</TableCell>
                      <TableCell>
                        ${client.totalSpent?.toFixed(2) || "0.00"}
                      </TableCell>
                      <TableCell>
                        {client.lastBooking
                          ? format(new Date(client.lastBooking), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </TabPanel>
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Bookings by Type
              </Typography>
              {bookingsByType.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={bookingsByType}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#19c1ff"
                      dataKey="value"
                    >
                      {bookingsByType.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Typography color="text.secondary">No data</Typography>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Revenue by Type
              </Typography>
              {revenueByType.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenueByType}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${value}`} />
                    <Bar dataKey="value" fill="#19c1ff" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Typography color="text.secondary">No data</Typography>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Analytics Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Bookings
                    </Typography>
                    <Typography variant="h5">{allBookings.length}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Confirmed
                    </Typography>
                    <Typography variant="h5">
                      {
                        allBookings.filter((b: any) => b.status === "confirmed")
                          .length
                      }
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Revenue
                    </Typography>
                    <Typography variant="h5">
                      $
                      {allBookings
                        .filter((b: any) => b.paymentStatus === "paid")
                        .reduce((sum: number, b: any) => sum + b.amount, 0)
                        .toFixed(2)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Avg Value
                    </Typography>
                    <Typography variant="h5">
                      $
                      {allBookings.length > 0
                        ? (
                            allBookings.reduce(
                              (sum: number, b: any) => sum + b.amount,
                              0
                            ) / allBookings.length
                          ).toFixed(2)
                        : "0.00"}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>
      {/* Removed Client Modal - no longer tracking individual clients */}
    </Container>
  );
};

export default AdminDashboard;
