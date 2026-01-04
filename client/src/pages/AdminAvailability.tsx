import React, { useState } from "react";
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
} from "@mui/material";
import { Edit, Delete, Add } from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { availabilityApi } from "../services/api";
import { toast } from "react-toastify";

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const validationSchema = yup.object().shape({
  dayOfWeek: yup.number().required("Day of week is required").min(0).max(6),
  startTime: yup.string().required("Start time is required"),
  endTime: yup.string().required("End time is required"),
  breakStartTime: yup.string().optional(),
  breakEndTime: yup.string().optional(),
});

const AdminAvailability: React.FC = () => {
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(0);

  const { data: availabilityData, isLoading } = useQuery(["availability"], () =>
    availabilityApi.getAvailability()
  );

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<any>({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      dayOfWeek: 0,
      startTime: "09:00",
      endTime: "17:00",
      breakStartTime: "12:00",
      breakEndTime: "13:00",
    },
  });

  const createMutation = useMutation(
    (data: any) => availabilityApi.createAvailability(data),
    {
      onSuccess: () => {
        toast.success("Availability window created");
        queryClient.invalidateQueries(["availability"]);
        handleCloseDialog();
      },
      onError: (error: any) => {
        toast.error(
          error.response?.data?.error || "Failed to create availability"
        );
      },
    }
  );

  const updateMutation = useMutation(
    (data: any) => availabilityApi.updateAvailability(editingId || "", data),
    {
      onSuccess: () => {
        toast.success("Availability window updated");
        queryClient.invalidateQueries(["availability"]);
        handleCloseDialog();
      },
      onError: (error: any) => {
        toast.error(
          error.response?.data?.error || "Failed to update availability"
        );
      },
    }
  );

  const deleteMutation = useMutation(
    (id: string) => availabilityApi.deleteAvailability(id),
    {
      onSuccess: () => {
        toast.success("Availability window deleted");
        queryClient.invalidateQueries(["availability"]);
      },
      onError: (error: any) => {
        toast.error(
          error.response?.data?.error || "Failed to delete availability"
        );
      },
    }
  );

  const handleOpenDialog = (item?: any) => {
    if (item) {
      setEditingId(item._id);
      reset({
        dayOfWeek: item.dayOfWeek,
        startTime: item.startTime,
        endTime: item.endTime,
        breakStartTime: item.breakStartTime,
        breakEndTime: item.breakEndTime,
        specificDate: item.specificDate,
      });
    } else {
      setEditingId(null);
      reset({
        dayOfWeek: selectedDay,
        startTime: "09:00",
        endTime: "17:00",
        breakStartTime: "12:00",
        breakEndTime: "13:00",
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingId(null);
    reset();
  };

  const onSubmit = async (data: any) => {
    const formattedData = {
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      ...(data.breakStartTime && { breakStartTime: data.breakStartTime }),
      ...(data.breakEndTime && { breakEndTime: data.breakEndTime }),
      ...(data.specificDate && { specificDate: data.specificDate }),
    };

    if (editingId) {
      updateMutation.mutate(formattedData);
    } else {
      createMutation.mutate(formattedData);
    }
  };

  // The server returns availability grouped by day (object) or an array in older shapes.
  const rawAvailability = availabilityData?.data?.availability;

  // Normalize to a flat array of availability slots for client-side processing
  let availabilities: any[] = [];
  if (Array.isArray(rawAvailability)) {
    availabilities = rawAvailability;
  } else if (rawAvailability && typeof rawAvailability === "object") {
    // values may be arrays (for each day key) or nested objects; flatten them
    try {
      availabilities = Object.values(rawAvailability).flat();
    } catch (e) {
      // Fallback: collect arrays manually
      availabilities = [];
      Object.keys(rawAvailability).forEach((k) => {
        const v = (rawAvailability as any)[k];
        if (Array.isArray(v)) availabilities.push(...v);
      });
    }
  } else {
    availabilities = [];
  }

  // Group by day of week for display
  const groupedByDay = DAYS_OF_WEEK.map((day, index) =>
    availabilities.filter((a: any) => a.dayOfWeek === index && !a.specificDate)
  );

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
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

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h3" component="h1">
          Manage Availability
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Add Time Slot
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Instructions:</strong> Set your available meeting times for
          each day of the week. You can add breaks (lunch, etc.) and also set
          specific date overrides if needed.
        </Typography>
      </Alert>

      {/* Availability by Day */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {DAYS_OF_WEEK.map((day, index) => (
          <Grid item xs={12} sm={6} md={4} key={day}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                {day}
              </Typography>
              {groupedByDay[index].length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  Not available
                </Typography>
              ) : (
                <Box sx={{ mb: 2 }}>
                  {groupedByDay[index].map((slot: any) => (
                    <Box
                      key={slot._id}
                      sx={{
                        mb: 1,
                        pb: 1,
                        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      <Typography variant="body2">
                        <strong>
                          {slot.startTime} - {slot.endTime}
                        </strong>
                      </Typography>
                      {slot.breakStartTime && (
                        <Typography
                          variant="caption"
                          display="block"
                          color="text.secondary"
                        >
                          Break: {slot.breakStartTime} - {slot.breakEndTime}
                        </Typography>
                      )}
                      <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedDay(index);
                              handleOpenDialog(slot);
                            }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => deleteMutation.mutate(slot._id)}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
              <Button
                size="small"
                variant="outlined"
                startIcon={<Add />}
                onClick={() => {
                  setSelectedDay(index);
                  handleOpenDialog();
                }}
                fullWidth
              >
                Add for {day}
              </Button>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Specific Date Overrides */}
      {availabilities.filter((a: any) => a.specificDate).length > 0 && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Specific Date Overrides
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Time</TableCell>
                  <TableCell>Break</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {availabilities
                  .filter((a: any) => a.specificDate)
                  .map((slot: any) => (
                    <TableRow key={slot._id}>
                      <TableCell>
                        {new Date(slot.specificDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {slot.startTime} - {slot.endTime}
                      </TableCell>
                      <TableCell>
                        {slot.breakStartTime
                          ? `${slot.breakStartTime} - ${slot.breakEndTime}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(slot)}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => deleteMutation.mutate(slot._id)}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Dialog for Add/Edit */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingId ? "Edit Availability" : "Add New Availability"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller
                  name="dayOfWeek"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      label="Day of Week"
                      fullWidth
                      SelectProps={{
                        native: true,
                      }}
                      error={!!errors.dayOfWeek}
                      helperText={(errors.dayOfWeek?.message as string) || ""}
                    >
                      {DAYS_OF_WEEK.map((day, index) => (
                        <option key={index} value={index}>
                          {day}
                        </option>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="startTime"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type="time"
                      label="Start Time"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.startTime}
                      helperText={(errors.startTime?.message as string) || ""}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="endTime"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type="time"
                      label="End Time"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.endTime}
                      helperText={(errors.endTime?.message as string) || ""}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="breakStartTime"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type="time"
                      label="Break Start (Optional)"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.breakStartTime}
                      helperText={
                        (errors.breakStartTime?.message as string) || ""
                      }
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="breakEndTime"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type="time"
                      label="Break End (Optional)"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.breakEndTime}
                      helperText={
                        (errors.breakEndTime?.message as string) || ""
                      }
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            variant="contained"
            disabled={createMutation.isLoading || updateMutation.isLoading}
          >
            {editingId ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminAvailability;
