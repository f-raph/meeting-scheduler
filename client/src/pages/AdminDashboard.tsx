import React from 'react';
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
} from '@mui/material';
import { useQuery } from 'react-query';
import { format } from 'date-fns';
import { 
  People, 
  Event, 
  AttachMoney, 
  TrendingUp 
} from '@mui/icons-material';
import { adminApi } from '../services/api';

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

const AdminDashboard: React.FC = () => {
  const [tabValue, setTabValue] = React.useState(0);

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery(
    ['admin-dashboard'],
    () => adminApi.getDashboard()
  );

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery(
    ['admin-bookings'],
    () => adminApi.getAllBookings({ limit: 10 })
  );

  const { data: clientsData, isLoading: clientsLoading } = useQuery(
    ['admin-clients'],
    () => adminApi.getAllClients({ limit: 10 })
  );

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'cancelled':
        return 'error';
      case 'completed':
        return 'info';
      default:
        return 'default';
    }
  };

  if (dashboardLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography>Loading dashboard...</Typography>
      </Container>
    );
  }

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

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
              <People sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
              <Box>
                <Typography variant="h4">{stats.totalClients || 0}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Clients
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
              <Event sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
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
            <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
              <AttachMoney sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
              <Box>
                <Typography variant="h4">${stats.monthlyRevenue || 0}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Monthly Revenue
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
              <TrendingUp sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
              <Box>
                <Typography variant="h4">{stats.monthlyBookings || 0}</Typography>
                <Typography variant="body2" color="text.secondary">
                  This Month
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Navigation Tabs */}
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

      {/* Overview Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {/* Upcoming Bookings */}
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
                  <Box key={booking._id} sx={{ mb: 2, pb: 2, borderBottom: '1px solid #eee' }}>
                    <Typography variant="body1" fontWeight="medium">
                      {booking.client.firstName} {booking.client.lastName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {format(new Date(booking.startTime), 'MMM d, yyyy h:mm a')}
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

          {/* Recent Activity */}
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
                  <Box key={booking._id} sx={{ mb: 2, pb: 2, borderBottom: '1px solid #eee' }}>
                    <Typography variant="body1" fontWeight="medium">
                      {booking.client.firstName} {booking.client.lastName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {format(new Date(booking.createdAt), 'MMM d, yyyy')} - ${booking.amount}
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

      {/* Bookings Tab */}
      <TabPanel value={tabValue} index={1}>
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
                {allBookings.map((booking: any) => (
                  <TableRow key={booking._id}>
                    <TableCell>
                      {booking.client.firstName} {booking.client.lastName}
                    </TableCell>
                    <TableCell>
                      {format(new Date(booking.startTime), 'MMM d, yyyy h:mm a')}
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
                      <Button size="small">View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </TabPanel>

      {/* Clients Tab */}
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
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allClients.map((client: any) => (
                  <TableRow key={client._id}>
                    <TableCell>
                      {client.firstName} {client.lastName}
                    </TableCell>
                    <TableCell>{client.email}</TableCell>
                    <TableCell>{client.phone || '-'}</TableCell>
                    <TableCell>{client.bookingCount || 0}</TableCell>
                    <TableCell>${client.totalSpent || 0}</TableCell>
                    <TableCell>
                      <Button size="small">View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </TabPanel>

      {/* Analytics Tab */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Revenue Analytics
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Analytics charts would be implemented here with a charting library like Chart.js or Recharts
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>
    </Container>
  );
};

export default AdminDashboard;