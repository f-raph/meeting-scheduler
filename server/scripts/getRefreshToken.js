const { google } = require("googleapis");
require("dotenv").config();

// For this script, we'll use port 3001 since 5000 is usually taken by the server
const SCRIPT_PORT = 3001;
const SCRIPT_REDIRECT_URI = `http://localhost:${SCRIPT_PORT}/api/auth/google/callback`;

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  SCRIPT_REDIRECT_URI // Use the script's own port
);

const scopes = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar",
];

const url = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: scopes,
});

const http = require("http");
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/auth/google/callback")) {
    const urlObj = new URL(req.url, `http://localhost:${SCRIPT_PORT}`);
    const code = urlObj.searchParams.get("code");

    if (!code) {
      res.end("Error: No authorization code received. Please try again.");
      return;
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.refresh_token) {
        // Sometimes Google doesn't return refresh_token on second attempt
        console.error("\n⚠️  Warning: Google did not return a refresh token.");
        console.error("This usually means you need to:");
        console.error(
          "1. Revoke access to this app in Google Account settings"
        );
        console.error("2. Delete/clear the 'consent' cache");
        console.error("3. Run this script again");
        res.end("Error: No refresh token received. See console for details.");
      } else {
        console.log("\n✅ Success! Refresh token:", tokens.refresh_token);
        console.log("\nAdd this to your .env file as GOOGLE_REFRESH_TOKEN");
        res.end(
          "✅ Success! Refresh token retrieved. Check the console. You can close this window."
        );
      }
    } catch (err) {
      console.error("Failed to get tokens:", err.message);
      res.end("Error retrieving tokens. Check the console output.");
    } finally {
      server.close();
      process.exit(0);
    }
  } else {
    res.end("Waiting for Google OAuth callback...");
  }
});

server.listen(SCRIPT_PORT, () => {
  console.log(`\n🔐 Google OAuth Token Retrieval Script`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(
    `Listening on http://localhost:${SCRIPT_PORT} for the OAuth callback…`
  );
  console.log(`\n📖 Instructions:`);
  console.log(`1. Visit this URL in your browser:`);
  console.log(`   ${url}`);
  console.log(`\n2. Click "Allow" to grant calendar access`);
  console.log(
    `\n3. You will be redirected back here and the token will be displayed`
  );
  console.log(`\n4. Copy the refresh token and add it to your .env file`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});
