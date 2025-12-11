import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Card,
  CardContent,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQuery } from "react-query";
import { useAuth } from "../contexts/AuthContext";
import { authApi } from "../services/api";
import { toast } from "react-toastify";
import { useWithSlug } from "../hooks/useTenantSlug";

const validationSchema = yup.object().shape({
  firstName: yup
    .string()
    .required("First name is required")
    .min(2, "First name must be at least 2 characters"),
  lastName: yup
    .string()
    .required("Last name is required")
    .min(2, "Last name must be at least 2 characters"),
  email: yup
    .string()
    .email("Invalid email address")
    .required("Email is required"),
  phone: yup.string().optional(),
  timezone: yup.string().optional(),
});

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  timezone?: string;
}

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const withSlug = useWithSlug();
  const { user } = useAuth();
  const [submitError, setSubmitError] = useState("");

  const { data: profileData, isLoading: isLoadingProfile } = useQuery(
    ["profile", user?.id],
    () => authApi.getProfile(),
    {
      enabled: !!user?.id,
    }
  );

  const updateMutation = useMutation(
    (data: ProfileFormData) =>
      authApi.updateProfile({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        timezone: data.timezone,
      }),
    {
      onSuccess: () => {
        toast.success("Profile updated successfully");
        setSubmitError("");
      },
      onError: (error: any) => {
        const message =
          error.response?.data?.error || "Failed to update profile";
        setSubmitError(message);
        toast.error(message);
      },
    }
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProfileFormData>({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      firstName: profileData?.data?.user?.firstName || "",
      lastName: profileData?.data?.user?.lastName || "",
      email: profileData?.data?.user?.email || "",
      phone: profileData?.data?.user?.phone || "",
      timezone: profileData?.data?.user?.timezone || "UTC",
    },
  });

  // Update form when profile data loads
  React.useEffect(() => {
    if (profileData?.data?.user) {
      reset({
        firstName: profileData.data.user.firstName,
        lastName: profileData.data.user.lastName,
        email: profileData.data.user.email,
        phone: profileData.data.user.phone || "",
        timezone: profileData.data.user.timezone || "UTC",
      });
    }
  }, [profileData, reset]);

  const onSubmit = async (data: ProfileFormData) => {
    setSubmitError("");
    updateMutation.mutate(data);
  };

  if (isLoadingProfile) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "400px",
          }}
        >
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  const profile = profileData?.data?.user;

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h3" component="h1">
          My Profile
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate(withSlug("/my-bookings"))}
        >
          Back to Bookings
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Profile Card */}
        <Grid item xs={12} md={4}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Account Information
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Email:</strong>
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {profile?.email}
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  gutterBottom
                  sx={{ mt: 2 }}
                >
                  <strong>Role:</strong>
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {profile?.role === "admin" ? "Administrator" : "Client"}
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  gutterBottom
                  sx={{ mt: 2 }}
                >
                  <strong>Member Since:</strong>
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {profile && new Date(profile.createdAt).toLocaleDateString()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Edit Form */}
        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
              Edit Profile
            </Typography>

            {submitError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {submitError}
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="firstName"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="First Name"
                        fullWidth
                        error={!!errors.firstName}
                        helperText={errors.firstName?.message}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Controller
                    name="lastName"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Last Name"
                        fullWidth
                        error={!!errors.lastName}
                        helperText={errors.lastName?.message}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Controller
                    name="email"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Email"
                        fullWidth
                        type="email"
                        error={!!errors.email}
                        helperText={errors.email?.message}
                        disabled
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Controller
                    name="phone"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Phone"
                        fullWidth
                        placeholder="+1 (555) 123-4567"
                        error={!!errors.phone}
                        helperText={errors.phone?.message}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Controller
                    name="timezone"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Timezone"
                        fullWidth
                        placeholder="e.g., UTC, EST, PST"
                        error={!!errors.timezone}
                        helperText={errors.timezone?.message}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box
                    sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}
                  >
                    <Button
                      variant="outlined"
                      onClick={() => navigate(withSlug("/my-bookings"))}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={updateMutation.isLoading}
                    >
                      {updateMutation.isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </form>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Profile;
