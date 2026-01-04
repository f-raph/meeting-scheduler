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
} from "@mui/icons-material";
import { googleCalendarApi, adminApi, meetingTypesApi, authApi } from "../services/api";
import { toast } from "react-toastify";

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
      toast.error("Please wait for account verification or check your account details");
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
        toast.success(
          "Payment setup complete! You can now receive payments."
        );
      }
      
      await fetchSubaccountStatus();
      setBusinessName("");
      setBankCode("");
      setAccountNumber("");
      setAccountName("");
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Failed to setup payment account";
      toast.error(errorMsg);
      
      // Show additional help for common errors
      if (errorMsg.includes("account number")) {
        toast.info("Tip: Make sure your account number is correct and matches your bank records.", { autoClose: 8000 });
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
      toast.success("Payment setup has been reset. You can now set up a new payment account.");
      setResetDialogOpen(false);
      setResetPassword("");
      await fetchSubaccountStatus();
      // Clear form fields
      setBusinessName("");
      setBankCode("");
      setAccountNumber("");
      setAccountName("");
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Failed to reset payment setup";
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
        <Card sx={{ mb: 3, bgcolor: "rgba(25, 193, 255, 0.08)", border: "1px solid", borderColor: "primary.main" }}>
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
                  }
                }}
                size="small"
              />
              <Tooltip title="Copy URL">
                <IconButton 
                  onClick={handleCopyBookingUrl}
                  sx={{ 
                    bgcolor: "primary.main", 
                    color: "white",
                    "&:hover": { bgcolor: "primary.dark" } 
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
                    "&:hover": { bgcolor: "primary.dark" } 
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

        {/* Google Calendar Tab */}
        <TabPanel value={tabValue} index={0}>
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
                <Box>
                  <Typography variant="h6">
                    Google Calendar Integration
                  </Typography>
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

                  <Box sx={{ bgcolor: "rgba(25, 193, 255, 0.08)", p: 2, borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
                    <Typography variant="subtitle2" gutterBottom color="primary.main">
                      Features
                    </Typography>
                    <Box component="ul" sx={{ pl: 2, mt: 1 }}>
                      <li>
                        <Typography variant="body2">
                          Automatic availability checking from your Google
                          Calendar
                        </Typography>
                      </li>
                      <li>
                        <Typography variant="body2">
                          Create meetings directly on your calendar
                        </Typography>
                      </li>
                      <li>
                        <Typography variant="body2">
                          Auto-generate Google Meet links for bookings
                        </Typography>
                      </li>
                      <li>
                        <Typography variant="body2">
                          Send calendar invitations to clients
                        </Typography>
                      </li>
                    </Box>
                  </Box>
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
        <TabPanel value={tabValue} index={1}>
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
                  <Card>
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
        <TabPanel value={tabValue} index={2}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <WalletIcon
                  sx={{ fontSize: 40, mr: 2, color: "primary.main" }}
                />
                <Box>
                  <Typography variant="h6">Paystack Payment Setup</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Receive payments directly to your bank account via Paystack
                    split payments
                  </Typography>
                </Box>
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
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <strong>How it works:</strong> When clients pay for
                    bookings, the payment is automatically split and sent
                    directly to your bank account via Paystack. No manual
                    withdrawals needed!
                  </Alert>

                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <strong>Note:</strong> Paystack subaccounts are currently
                    available for Ghanaian bank accounts. Your account details
                    will be verified automatically.
                  </Alert>

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
            <CardActions sx={{ flexDirection: "column", alignItems: "stretch", gap: 1 }}>
              {subaccountStatus?.hasSubaccount ? (
                <Box sx={{ width: "100%", display: "flex", gap: 2, alignItems: "center" }}>
                  <Alert severity="info" sx={{ flex: 1 }}>
                    Need to change your payment account? You can reset and set up a new one.
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
          <Box sx={{ bgcolor: "rgba(25, 193, 255, 0.08)", p: 2, borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Business Name:</strong> {businessName}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Bank:</strong> {banks.find((b: any) => b.code === bankCode)?.name || bankCode}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Account Number:</strong> {accountNumber}
            </Typography>
            <Typography variant="body2">
              <strong>Account Name:</strong> {accountName}
            </Typography>
          </Box>
          <Alert severity="info" sx={{ mt: 2 }}>
            Once confirmed, client payments will be sent directly to this account.
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
            startIcon={subaccountLoading ? <CircularProgress size={20} /> : null}
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
            Are you sure you want to reset your payment setup? This will remove your current payment account and allow you to set up a new one.
          </DialogContentText>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone. You will need to set up a new payment account to receive payments.
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
            startIcon={subaccountLoading ? <CircularProgress size={20} /> : null}
          >
            {subaccountLoading ? "Resetting..." : "Confirm Reset"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminSettings;
