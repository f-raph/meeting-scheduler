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
} from "@mui/icons-material";
import { googleCalendarApi, adminApi, meetingTypesApi } from "../services/api";
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
  const [banks, setBanks] = useState<any[]>([]);

  // Flutterwave state
  const [flutterwaveStatus, setFlutterwaveStatus] = useState<any>(null);
  const [flutterwaveLoading, setFlutterwaveLoading] = useState(false);
  const [flwBusinessName, setFlwBusinessName] = useState("");
  const [flwBusinessEmail, setFlwBusinessEmail] = useState("");
  const [flwCountry, setFlwCountry] = useState("NG");
  const [flwCurrency, setFlwCurrency] = useState("NGN");
  const [flwBankCode, setFlwBankCode] = useState("");
  const [flwAccountNumber, setFlwAccountNumber] = useState("");
  const [flwCountries, setFlwCountries] = useState<any[]>([]);
  const [flwBanks, setFlwBanks] = useState<any[]>([]);

  // Meeting types state
  const [meetingTypes, setMeetingTypes] = useState<any[]>([]);
  const [meetingTypesLoading, setMeetingTypesLoading] = useState(false);
  const [editingMeetingType, setEditingMeetingType] = useState<any>(null);
  const [showMeetingTypeForm, setShowMeetingTypeForm] = useState(false);
  const [meetingTypeForm, setMeetingTypeForm] = useState({
    name: "",
    description: "",
    price: 0,
    currency: "USD",
    duration: 60,
    color: "#19c1ff",
    isActive: true,
  });

  useEffect(() => {
    fetchCalendarStatus();
    fetchSubaccountStatus();
    fetchFlutterwaveStatus();
    fetchBanks();
    fetchFlutterwaveCountries();
    fetchFlutterwaveBanks(flwCountry);
    fetchMeetingTypes();
  }, []);

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
      // Nigerian banks - you can expand this or fetch from Paystack API
      const nigerianBanks = [
        { name: "Access Bank", code: "044" },
        { name: "Citibank", code: "023" },
        { name: "Ecobank Nigeria", code: "050" },
        { name: "Fidelity Bank", code: "070" },
        { name: "First Bank of Nigeria", code: "011" },
        { name: "First City Monument Bank", code: "214" },
        { name: "Guaranty Trust Bank", code: "058" },
        { name: "Heritage Bank", code: "030" },
        { name: "Keystone Bank", code: "082" },
        { name: "Polaris Bank", code: "076" },
        { name: "Providus Bank", code: "101" },
        { name: "Stanbic IBTC Bank", code: "221" },
        { name: "Standard Chartered Bank", code: "068" },
        { name: "Sterling Bank", code: "232" },
        { name: "Union Bank of Nigeria", code: "032" },
        { name: "United Bank for Africa", code: "033" },
        { name: "Unity Bank", code: "215" },
        { name: "Wema Bank", code: "035" },
        { name: "Zenith Bank", code: "057" },
      ];
      setBanks(nigerianBanks);
    } catch (error) {
      console.error("Failed to fetch banks:", error);
    }
  };

  const handleSetupSubaccount = async () => {
    if (!businessName || !bankCode || !accountNumber) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setSubaccountLoading(true);
      await adminApi.setupSubaccount({
        businessName,
        settlementBank: bankCode,
        accountNumber,
        percentageCharge: 80, // 80% to tenant, 20% to platform
      });
      toast.success(
        "Subaccount created successfully! You'll now receive 80% of each payment instantly."
      );
      await fetchSubaccountStatus();
      setBusinessName("");
      setBankCode("");
      setAccountNumber("");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to setup subaccount");
    } finally {
      setSubaccountLoading(false);
    }
  };

  // Flutterwave functions
  const fetchFlutterwaveStatus = async () => {
    try {
      setFlutterwaveLoading(true);
      const response = await adminApi.getFlutterwaveStatus();
      setFlutterwaveStatus(response.data);
    } catch (error) {
      console.error("Failed to fetch Flutterwave status:", error);
      setFlutterwaveStatus({ hasSubaccount: false });
    } finally {
      setFlutterwaveLoading(false);
    }
  };

  const fetchFlutterwaveBanks = async (country: string = "NG") => {
    try {
      const response = await adminApi.getFlutterwaveBanks(country);
      setFlwBanks(response.data.banks || []);
    } catch (error) {
      console.error("Failed to fetch Flutterwave banks:", error);
      // Fallback to common banks if API fails
      const commonBanks = [
        { name: "Access Bank", code: "044" },
        { name: "GTBank", code: "058" },
        { name: "First Bank of Nigeria", code: "011" },
        { name: "United Bank for Africa", code: "033" },
        { name: "Zenith Bank", code: "057" },
        { name: "Wema Bank", code: "035" },
        { name: "Sterling Bank", code: "232" },
        { name: "Providus Bank", code: "101" },
      ];
      setFlwBanks(commonBanks);
    }
  };

  const fetchFlutterwaveCountries = async () => {
    try {
      const response = await adminApi.getFlutterwaveCountries();
      setFlwCountries(response.data.countries || []);
    } catch (error) {
      console.error("Failed to fetch Flutterwave countries:", error);
      // Fallback to common countries
      setFlwCountries([
        { code: "NG", name: "Nigeria", currency: "NGN" },
        { code: "GH", name: "Ghana", currency: "GHS" },
        { code: "KE", name: "Kenya", currency: "KES" },
        { code: "ZA", name: "South Africa", currency: "ZAR" },
        { code: "US", name: "United States", currency: "USD" },
        { code: "GB", name: "United Kingdom", currency: "GBP" },
      ]);
    }
  };

  const handleSetupFlutterwave = async () => {
    if (
      !flwBusinessName ||
      !flwBusinessEmail ||
      !flwBankCode ||
      !flwAccountNumber
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setFlutterwaveLoading(true);
      await adminApi.setupFlutterwave({
        businessName: flwBusinessName,
        businessEmail: flwBusinessEmail,
        accountBank: flwBankCode,
        accountNumber: flwAccountNumber,
        bankName: flwBanks.find((b) => b.code === flwBankCode)?.name,
        country: flwCountry,
        currency: flwCurrency,
      });
      toast.success(
        "Flutterwave subaccount created successfully! You'll now receive 100% of each payment."
      );
      await fetchFlutterwaveStatus();
      setFlwBusinessName("");
      setFlwBusinessEmail("");
      setFlwBankCode("");
      setFlwAccountNumber("");
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || "Failed to setup Flutterwave subaccount"
      );
    } finally {
      setFlutterwaveLoading(false);
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
        currency: "USD",
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
        currency: "USD",
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
            label="Paystack (Legacy)"
            iconPosition="start"
          />
          <Tab icon={<WalletIcon />} label="Flutterwave" iconPosition="start" />
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

                  <Box sx={{ bgcolor: "grey.50", p: 2, borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
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
                        <MenuItem value="USD">USD ($)</MenuItem>
                        <MenuItem value="EUR">EUR (€)</MenuItem>
                        <MenuItem value="GBP">GBP (£)</MenuItem>
                        <MenuItem value="NGN">NGN (₦)</MenuItem>
                        <MenuItem value="INR">INR (₹)</MenuItem>
                        <MenuItem value="JPY">JPY (¥)</MenuItem>
                        <MenuItem value="CAD">CAD ($)</MenuItem>
                        <MenuItem value="AUD">AUD ($)</MenuItem>
                        <MenuItem value="ZAR">ZAR (R)</MenuItem>
                        <MenuItem value="KES">KES (KSh)</MenuItem>
                        <MenuItem value="GHS">GHS (₵)</MenuItem>
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
                      currency: "USD",
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
                        <strong>Price:</strong> {type.currency || "USD"}{" "}
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
                            currency: type.currency || "USD",
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

        {/* Payout Settings Tab */}
        <TabPanel value={tabValue} index={2}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <WalletIcon
                  sx={{ fontSize: 40, mr: 2, color: "primary.main" }}
                />
                <Box>
                  <Typography variant="h6">Split Payment Setup</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Receive 80% of each payment instantly via Paystack
                    subaccount
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
                    Your subaccount is configured! You receive 80% of each
                    booking payment instantly.
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
                        label="Account Number"
                        value={subaccountStatus.subaccount.accountNumber || ""}
                        disabled
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Your Share"
                        value={`${
                          subaccountStatus.subaccount.percentageCharge || 80
                        }%`}
                        disabled
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Subaccount Code"
                        value={subaccountStatus.subaccount.subaccountCode || ""}
                        disabled
                      />
                    </Grid>
                  </Grid>
                </>
              ) : (
                <>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <strong>Note:</strong> Instant split payments (80/20) via
                    Paystack subaccounts are currently only available for
                    Nigerian bank accounts. If you're in another country,
                    payments will still be processed but you'll need to contact
                    support for alternative payout arrangements.
                  </Alert>

                  <Alert severity="info" sx={{ mb: 2 }}>
                    Set up automatic payment splits: 80% goes directly to your
                    bank account, 20% to platform fees. No manual payouts
                    needed!
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
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth required>
                        <InputLabel>Bank (Nigerian Banks)</InputLabel>
                        <Select
                          value={bankCode}
                          onChange={(e) => setBankCode(e.target.value)}
                          label="Bank (Nigerian Banks)"
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
                        placeholder="0123456789"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        required
                        inputProps={{ maxLength: 10 }}
                      />
                    </Grid>
                  </Grid>
                </>
              )}
            </CardContent>
            <CardActions>
              {subaccountStatus?.hasSubaccount ? (
                <Alert severity="info" sx={{ width: "100%" }}>
                  Contact support to update your subaccount details.
                </Alert>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleSetupSubaccount}
                  disabled={
                    subaccountLoading ||
                    !businessName ||
                    !bankCode ||
                    !accountNumber
                  }
                >
                  {subaccountLoading ? "Setting up..." : "Setup Subaccount"}
                </Button>
              )}
            </CardActions>
          </Card>
        </TabPanel>

        {/* Flutterwave Tab */}
        <TabPanel value={tabValue} index={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <WalletIcon
                  sx={{ fontSize: 40, mr: 2, color: "primary.main" }}
                />
                <Box>
                  <Typography variant="h6">
                    Flutterwave Payment Setup
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Primary payment gateway - Receive 100% of payments instantly
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              {flutterwaveStatus?.hasSubaccount ? (
                <>
                  <Alert
                    severity="success"
                    icon={<CheckCircleIcon />}
                    sx={{ mb: 2 }}
                  >
                    Your Flutterwave subaccount is configured! You receive 100%
                    of each booking payment instantly.
                  </Alert>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Business Name"
                        value={flutterwaveStatus.subaccount.businessName || ""}
                        disabled
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Business Email"
                        value={flutterwaveStatus.subaccount.businessEmail || ""}
                        disabled
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Bank Name"
                        value={flutterwaveStatus.subaccount.bankName || ""}
                        disabled
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Account Number"
                        value={flutterwaveStatus.subaccount.accountNumber || ""}
                        disabled
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Your Share"
                        value="100%"
                        disabled
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Subaccount ID"
                        value={flutterwaveStatus.subaccount.subaccountId || ""}
                        disabled
                      />
                    </Grid>
                  </Grid>
                </>
              ) : (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <strong>Primary Payment Gateway:</strong> Flutterwave is
                    your default payment processor. Set up automatic payment
                    splits: 100% goes directly to your bank account (platform is
                    free!). No manual payouts needed.
                  </Alert>

                  <Alert severity="success" sx={{ mb: 2 }}>
                    <strong>How it works:</strong>
                    <ul>
                      <li>
                        Clients pay via Flutterwave → 100% goes to your account
                        instantly
                      </li>
                      <li>
                        Clients pay via Paystack (backup) → Funds transfer to
                        your Flutterwave account automatically
                      </li>
                    </ul>
                  </Alert>

                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Business Name"
                        placeholder="Your business or personal name"
                        value={flwBusinessName}
                        onChange={(e) => setFlwBusinessName(e.target.value)}
                        required
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Business Email"
                        type="email"
                        placeholder="your.email@example.com"
                        value={flwBusinessEmail}
                        onChange={(e) => setFlwBusinessEmail(e.target.value)}
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth required>
                        <InputLabel>Country</InputLabel>
                        <Select
                          value={flwCountry}
                          label="Country"
                          onChange={(e) => {
                            const selectedCountry = e.target.value;
                            setFlwCountry(selectedCountry);
                            // Update currency based on country
                            const country = flwCountries.find(
                              (c) => c.code === selectedCountry
                            );
                            if (country) {
                              setFlwCurrency(country.currency);
                            }
                            // Fetch banks for selected country
                            fetchFlutterwaveBanks(selectedCountry);
                            // Reset bank selection
                            setFlwBankCode("");
                          }}
                        >
                          {flwCountries.map((country) => (
                            <MenuItem key={country.code} value={country.code}>
                              {country.name} ({country.currency})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth required>
                        <InputLabel>Bank</InputLabel>
                        <Select
                          value={flwBankCode}
                          label="Bank"
                          onChange={(e) => setFlwBankCode(e.target.value)}
                          disabled={!flwCountry}
                        >
                          {flwBanks.map((bank) => (
                            <MenuItem key={bank.code} value={bank.code}>
                              {bank.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Account Number"
                        placeholder="Bank account number"
                        value={flwAccountNumber}
                        onChange={(e) => setFlwAccountNumber(e.target.value)}
                        required
                      />
                    </Grid>
                  </Grid>
                </>
              )}
            </CardContent>
            <CardActions>
              {flutterwaveStatus?.hasSubaccount ? (
                <Alert severity="info" sx={{ width: "100%" }}>
                  Contact support to update your Flutterwave account details.
                </Alert>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleSetupFlutterwave}
                  disabled={
                    flutterwaveLoading ||
                    !flwBusinessName ||
                    !flwBusinessEmail ||
                    !flwBankCode ||
                    !flwAccountNumber
                  }
                >
                  {flutterwaveLoading
                    ? "Setting up..."
                    : "Setup Flutterwave Account"}
                </Button>
              )}
            </CardActions>
          </Card>
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default AdminSettings;
