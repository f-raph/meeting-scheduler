import React, { useState, useEffect } from "react";
import {
  Container,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  Button,
  Card,
  CardContent,
  CardActions,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  TextField,
  Divider,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  CalendarMonth as CalendarIcon,
  AccountBalanceWallet as WalletIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Link as LinkIcon,
  Category as CategoryIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  OpenInNew as OpenInNewIcon,
  InfoOutlined as InfoIcon,
  Schedule as ScheduleIcon,
} from "@mui/icons-material";
import {
  googleCalendarApi,
  adminApi,
  meetingTypesApi,
  authApi,
  availabilityApi,
} from "../services/api";
import { toast } from "react-toastify";
import { useForm, Controller } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { useQueryClient, useQuery, useMutation } from "react-query";

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
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const availabilityValidationSchema = yup.object().shape({
  dayOfWeek: yup.number().required("Day of week is required").min(0).max(6),
  startTime: yup.string().required("Start time is required"),
  endTime: yup.string().required("End time is required"),
  breakStartTime: yup.string().optional(),
  breakEndTime: yup.string().optional(),
});

const AdminSettings: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  // Admin profile state (for booking URL)
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [bookingUrl, setBookingUrl] = useState("");

  // Google Calendar state
  const [calendarStatus, setCalendarStatus] = useState<any>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarSuccess, setCalendarSuccess] = useState<string | null>(null);

  // Subaccount state (Paystack)
  const [subaccountStatus, setSubaccountStatus] = useState<any>(null);
  const [subaccountLoading, setSubaccountLoading] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [banks, setBanks] = useState<any[]>([]);
  const [resolvingAccount, setResolvingAccount] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [paystackInfoOpen, setPaystackInfoOpen] = useState(false);
  const [availabilityInfoOpen, setAvailabilityInfoOpen] = useState(false);
  const [calendarInfoOpen, setCalendarInfoOpen] = useState(false);

  // Meeting types state
  const [meetingTypes, setMeetingTypes] = useState<any[]>([]);
  const [meetingTypesLoading, setMeetingTypesLoading] = useState(false);
  const [editingMeetingType, setEditingMeetingType] = useState<any>(null);
  const [showMeetingTypeForm, setShowMeetingTypeForm] = useState(false);
  const [meetingTypeForm, setMeetingTypeForm] = useState({
    name: "",
    description: "",
    price: 0,
    currency: "GHS",
    duration: 60,
    color: "#19c1ff",
    isActive: true,
  });

  // Availability state
  const queryClient = useQueryClient();
  const [openAvailabilityDialog, setOpenAvailabilityDialog] = useState(false);
  const [editingAvailabilityId, setEditingAvailabilityId] = useState<
    string | null
  >(null);
  const [selectedDay, setSelectedDay] = useState<number>(0);

  const { data: availabilityData, isLoading: availabilityLoading } = useQuery(
    ["availability"],
    () => availabilityApi.getAvailability()
  );

  const {
    control: availabilityControl,
    handleSubmit: handleAvailabilitySubmit,
    reset: resetAvailability,
    formState: { errors: availabilityErrors },
  } = useForm<any>({
    resolver: yupResolver(availabilityValidationSchema),
    defaultValues: {
      dayOfWeek: 0,
      startTime: "09:00",
      endTime: "17:00",
      breakStartTime: "12:00",
      breakEndTime: "13:00",
    },
  });

  useEffect(() => {
    fetchAdminProfile();
    fetchCalendarStatus();
    fetchSubaccountStatus();
    fetchBanks();
    fetchMeetingTypes();
  }, []);

  const fetchAdminProfile = async () => {
    try {
      const response = await authApi.getProfile();
      setAdminProfile(response.data.user);

      // Build booking URL from slug
      if (response.data.user?.slug) {
        const baseUrl = window.location.origin;
        setBookingUrl(`${baseUrl}/${response.data.user.slug}/book`);
      }
    } catch (error) {
      console.error("Failed to fetch admin profile:", error);
    }
  };

  const handleCopyBookingUrl = () => {
    navigator.clipboard.writeText(bookingUrl);
    toast.success("Booking URL copied to clipboard!");
  };

  const handleOpenBookingUrl = () => {
    window.open(bookingUrl, "_blank");
  };

  // Auto-resolve account number when both bank and account number are entered
  useEffect(() => {
    // Trigger resolution when account number is 13 digits (Ghana bank format)
    if (bankCode && accountNumber && accountNumber.length >= 13) {
      resolveAccountNumber();
    } else {
      setAccountName("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankCode, accountNumber]);

  const fetchCalendarStatus = async () => {
    try {
      setCalendarLoading(true);
      const response = await googleCalendarApi.getStatus();
      setCalendarStatus(response.data);
    } catch (error: any) {
      console.error("Failed to fetch calendar status:", error);
      setCalendarStatus({ connected: false });
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleConnectCalendar = async () => {
    try {
      setCalendarLoading(true);
      setCalendarError(null);

      const response = await googleCalendarApi.connect();
      const { authUrl } = response.data;

      // Open Google OAuth in popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        authUrl,
        "Google Calendar Authorization",
        `width=${width},height=${height},top=${top},left=${left}`
      );

      // Listen for OAuth callback
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === "GOOGLE_OAUTH_SUCCESS") {
          const { code } = event.data;

          try {
            await googleCalendarApi.handleCallback(code);
            setCalendarSuccess("Google Calendar connected successfully!");
            await fetchCalendarStatus();
            popup?.close();
          } catch (error: any) {
            setCalendarError(
              error.response?.data?.error || "Failed to complete authorization"
            );
          }
        } else if (event.data.type === "GOOGLE_OAUTH_ERROR") {
          setCalendarError("Authorization was cancelled or failed");
          popup?.close();
        }
      };

      window.addEventListener("message", handleMessage);

      // Check if popup was closed
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener("message", handleMessage);
          setCalendarLoading(false);
        }
      }, 1000);
    } catch (error: any) {
      setCalendarError(
        error.response?.data?.error || "Failed to initiate authorization"
      );
      setCalendarLoading(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    if (
      !window.confirm("Are you sure you want to disconnect Google Calendar?")
    ) {
      return;
    }

    try {
      setCalendarLoading(true);
      setCalendarError(null);

      await googleCalendarApi.disconnect();
      setCalendarSuccess("Google Calendar disconnected successfully");
      await fetchCalendarStatus();
    } catch (error: any) {
      setCalendarError(error.response?.data?.error || "Failed to disconnect");
    } finally {
      setCalendarLoading(false);
    }
  };

  const fetchSubaccountStatus = async () => {
    try {
      setSubaccountLoading(true);
      const response = await adminApi.getSubaccountStatus();
      setSubaccountStatus(response.data);
    } catch (error: any) {
      console.error("Failed to fetch subaccount status:", error);
      setSubaccountStatus({ hasSubaccount: false });
    } finally {
      setSubaccountLoading(false);
    }
  };

  const fetchBanks = async () => {
    try {
      const response = await adminApi.getBanks();
      setBanks(response.data.banks || []);
    } catch (error) {
      console.error("Failed to fetch banks:", error);
      // Fallback to common Ghanaian banks
      setBanks([
        { name: "Absa Bank Ghana Limited", code: "GH010100" },
        { name: "Access Bank Ghana Plc", code: "GH130100" },
        { name: "ADB Bank Limited", code: "GH080100" },
        { name: "Bank of Africa Ghana Limited", code: "GH210100" },
        { name: "CalBank Limited", code: "GH090100" },
        { name: "Consolidated Bank Ghana Limited", code: "GH140100" },
        { name: "Ecobank Ghana Limited", code: "GH040100" },
        { name: "FBNBank Ghana Limited", code: "GH200100" },
        { name: "Fidelity Bank Ghana Limited", code: "GH240100" },
        { name: "First Atlantic Bank Limited", code: "GH170100" },
        { name: "First National Bank Ghana Limited", code: "GH330100" },
        { name: "GCB Bank Limited", code: "GH020100" },
        { name: "Guaranty Trust Bank Ghana Limited", code: "GH230100" },
        { name: "National Investment Bank Limited", code: "GH050100" },
        { name: "OmniBSIC Bank Ghana Limited", code: "GH300100" },
        { name: "Prudential Bank Limited", code: "GH180100" },
        { name: "Republic Bank Ghana Limited", code: "GH110100" },
        { name: "Société Générale Ghana Limited", code: "GH190100" },
        { name: "Stanbic Bank Ghana Limited", code: "GH100100" },
        { name: "Standard Chartered Bank Ghana Limited", code: "GH060100" },
        { name: "United Bank for Africa Ghana Limited", code: "GH030100" },
        { name: "Zenith Bank Ghana Limited", code: "GH070100" },
      ]);
    }
  };

  const resolveAccountNumber = async () => {
    // Ghana bank account numbers are 13 digits
    if (!bankCode || !accountNumber || accountNumber.length < 13) {
      return;
    }

    try {
      setResolvingAccount(true);
      const response = await adminApi.resolveAccount(accountNumber, bankCode);
      setAccountName(response.data.accountName);
    } catch (error: any) {
      console.error("Failed to resolve account:", error);
      setAccountName("");
      toast.error(
        error.response?.data?.error ||
          "Could not verify account number. Please check your bank and account details."
      );
    } finally {
      setResolvingAccount(false);
    }
  };

  const handleSetupSubaccountClick = () => {
    if (!businessName || !bankCode || !accountNumber) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!accountName) {
      toast.error(
        "Please wait for account verification or check your account details"
      );
      return;
    }

    // Show confirmation dialog
    setConfirmDialogOpen(true);
  };

  const handleConfirmSetupSubaccount = async () => {
    setConfirmDialogOpen(false);

    // Get selected bank name for display
    const selectedBank = banks.find((b: any) => b.code === bankCode);
    const selectedBankName = selectedBank?.name || "";

    try {
      setSubaccountLoading(true);
      const response = await adminApi.setupSubaccount({
        businessName,
        settlementBank: bankCode,
        bankName: selectedBankName,
        accountNumber,
        accountName: accountName || undefined,
        percentageCharge: 100, // Admin gets 100% (platform fee handled separately if configured)
      });

      // Check if subaccount already existed
      if (response.data.alreadyExists) {
        toast.info("Payment setup was already complete.");
      } else {
        toast.success("Payment setup complete! You can now receive payments.");
      }

      await fetchSubaccountStatus();
      setBusinessName("");
      setBankCode("");
      setAccountNumber("");
      setAccountName("");
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error || "Failed to setup payment account";
      toast.error(errorMsg);

      // Show additional help for common errors
      if (errorMsg.includes("account number")) {
        toast.info(
          "Tip: Make sure your account number is correct and matches your bank records.",
          { autoClose: 8000 }
        );
      }
    } finally {
      setSubaccountLoading(false);
    }
  };

  const handleResetPaymentClick = () => {
    setResetPassword("");
    setResetError("");
    setResetDialogOpen(true);
  };

  const handleConfirmResetPayment = async () => {
    if (!resetPassword) {
      setResetError("Please enter your password");
      return;
    }

    try {
      setSubaccountLoading(true);
      setResetError("");
      await adminApi.resetPaymentSetup(resetPassword);
      toast.success(
        "Payment setup has been reset. You can now set up a new payment account."
      );
      setResetDialogOpen(false);
      setResetPassword("");
      await fetchSubaccountStatus();
      // Clear form fields
      setBusinessName("");
      setBankCode("");
      setAccountNumber("");
      setAccountName("");
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error || "Failed to reset payment setup";
      setResetError(errorMsg);
    } finally {
      setSubaccountLoading(false);
    }
  };

  const fetchMeetingTypes = async () => {
    try {
      setMeetingTypesLoading(true);
      const response = await meetingTypesApi.getAllIncludingInactive();
      setMeetingTypes(response.data.meetingTypes || []);
    } catch (error: any) {
      console.error("Failed to fetch meeting types:", error);
    } finally {
      setMeetingTypesLoading(false);
    }
  };

  const handleCreateMeetingType = async () => {
    try {
      setMeetingTypesLoading(true);
      await meetingTypesApi.create(meetingTypeForm);
      toast.success("Meeting type created successfully");
      setShowMeetingTypeForm(false);
      setMeetingTypeForm({
        name: "",
        description: "",
        price: 0,
        currency: "GHS",
        duration: 60,
        color: "#19c1ff",
        isActive: true,
      });
      await fetchMeetingTypes();
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || "Failed to create meeting type"
      );
    } finally {
      setMeetingTypesLoading(false);
    }
  };

  const handleUpdateMeetingType = async (id: string, updates: any) => {
    try {
      setMeetingTypesLoading(true);
      await meetingTypesApi.update(id, updates);
      toast.success("Meeting type updated successfully");
      setEditingMeetingType(null);
      setShowMeetingTypeForm(false);
      setMeetingTypeForm({
        name: "",
        description: "",
        price: 0,
        currency: "GHS",
        duration: 60,
        color: "#19c1ff",
        isActive: true,
      });
      await fetchMeetingTypes();
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || "Failed to update meeting type"
      );
    } finally {
      setMeetingTypesLoading(false);
    }
  };

  const handleDeleteMeetingType = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this meeting type?")) {
      return;
    }
    try {
      setMeetingTypesLoading(true);
      await meetingTypesApi.delete(id);
      toast.success("Meeting type deleted successfully");
      await fetchMeetingTypes();
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || "Failed to delete meeting type"
      );
    } finally {
      setMeetingTypesLoading(false);
    }
  };

  // Availability handlers
  const createAvailabilityMutation = useMutation(
    (data: any) => availabilityApi.createAvailability(data),
    {
      onSuccess: () => {
        toast.success("Availability window created");
        queryClient.invalidateQueries(["availability"]);
        handleCloseAvailabilityDialog();
      },
      onError: (error: any) => {
        toast.error(
          error.response?.data?.error || "Failed to create availability"
        );
      },
    }
  );

  const updateAvailabilityMutation = useMutation(
    (data: any) =>
      availabilityApi.updateAvailability(editingAvailabilityId || "", data),
    {
      onSuccess: () => {
        toast.success("Availability window updated");
        queryClient.invalidateQueries(["availability"]);
        handleCloseAvailabilityDialog();
      },
      onError: (error: any) => {
        toast.error(
          error.response?.data?.error || "Failed to update availability"
        );
      },
    }
  );

  const deleteAvailabilityMutation = useMutation(
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

  const handleOpenAvailabilityDialog = (item?: any) => {
    if (item) {
      setEditingAvailabilityId(item._id);
      resetAvailability({
        dayOfWeek: item.dayOfWeek,
        startTime: item.startTime,
        endTime: item.endTime,
        breakStartTime: item.breakStartTime,
        breakEndTime: item.breakEndTime,
        specificDate: item.specificDate,
      });
    } else {
      setEditingAvailabilityId(null);
      resetAvailability({
        dayOfWeek: selectedDay,
        startTime: "09:00",
        endTime: "17:00",
        breakStartTime: "12:00",
        breakEndTime: "13:00",
      });
    }
    setOpenAvailabilityDialog(true);
  };

  const handleCloseAvailabilityDialog = () => {
    setOpenAvailabilityDialog(false);
    setEditingAvailabilityId(null);
    resetAvailability();
  };

  const onAvailabilitySubmit = async (data: any) => {
    const formattedData = {
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      ...(data.breakStartTime && { breakStartTime: data.breakStartTime }),
      ...(data.breakEndTime && { breakEndTime: data.breakEndTime }),
      ...(data.specificDate && { specificDate: data.specificDate }),
    };

    if (editingAvailabilityId) {
      updateAvailabilityMutation.mutate(formattedData);
    } else {
      createAvailabilityMutation.mutate(formattedData);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Account Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage your profile, integrations, and preferences
      </Typography>

      {/* Booking URL Section */}
      {bookingUrl && (
        <Card
          sx={{
            mb: 3,
            bgcolor: "rgba(25, 193, 255, 0.08)",
            border: "1px solid",
            borderColor: "primary.main",
          }}
        >
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
              <LinkIcon sx={{ fontSize: 32, mr: 2, color: "primary.main" }} />
              <Box>
                <Typography variant="h6" color="primary.main">
                  Your Booking URL
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Share this link with clients so they can book your services
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <TextField
                fullWidth
                value={bookingUrl}
                InputProps={{
                  readOnly: true,
                  sx: {
                    fontFamily: "monospace",
                  },
                }}
                size="small"
              />
              <Tooltip title="Copy URL">
                <IconButton
                  onClick={handleCopyBookingUrl}
                  sx={{
                    bgcolor: "primary.main",
                    color: "white",
                    "&:hover": { bgcolor: "primary.dark" },
                  }}
                >
                  <CopyIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Open in new tab">
                <IconButton
                  onClick={handleOpenBookingUrl}
                  sx={{
                    bgcolor: "primary.main",
                    color: "white",
                    "&:hover": { bgcolor: "primary.dark" },
                  }}
                >
                  <OpenInNewIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </CardContent>
        </Card>
      )}

      <Paper sx={{ width: "100%" }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="settings tabs"
          sx={{ borderBottom: 1, borderColor: "divider" }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            icon={<ScheduleIcon />}
            label="Availability"
            iconPosition="start"
          />
          <Tab
            icon={<CalendarIcon />}
            label="Google Calendar"
            iconPosition="start"
          />
          <Tab
            icon={<CategoryIcon />}
            label="Meeting Types"
            iconPosition="start"
          />
          <Tab
            icon={<WalletIcon />}
            label="Payment Setup"
            iconPosition="start"
          />
        </Tabs>

        {/* Availability Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="h6">Manage Your Availability</Typography>
            <Tooltip title="How it works">
              <IconButton
                size="small"
                onClick={() => setAvailabilityInfoOpen(true)}
                sx={{ color: "primary.main" }}
              >
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {availabilityLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Availability by Day */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                {DAYS_OF_WEEK.map((day, index) => {
                  const rawAvailability = availabilityData?.data?.availability;
                  let availabilities: any[] = [];
                  if (Array.isArray(rawAvailability)) {
                    availabilities = rawAvailability;
                  } else if (
                    rawAvailability &&
                    typeof rawAvailability === "object"
                  ) {
                    try {
                      availabilities = Object.values(rawAvailability).flat();
                    } catch (e) {
                      availabilities = [];
                      Object.keys(rawAvailability).forEach((k) => {
                        const v = (rawAvailability as any)[k];
                        if (Array.isArray(v)) availabilities.push(...v);
                      });
                    }
                  }

                  const daySlots = availabilities.filter(
                    (a: any) => a.dayOfWeek === index && !a.specificDate
                  );

                  return (
                    <Grid item xs={12} sm={6} md={4} key={day}>
                      <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                          {day}
                        </Typography>
                        {daySlots.length === 0 ? (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 2 }}
                          >
                            Not available
                          </Typography>
                        ) : (
                          <Box sx={{ mb: 2 }}>
                            {daySlots.map((slot: any) => (
                              <Box
                                key={slot._id}
                                sx={{
                                  mb: 1,
                                  pb: 1,
                                  borderBottom:
                                    "1px solid rgba(255, 255, 255, 0.08)",
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
                                    Break: {slot.breakStartTime} -{" "}
                                    {slot.breakEndTime}
                                  </Typography>
                                )}
                                <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
                                  <Tooltip title="Edit">
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        setSelectedDay(index);
                                        handleOpenAvailabilityDialog(slot);
                                      }}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() =>
                                        deleteAvailabilityMutation.mutate(
                                          slot._id
                                        )
                                      }
                                    >
                                      <DeleteIcon fontSize="small" />
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
                          startIcon={<AddIcon />}
                          onClick={() => {
                            setSelectedDay(index);
                            handleOpenAvailabilityDialog();
                          }}
                          fullWidth
                        >
                          Add for {day}
                        </Button>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </>
          )}

          {/* Availability Dialog */}
          <Dialog
            open={openAvailabilityDialog}
            onClose={handleCloseAvailabilityDialog}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              {editingAvailabilityId
                ? "Edit Availability"
                : "Add New Availability"}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Controller
                      name="dayOfWeek"
                      control={availabilityControl}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          select
                          label="Day of Week"
                          fullWidth
                          SelectProps={{
                            native: true,
                          }}
                          error={!!availabilityErrors.dayOfWeek}
                          helperText={
                            (availabilityErrors.dayOfWeek?.message as string) ||
                            ""
                          }
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
                      control={availabilityControl}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          type="time"
                          label="Start Time"
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                          error={!!availabilityErrors.startTime}
                          helperText={
                            (availabilityErrors.startTime?.message as string) ||
                            ""
                          }
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="endTime"
                      control={availabilityControl}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          type="time"
                          label="End Time"
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                          error={!!availabilityErrors.endTime}
                          helperText={
                            (availabilityErrors.endTime?.message as string) ||
                            ""
                          }
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="breakStartTime"
                      control={availabilityControl}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          type="time"
                          label="Break Start (Optional)"
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                          error={!!availabilityErrors.breakStartTime}
                          helperText={
                            (availabilityErrors.breakStartTime
                              ?.message as string) || ""
                          }
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="breakEndTime"
                      control={availabilityControl}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          type="time"
                          label="Break End (Optional)"
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                          error={!!availabilityErrors.breakEndTime}
                          helperText={
                            (availabilityErrors.breakEndTime
                              ?.message as string) || ""
                          }
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseAvailabilityDialog}>Cancel</Button>
              <Button
                onClick={handleAvailabilitySubmit(onAvailabilitySubmit)}
                variant="contained"
                disabled={
                  createAvailabilityMutation.isLoading ||
                  updateAvailabilityMutation.isLoading
                }
              >
                {editingAvailabilityId ? "Update" : "Create"}
              </Button>
            </DialogActions>
          </Dialog>
        </TabPanel>

        {/* Google Calendar Tab */}
        <TabPanel value={tabValue} index={1}>
          {calendarError && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              onClose={() => setCalendarError(null)}
            >
              {calendarError}
            </Alert>
          )}

          {calendarSuccess && (
            <Alert
              severity="success"
              sx={{ mb: 2 }}
              onClose={() => setCalendarSuccess(null)}
            >
              {calendarSuccess}
            </Alert>
          )}

          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <CalendarIcon
                  sx={{ fontSize: 40, mr: 2, color: "primary.main" }}
                />
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="h6">
                      Google Calendar Integration
                    </Typography>
                    <Tooltip title="How it works">
                      <IconButton
                        size="small"
                        onClick={() => setCalendarInfoOpen(true)}
                        sx={{ color: "primary.main" }}
                      >
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Connect your Google Calendar to sync availability and create
                    meetings
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              {calendarLoading && !calendarStatus ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Connection Status
                    </Typography>
                    <Chip
                      icon={
                        calendarStatus?.connected ? (
                          <CheckCircleIcon />
                        ) : (
                          <CancelIcon />
                        )
                      }
                      label={
                        calendarStatus?.connected
                          ? "Connected"
                          : "Not Connected"
                      }
                      color={calendarStatus?.connected ? "success" : "default"}
                      sx={{ mt: 1 }}
                    />
                  </Box>

                  {calendarStatus?.connected && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Calendar
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {calendarStatus.calendarId || "primary"}
                      </Typography>
                    </Box>
                  )}
                </>
              )}
            </CardContent>
            <CardActions>
              {calendarStatus?.connected ? (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleDisconnectCalendar}
                  disabled={calendarLoading}
                  startIcon={
                    calendarLoading ? (
                      <CircularProgress size={20} />
                    ) : (
                      <CancelIcon />
                    )
                  }
                >
                  {calendarLoading ? "Disconnecting..." : "Disconnect Calendar"}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleConnectCalendar}
                  disabled={calendarLoading}
                  startIcon={
                    calendarLoading ? (
                      <CircularProgress size={20} />
                    ) : (
                      <LinkIcon />
                    )
                  }
                >
                  {calendarLoading
                    ? "Connecting..."
                    : "Connect Google Calendar"}
                </Button>
              )}
            </CardActions>
          </Card>
        </TabPanel>

        {/* Meeting Types Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box
            sx={{
              mb: 3,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Box>
              <Typography variant="h6" gutterBottom>
                Meeting Types & Pricing
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Configure your meeting categories and their prices
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowMeetingTypeForm(true)}
            >
              Add Meeting Type
            </Button>
          </Box>

          {showMeetingTypeForm && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {editingMeetingType ? "Edit" : "New"} Meeting Type
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Name"
                      value={meetingTypeForm.name}
                      onChange={(e) =>
                        setMeetingTypeForm({
                          ...meetingTypeForm,
                          name: e.target.value,
                        })
                      }
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Duration (minutes)"
                      type="number"
                      value={meetingTypeForm.duration}
                      onChange={(e) =>
                        setMeetingTypeForm({
                          ...meetingTypeForm,
                          duration: parseInt(e.target.value),
                        })
                      }
                      inputProps={{ min: 15, max: 480 }}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Price"
                      type="number"
                      value={meetingTypeForm.price}
                      onChange={(e) =>
                        setMeetingTypeForm({
                          ...meetingTypeForm,
                          price: parseFloat(e.target.value),
                        })
                      }
                      inputProps={{ min: 0, step: 0.01 }}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Currency</InputLabel>
                      <Select
                        value={meetingTypeForm.currency}
                        onChange={(e) =>
                          setMeetingTypeForm({
                            ...meetingTypeForm,
                            currency: e.target.value,
                          })
                        }
                        label="Currency"
                      >
                        <MenuItem value="GHS">GHS (₵)</MenuItem>
                        <MenuItem value="USD">USD ($)</MenuItem>
                        <MenuItem value="EUR">EUR (€)</MenuItem>
                        <MenuItem value="GBP">GBP (£)</MenuItem>
                        <MenuItem value="NGN">NGN (₦)</MenuItem>
                        <MenuItem value="KES">KES (KSh)</MenuItem>
                        <MenuItem value="ZAR">ZAR (R)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Color"
                      type="color"
                      value={meetingTypeForm.color}
                      onChange={(e) =>
                        setMeetingTypeForm({
                          ...meetingTypeForm,
                          color: e.target.value,
                        })
                      }
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Description"
                      multiline
                      rows={3}
                      value={meetingTypeForm.description}
                      onChange={(e) =>
                        setMeetingTypeForm({
                          ...meetingTypeForm,
                          description: e.target.value,
                        })
                      }
                    />
                  </Grid>
                </Grid>
              </CardContent>
              <CardActions>
                <Button
                  onClick={() => {
                    setShowMeetingTypeForm(false);
                    setEditingMeetingType(null);
                    setMeetingTypeForm({
                      name: "",
                      description: "",
                      price: 0,
                      currency: "GHS",
                      duration: 60,
                      color: "#19c1ff",
                      isActive: true,
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    if (editingMeetingType) {
                      handleUpdateMeetingType(
                        editingMeetingType._id,
                        meetingTypeForm
                      );
                    } else {
                      handleCreateMeetingType();
                    }
                  }}
                  disabled={!meetingTypeForm.name || !meetingTypeForm.duration}
                >
                  {editingMeetingType ? "Update" : "Create"}
                </Button>
              </CardActions>
            </Card>
          )}

          {meetingTypesLoading && !meetingTypes.length ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : meetingTypes.length === 0 ? (
            <Alert severity="info">
              No meeting types configured. Click "Add Meeting Type" to create
              your first one.
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {meetingTypes.map((type) => (
                <Grid item xs={12} sm={6} md={4} key={type._id}>
                  <Card
                    sx={{
                      borderLeft: `4px solid ${type.color || "#19c1ff"}`,
                    }}
                  >
                    <CardContent>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          mb: 1,
                        }}
                      >
                        <Typography variant="h6">{type.name}</Typography>
                        <Chip
                          label={type.isActive ? "Active" : "Inactive"}
                          color={type.isActive ? "success" : "default"}
                          size="small"
                        />
                      </Box>
                      {type.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 1 }}
                        >
                          {type.description}
                        </Typography>
                      )}
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="body2">
                        <strong>Price:</strong> {type.currency || "GHS"}{" "}
                        {type.price.toLocaleString()}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Duration:</strong> {type.duration} minutes
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => {
                          setEditingMeetingType(type);
                          setMeetingTypeForm({
                            name: type.name,
                            description: type.description || "",
                            price: type.price,
                            currency: type.currency || "GHS",
                            duration: type.duration,
                            color: type.color,
                            isActive: type.isActive,
                          });
                          setShowMeetingTypeForm(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        color="secondary"
                        onClick={() =>
                          handleUpdateMeetingType(type._id, {
                            isActive: !type.isActive,
                          })
                        }
                      >
                        {type.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteMeetingType(type._id)}
                      >
                        Delete
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>

        {/* Payment Setup Tab (Paystack) */}
        <TabPanel value={tabValue} index={3}>
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 2,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <WalletIcon
                    sx={{ fontSize: 40, mr: 2, color: "primary.main" }}
                  />
                  <Box>
                    <Typography variant="h6">Paystack Payment Setup</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Receive payments directly to your bank account.
                    </Typography>
                  </Box>
                </Box>
                <Tooltip title="How it works">
                  <IconButton
                    onClick={() => setPaystackInfoOpen(true)}
                    sx={{ color: "text.secondary" }}
                  >
                    <InfoIcon />
                  </IconButton>
                </Tooltip>
              </Box>

              <Divider sx={{ my: 2 }} />

              {subaccountStatus?.hasSubaccount ? (
                <>
                  <Alert
                    severity="success"
                    icon={<CheckCircleIcon />}
                    sx={{ mb: 2 }}
                  >
                    Your payment account is configured! Payments from clients
                    will be sent directly to your bank account.
                  </Alert>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Business Name"
                        value={subaccountStatus.subaccount.businessName || ""}
                        disabled
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Bank"
                        value={subaccountStatus.subaccount.bankName || ""}
                        disabled
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Account Number"
                        value={subaccountStatus.subaccount.accountNumber || ""}
                        disabled
                      />
                    </Grid>
                  </Grid>
                </>
              ) : (
                <>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Business Name"
                        placeholder="Your business or personal name"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        required
                        helperText="This name will appear on payment receipts"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth required>
                        <InputLabel>Bank</InputLabel>
                        <Select
                          value={bankCode}
                          onChange={(e) => {
                            setBankCode(e.target.value);
                            setAccountName("");
                          }}
                          label="Bank"
                        >
                          {banks.map((bank) => (
                            <MenuItem key={bank.code} value={bank.code}>
                              {bank.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Account Number"
                        placeholder="0123456789012"
                        value={accountNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          if (value.length <= 13) {
                            setAccountNumber(value);
                          }
                        }}
                        required
                        inputProps={{ maxLength: 13 }}
                        helperText={
                          resolvingAccount
                            ? "Verifying account..."
                            : accountName || "Enter 13-digit account number"
                        }
                        InputProps={{
                          endAdornment: resolvingAccount ? (
                            <CircularProgress size={20} />
                          ) : accountName ? (
                            <CheckCircleIcon color="success" />
                          ) : null,
                        }}
                      />
                    </Grid>
                    {accountName && (
                      <Grid item xs={12}>
                        <Alert severity="success">
                          <strong>Account Name:</strong> {accountName}
                        </Alert>
                      </Grid>
                    )}
                  </Grid>
                </>
              )}
            </CardContent>
            <CardActions
              sx={{ flexDirection: "column", alignItems: "stretch", gap: 1 }}
            >
              {subaccountStatus?.hasSubaccount ? (
                <Box
                  sx={{
                    width: "100%",
                    display: "flex",
                    gap: 2,
                    alignItems: "center",
                  }}
                >
                  <Alert severity="info" sx={{ flex: 1 }}>
                    Need to change your payment account? You can reset and set
                    up a new one.
                  </Alert>
                  <Button
                    variant="outlined"
                    color="warning"
                    onClick={handleResetPaymentClick}
                    disabled={subaccountLoading}
                  >
                    {subaccountLoading ? "Resetting..." : "Reset Setup"}
                  </Button>
                </Box>
              ) : (
                <Box sx={{ width: "100%" }}>
                  <Button
                    variant="contained"
                    onClick={handleSetupSubaccountClick}
                    disabled={
                      subaccountLoading ||
                      !businessName ||
                      !bankCode ||
                      !accountNumber ||
                      !accountName
                    }
                    startIcon={
                      subaccountLoading ? <CircularProgress size={20} /> : null
                    }
                    fullWidth
                  >
                    {subaccountLoading
                      ? "Setting up..."
                      : "Setup Payment Account"}
                  </Button>
                </Box>
              )}
            </CardActions>
          </Card>
        </TabPanel>
      </Paper>

      {/* Payment Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: "primary.main" }}>
          Confirm Payment Account Setup
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Are you sure you want to add this account as your payment method?
          </DialogContentText>
          <Box
            sx={{
              bgcolor: "rgba(25, 193, 255, 0.08)",
              p: 2,
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Business Name:</strong> {businessName}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Bank:</strong>{" "}
              {banks.find((b: any) => b.code === bankCode)?.name || bankCode}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Account Number:</strong> {accountNumber}
            </Typography>
            <Typography variant="body2">
              <strong>Account Name:</strong> {accountName}
            </Typography>
          </Box>
          <Alert severity="info" sx={{ mt: 2 }}>
            Once confirmed, client payments will be sent directly to this
            account.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={() => setConfirmDialogOpen(false)}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSetupSubaccount}
            variant="contained"
            disabled={subaccountLoading}
            startIcon={
              subaccountLoading ? <CircularProgress size={20} /> : null
            }
          >
            {subaccountLoading ? "Setting up..." : "Yes, Add This Account"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Payment Setup Confirmation Dialog */}
      <Dialog
        open={resetDialogOpen}
        onClose={() => {
          setResetDialogOpen(false);
          setResetPassword("");
          setResetError("");
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: "warning.main" }}>
          Reset Payment Setup
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Are you sure you want to reset your payment setup? This will remove
            your current payment account and allow you to set up a new one.
          </DialogContentText>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone. You will need to set up a new payment
            account to receive payments.
          </Alert>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Please enter your account password to confirm:
          </Typography>
          <TextField
            fullWidth
            type="password"
            label="Password"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            error={!!resetError}
            helperText={resetError}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={() => {
              setResetDialogOpen(false);
              setResetPassword("");
              setResetError("");
            }}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmResetPayment}
            variant="contained"
            color="warning"
            disabled={subaccountLoading || !resetPassword}
            startIcon={
              subaccountLoading ? <CircularProgress size={20} /> : null
            }
          >
            {subaccountLoading ? "Resetting..." : "Confirm Reset"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Availability Info Dialog */}
      <Dialog
        open={availabilityInfoOpen}
        onClose={() => setAvailabilityInfoOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>How Availability Works</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mt: 1 }}>
            <strong>Manage Your Availability:</strong> Set your available
            meeting times for each day of the week. You can add breaks (lunch,
            etc.) and also set specific date overrides if needed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setAvailabilityInfoOpen(false)}
            variant="contained"
          >
            Got it
          </Button>
        </DialogActions>
      </Dialog>

      {/* Calendar Info Dialog */}
      <Dialog
        open={calendarInfoOpen}
        onClose={() => setCalendarInfoOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>How Google Calendar Integration Works</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mt: 1 }}>
            Connect your Google Calendar to automatically sync your availability
            and create meetings with your clients.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2 }}>
            <strong>Features:</strong>
          </DialogContentText>
          <Box component="ul" sx={{ pl: 2 }}>
            <li>
              <DialogContentText>
                Automatic availability checking from your Google Calendar
              </DialogContentText>
            </li>
            <li>
              <DialogContentText>
                Create meetings directly on your calendar
              </DialogContentText>
            </li>
            <li>
              <DialogContentText>
                Auto-generate Google Meet links for bookings
              </DialogContentText>
            </li>
            <li>
              <DialogContentText>
                Send calendar invitations to clients
              </DialogContentText>
            </li>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setCalendarInfoOpen(false)}
            variant="contained"
          >
            Got it
          </Button>
        </DialogActions>
      </Dialog>

      {/* Paystack Info Dialog */}
      <Dialog
        open={paystackInfoOpen}
        onClose={() => setPaystackInfoOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>How Paystack Payment Works</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mt: 1 }}>
            When clients pay for bookings, the payment is automatically sent
            directly to your bank account via Paystack split payments. No manual
            withdrawals needed!
          </DialogContentText>
          <DialogContentText sx={{ mt: 2 }}>
            <strong>Benefits:</strong>
          </DialogContentText>
          <Box component="ul" sx={{ pl: 2 }}>
            <li>
              <DialogContentText>Instant payment processing</DialogContentText>
            </li>
            <li>
              <DialogContentText>Automatic bank transfers</DialogContentText>
            </li>
            <li>
              <DialogContentText>Secure payment handling</DialogContentText>
            </li>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setPaystackInfoOpen(false)}
            variant="contained"
          >
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminSettings;
