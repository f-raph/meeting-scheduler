import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const brandColors = {
  navy: "#08162b",
  surface: "#0f2547",
  surfaceAlt: "#12305a",
  cyan: "#19c1ff",
  cyanDark: "#0f9ad8",
  cyanLight: "#6fe2ff",
  yellow: "#f5c242",
  textPrimary: "#e5f0ff",
  textSecondary: "#b7c8e8",
  border: "rgba(255, 255, 255, 0.08)",
};

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: brandColors.cyan,
      dark: brandColors.cyanDark,
      light: brandColors.cyanLight,
    },
    secondary: {
      main: brandColors.yellow,
      dark: "#d9a92d",
    },
    background: {
      default: brandColors.navy,
      paper: brandColors.surface,
    },
    text: {
      primary: brandColors.textPrimary,
      secondary: brandColors.textSecondary,
    },
    divider: brandColors.border,
  },
  typography: {
    fontFamily: `'Poppins', 'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`,
    fontWeightMedium: 600,
    fontWeightBold: 700,
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: brandColors.surface,
          color: brandColors.textPrimary,
          border: `1px solid ${brandColors.border}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: brandColors.surface,
          color: brandColors.textPrimary,
          border: `1px solid ${brandColors.border}`,
          boxShadow: "0 14px 40px rgba(0, 0, 0, 0.35)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: "none",
          fontWeight: 600,
        },
        containedPrimary: {
          boxShadow: "0 12px 28px rgba(25, 193, 255, 0.28)",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "transparent",
          color: brandColors.textPrimary,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: brandColors.surfaceAlt,
            color: brandColors.textPrimary,
            "& fieldset": {
              borderColor: brandColors.border,
            },
            "&:hover fieldset": {
              borderColor: brandColors.cyan,
            },
            "&.Mui-focused fieldset": {
              borderColor: brandColors.cyan,
            },
            "&.Mui-disabled": {
              backgroundColor: "rgba(15, 37, 71, 0.5)",
              "& fieldset": {
                borderColor: brandColors.border,
              },
            },
          },
          "& .MuiInputBase-input": {
            color: brandColors.textPrimary,
            "&::placeholder": {
              color: brandColors.textSecondary,
              opacity: 0.7,
            },
            "&.Mui-disabled": {
              color: brandColors.textSecondary,
              WebkitTextFillColor: brandColors.textSecondary,
            },
          },
          "& .MuiInputLabel-root": {
            color: brandColors.textSecondary,
            "&.Mui-focused": {
              color: brandColors.cyan,
            },
          },
          "& .MuiFormHelperText-root": {
            color: brandColors.textSecondary,
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: brandColors.surfaceAlt,
          color: brandColors.textPrimary,
        },
        icon: {
          color: brandColors.textSecondary,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: brandColors.surfaceAlt,
          color: brandColors.textPrimary,
          "& fieldset": {
            borderColor: brandColors.border,
          },
          "&:hover fieldset": {
            borderColor: brandColors.cyan,
          },
          "&.Mui-focused fieldset": {
            borderColor: brandColors.cyan,
          },
        },
        input: {
          color: brandColors.textPrimary,
          "&::placeholder": {
            color: brandColors.textSecondary,
            opacity: 0.7,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: brandColors.textSecondary,
          "&.Mui-focused": {
            color: brandColors.cyan,
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: brandColors.textPrimary,
          "&:hover": {
            backgroundColor: "rgba(25, 193, 255, 0.1)",
          },
          "&.Mui-selected": {
            backgroundColor: "rgba(25, 193, 255, 0.2)",
            "&:hover": {
              backgroundColor: "rgba(25, 193, 255, 0.25)",
            },
          },
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: brandColors.surface,
          border: `1px solid ${brandColors.border}`,
        },
      },
    },
  },
});

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AuthProvider>
            <App />
            <ToastContainer
              position="top-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
            />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
