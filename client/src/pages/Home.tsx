import React from 'react';
import {
  Container,
  Typography,
  Button,
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { CalendarToday, Payment, VideoCall, AdminPanelSettings } from '@mui/icons-material';

const Home: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Hero Section */}
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
          backgroundColor: 'primary.main',
          color: 'white',
          borderRadius: 2,
          mb: 6,
        }}
      >
        <Typography variant="h2" component="h1" gutterBottom>
          Professional Meeting Scheduler
        </Typography>
        <Typography variant="h5" component="p" gutterBottom>
          Book your consultation with ease. Secure payments, automatic calendar invites,
          and Google Meet integration.
        </Typography>
        <Box sx={{ mt: 4 }}>
          <Button
            variant="contained"
            size="large"
            component={Link}
            to="/book"
            sx={{
              backgroundColor: 'white',
              color: 'primary.main',
              '&:hover': {
                backgroundColor: 'grey.100',
              },
              mr: 2,
            }}
          >
            Book a Meeting
          </Button>
          <Button
            variant="outlined"
            size="large"
            component={Link}
            to="/register"
            sx={{
              borderColor: 'white',
              color: 'white',
              '&:hover': {
                borderColor: 'white',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            Create Account
          </Button>
        </Box>
      </Box>

      {/* Features Section */}
      <Typography variant="h3" component="h2" textAlign="center" gutterBottom>
        How It Works
      </Typography>
      <Typography 
        variant="h6" 
        component="p" 
        textAlign="center" 
        color="text.secondary" 
        sx={{ mb: 6 }}
      >
        Simple, secure, and professional meeting scheduling
      </Typography>

      <Grid container spacing={4} sx={{ mb: 6 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ textAlign: 'center', height: '100%' }}>
            <CardContent>
              <CalendarToday 
                sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} 
              />
              <Typography variant="h5" component="h3" gutterBottom>
                Choose Time
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Select from available time slots that work with your schedule.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ textAlign: 'center', height: '100%' }}>
            <CardContent>
              <Payment 
                sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} 
              />
              <Typography variant="h5" component="h3" gutterBottom>
                Secure Payment
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Complete your booking with secure Stripe payment processing.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ textAlign: 'center', height: '100%' }}>
            <CardContent>
              <VideoCall 
                sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} 
              />
              <Typography variant="h5" component="h3" gutterBottom>
                Meet Online
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Receive Google Meet link and calendar invite automatically.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ textAlign: 'center', height: '100%' }}>
            <CardContent>
              <AdminPanelSettings 
                sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} 
              />
              <Typography variant="h5" component="h3" gutterBottom>
                Easy Management
              </Typography>
              <Typography variant="body2" color="text.secondary">
                View and manage all your bookings from your dashboard.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Pricing Section */}
      <Box sx={{ textAlign: 'center', py: 6, backgroundColor: 'grey.50', borderRadius: 2 }}>
        <Typography variant="h3" component="h2" gutterBottom>
          Consultation Fee
        </Typography>
        <Typography variant="h2" component="p" color="primary.main" gutterBottom>
          $50
        </Typography>
        <Typography variant="h6" component="p" color="text.secondary" gutterBottom>
          Per 60-minute session
        </Typography>
        <Typography variant="body1" component="p" sx={{ mb: 4 }}>
          Includes Google Meet link, calendar invite, and email confirmations
        </Typography>
        <Button
          variant="contained"
          size="large"
          component={Link}
          to="/book"
        >
          Schedule Your Meeting
        </Button>
      </Box>
    </Container>
  );
};

export default Home;