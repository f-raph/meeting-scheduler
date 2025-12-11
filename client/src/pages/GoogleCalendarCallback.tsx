import React, { useEffect } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";

const GoogleCalendarCallback: React.FC = () => {
  useEffect(() => {
    // Extract code from URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error) {
      // Send error to parent window
      if (window.opener) {
        window.opener.postMessage(
          { type: "GOOGLE_OAUTH_ERROR", error },
          window.location.origin
        );
      }
      window.close();
      return;
    }

    if (code) {
      // Send code to parent window
      if (window.opener) {
        window.opener.postMessage(
          { type: "GOOGLE_OAUTH_SUCCESS", code },
          window.location.origin
        );
      }
      // Don't close immediately, let parent handle it
    } else {
      // No code or error, something went wrong
      if (window.opener) {
        window.opener.postMessage(
          {
            type: "GOOGLE_OAUTH_ERROR",
            error: "No authorization code received",
          },
          window.location.origin
        );
      }
      window.close();
    }
  }, []);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography variant="body1">Completing authorization...</Typography>
    </Box>
  );
};

export default GoogleCalendarCallback;
