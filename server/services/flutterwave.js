const Flutterwave = require("flutterwave-node-v3");
const axios = require("axios");

class FlutterwaveService {
  constructor() {
    // Only initialize if Flutterwave credentials are provided
    if (
      process.env.FLUTTERWAVE_PUBLIC_KEY &&
      process.env.FLUTTERWAVE_SECRET_KEY
    ) {
      this.flw = new Flutterwave(
        process.env.FLUTTERWAVE_PUBLIC_KEY,
        process.env.FLUTTERWAVE_SECRET_KEY
      );
      this.enabled = true;
    } else {
      console.warn(
        "⚠️  Flutterwave credentials not found. Flutterwave payments disabled."
      );
      this.flw = null;
      this.enabled = false;
    }
  }

  _ensureEnabled() {
    if (!this.enabled) {
      throw new Error(
        "Flutterwave is not configured. Please add FLUTTERWAVE_PUBLIC_KEY and FLUTTERWAVE_SECRET_KEY to your .env file."
      );
    }
  }

  /**
   * Initialize a payment with Flutterwave
   * @param {number} amount - Amount in naira
   * @param {string} email - Customer email
   * @param {object} metadata - Additional metadata
   * @param {string} slug - Tenant slug for callback URL
   * @param {string} subaccountId - Flutterwave subaccount ID for split payment
   * @returns {Promise<object>} Payment initialization response
   */
  async initializePayment(
    amount,
    email,
    metadata = {},
    slug = null,
    subaccountId = null
  ) {
    this._ensureEnabled();
    try {
      // Build callback URL with slug if provided
      const callbackPath = slug
        ? `/${slug}/payment/callback?slug=${slug}`
        : "/payment/callback";
      const redirect_url = `${process.env.CLIENT_URL}${callbackPath}`;

      const payload = {
        tx_ref: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        amount: amount, // Flutterwave standard expects amount in naira (not kobo)
        currency: "NGN",
        redirect_url,
        payment_options: "card", // Hosted checkout (standard) flow
        customer: {
          email,
          name: metadata.clientName || "Customer",
        },
        customizations: {
          title: "Meeting Booking Payment",
          description: metadata.meetingType || "Meeting booking",
          logo: "", // Add your logo URL here if needed
        },
        meta: metadata,
      };

      // Add split payment if subaccount is provided (100% to tenant)
      if (subaccountId) {
        payload.subaccounts = [
          {
            id: subaccountId,
            transaction_split_ratio: 10, // 10 out of 10 = 100%
          },
        ];
      }

      // Prefer SDK standard checkout; fallback to REST if SDK version lacks Payment
      let response;
      if (this.flw?.Payment?.initialize) {
        response = await this.flw.Payment.initialize(payload);
      } else {
        const restResponse = await axios.post(
          "https://api.flutterwave.com/v3/payments",
          payload,
          {
            headers: {
              Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );
        response = restResponse.data;
      }

      // Flutterwave response structure: { status, message, data: { link } }
      if (response.status === "success") {
        return {
          status: "success",
          authorization_url: response.data.link,
          tx_ref: payload.tx_ref,
        };
      } else {
        throw new Error(response.message || "Payment initialization failed");
      }
    } catch (error) {
      console.error("Flutterwave initialize payment error:", error);
      throw new Error("Failed to initialize Flutterwave payment");
    }
  }

  /**
   * Verify a Flutterwave payment
   * @param {string} transaction_id - Flutterwave transaction ID or tx_ref
   * @returns {Promise<object>} Payment verification response
   */
  async verifyPayment(transaction_id) {
    this._ensureEnabled();
    try {
      const response = await this.flw.Transaction.verify({
        id: transaction_id,
      });

      // Flutterwave response: { status, message, data: { status, amount, currency, ... } }
      if (
        response.status === "success" &&
        response.data.status === "successful"
      ) {
        return {
          status: "success",
          data: {
            status: response.data.status,
            amount: response.data.amount,
            currency: response.data.currency,
            customer: {
              email: response.data.customer.email,
              name: response.data.customer.name,
            },
            tx_ref: response.data.tx_ref,
            flw_ref: response.data.flw_ref,
            metadata: response.data.meta,
          },
        };
      } else {
        throw new Error(
          response.message || "Payment verification failed or not successful"
        );
      }
    } catch (error) {
      console.error("Flutterwave verify payment error:", error);
      throw new Error("Failed to verify Flutterwave payment");
    }
  }

  /**
   * Create a Flutterwave subaccount for split payments
   * @param {object} params - Subaccount parameters
   * @param {string} params.account_bank - Bank code
   * @param {string} params.account_number - Account number
   * @param {string} params.business_name - Business name
   * @param {string} params.business_email - Business email
   * @param {number} params.split_value - Split ratio (use 1 for 100%)
   * @returns {Promise<object>} Subaccount creation response
   */
  async createSubaccount({
    account_bank,
    account_number,
    business_name,
    business_email,
    split_value = 1, // 1 = 100% to subaccount
    split_type = "flat", // 'flat' or 'percentage'
  }) {
    this._ensureEnabled();
    try {
      const payload = {
        account_bank,
        account_number,
        business_name,
        business_email,
        split_type,
        split_value,
      };

      const response = await this.flw.Subaccount.create(payload);

      if (response.status === "success") {
        return {
          status: "success",
          subaccount_id: response.data.id,
          subaccount_code: response.data.subaccount_id,
          account_number: response.data.account_number,
          bank_name: response.data.bank_name,
        };
      } else {
        throw new Error(response.message || "Subaccount creation failed");
      }
    } catch (error) {
      console.error("Flutterwave create subaccount error:", error);
      throw new Error(
        error.response?.data?.message ||
          error.message ||
          "Failed to create Flutterwave subaccount"
      );
    }
  }

  /**
   * Update an existing Flutterwave subaccount
   * @param {string} subaccount_id - Subaccount ID to update
   * @param {object} updates - Fields to update
   * @returns {Promise<object>} Update response
   */
  async updateSubaccount(subaccount_id, updates) {
    try {
      const response = await this.flw.Subaccount.update({
        id: subaccount_id,
        ...updates,
      });

      if (response.status === "success") {
        return response.data;
      } else {
        throw new Error(response.message || "Subaccount update failed");
      }
    } catch (error) {
      console.error("Flutterwave update subaccount error:", error);
      throw new Error("Failed to update Flutterwave subaccount");
    }
  }

  /**
   * Transfer funds to a bank account (for Paystack -> Flutterwave transfers)
   * @param {object} params - Transfer parameters
   * @param {number} params.amount - Amount to transfer
   * @param {string} params.account_bank - Bank code
   * @param {string} params.account_number - Account number
   * @param {string} params.narration - Transfer description
   * @param {string} params.reference - Unique reference
   * @returns {Promise<object>} Transfer response
   */
  async transfer({
    amount,
    account_bank,
    account_number,
    narration = "Payment transfer",
    reference = `TRANSFER-${Date.now()}`,
    currency = "NGN",
  }) {
    this._ensureEnabled();
    try {
      const payload = {
        account_bank,
        account_number,
        amount,
        narration,
        currency,
        reference,
      };

      const response = await this.flw.Transfer.initiate(payload);

      if (response.status === "success") {
        return {
          status: "success",
          transfer_id: response.data.id,
          reference: response.data.reference,
          status_code: response.data.status,
        };
      } else {
        throw new Error(response.message || "Transfer failed");
      }
    } catch (error) {
      console.error("Flutterwave transfer error:", error);
      throw new Error(
        error.response?.data?.message ||
          error.message ||
          "Failed to initiate Flutterwave transfer"
      );
    }
  }

  /**
   * Get list of banks for a specific country
   * @param {string} countryCode - ISO 2-letter country code (e.g., 'NG', 'US', 'GB', 'KE')
   * @returns {Promise<array>} List of banks
   */
  async getBanks(countryCode = "NG") {
    this._ensureEnabled();

    // Fallback bank lists for common countries
    const fallbackBanks = {
      NG: [
        { code: "044", name: "Access Bank" },
        { code: "063", name: "Access Bank (Diamond)" },
        { code: "050", name: "Ecobank Nigeria" },
        { code: "070", name: "Fidelity Bank" },
        { code: "011", name: "First Bank of Nigeria" },
        { code: "214", name: "First City Monument Bank" },
        { code: "058", name: "Guaranty Trust Bank" },
        { code: "030", name: "Heritage Bank" },
        { code: "301", name: "Jaiz Bank" },
        { code: "082", name: "Keystone Bank" },
        { code: "526", name: "Parallex Bank" },
        { code: "076", name: "Polaris Bank" },
        { code: "101", name: "Providus Bank" },
        { code: "221", name: "Stanbic IBTC Bank" },
        { code: "068", name: "Standard Chartered Bank" },
        { code: "232", name: "Sterling Bank" },
        { code: "100", name: "Suntrust Bank" },
        { code: "302", name: "TAJ Bank" },
        { code: "032", name: "Union Bank of Nigeria" },
        { code: "033", name: "United Bank For Africa" },
        { code: "215", name: "Unity Bank" },
        { code: "035", name: "Wema Bank" },
        { code: "057", name: "Zenith Bank" },
      ],
      GH: [
        { code: "280100", name: "Access Bank Ghana" },
        { code: "280101", name: "ADB Bank" },
        { code: "280102", name: "Barclays Bank Ghana" },
        { code: "280103", name: "CalBank" },
        { code: "280104", name: "Ecobank Ghana" },
        { code: "280105", name: "Fidelity Bank Ghana" },
        { code: "280106", name: "First Atlantic Bank" },
        { code: "280107", name: "First National Bank Ghana" },
        { code: "280108", name: "GCB Bank" },
        { code: "280109", name: "Guaranty Trust Bank Ghana" },
        { code: "280110", name: "Stanbic Bank Ghana" },
        { code: "280111", name: "Standard Chartered Bank Ghana" },
        { code: "280112", name: "United Bank for Africa Ghana" },
        { code: "280113", name: "Zenith Bank Ghana" },
      ],
      KE: [
        { code: "54", name: "Barclays Bank of Kenya" },
        { code: "63", name: "Diamond Trust Bank Kenya" },
        { code: "76", name: "Ecobank Kenya" },
        { code: "68", name: "Equity Bank Kenya" },
        { code: "61", name: "Family Bank" },
        { code: "74", name: "First Community Bank" },
        { code: "3", name: "Kenya Commercial Bank" },
        { code: "66", name: "KCB Bank Kenya" },
        { code: "53", name: "National Bank of Kenya" },
        { code: "11", name: "Standard Chartered Bank Kenya" },
        { code: "7", name: "Stanbic Bank Kenya" },
      ],
      ZA: [
        { code: "632005", name: "ABSA Bank" },
        { code: "250655", name: "African Bank" },
        { code: "410506", name: "Capitec Bank" },
        { code: "462005", name: "First National Bank" },
        { code: "580105", name: "Investec Bank" },
        { code: "198765", name: "Nedbank" },
        { code: "051001", name: "Standard Bank" },
      ],
      US: [
        { code: "026009593", name: "Bank of America" },
        { code: "021000021", name: "JPMorgan Chase" },
        { code: "122000247", name: "Wells Fargo" },
        { code: "111000025", name: "Citibank" },
        { code: "026013673", name: "Capital One" },
        { code: "121000248", name: "PNC Bank" },
      ],
      GB: [
        { code: "608371", name: "Barclays Bank UK" },
        { code: "040004", name: "HSBC UK" },
        { code: "165671", name: "Lloyds Bank" },
        { code: "236972", name: "NatWest" },
        { code: "070116", name: "Revolut" },
        { code: "040075", name: "Santander UK" },
      ],
      CA: [
        { code: "001", name: "Bank of Montreal" },
        { code: "002", name: "Scotiabank" },
        { code: "003", name: "Royal Bank of Canada" },
        { code: "004", name: "TD Canada Trust" },
        { code: "006", name: "National Bank of Canada" },
        { code: "010", name: "CIBC" },
      ],
    };

    try {
      const response = await this.flw.Bank.country({ country: countryCode });

      if (
        response.status === "success" &&
        response.data &&
        response.data.length > 0
      ) {
        return response.data.map((bank) => ({
          code: bank.code,
          name: bank.name,
        }));
      } else {
        // Use fallback if API returns empty or unsuccessful
        console.warn(
          `Flutterwave API returned no banks for ${countryCode}, using fallback list`
        );
        return fallbackBanks[countryCode] || [];
      }
    } catch (error) {
      console.error("Flutterwave get banks API error:", error.message || error);

      // Return fallback banks for the requested country
      if (fallbackBanks[countryCode]) {
        console.log(`Using fallback bank list for ${countryCode}`);
        return fallbackBanks[countryCode];
      }

      // If no fallback available, return empty array instead of throwing
      console.warn(`No fallback banks available for country: ${countryCode}`);
      return [];
    }
  }

  /**
   * Get list of supported countries for transfers
   * @returns {Promise<array>} List of countries
   */
  async getCountries() {
    this._ensureEnabled();
    // Common countries supported by Flutterwave
    return [
      { code: "NG", name: "Nigeria", currency: "NGN" },
      { code: "GH", name: "Ghana", currency: "GHS" },
      { code: "KE", name: "Kenya", currency: "KES" },
      { code: "ZA", name: "South Africa", currency: "ZAR" },
      { code: "TZ", name: "Tanzania", currency: "TZS" },
      { code: "UG", name: "Uganda", currency: "UGX" },
      { code: "US", name: "United States", currency: "USD" },
      { code: "GB", name: "United Kingdom", currency: "GBP" },
      { code: "CA", name: "Canada", currency: "CAD" },
      { code: "EU", name: "Europe (SEPA)", currency: "EUR" },
    ];
  }

  /**
   * Verify Flutterwave webhook signature
   * @param {object} payload - Webhook payload
   * @param {string} signature - Signature from header
   * @returns {boolean} True if signature is valid
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.enabled) {
      return false;
    }

    const crypto = require("crypto");
    const hash = crypto
      .createHmac("sha256", process.env.FLUTTERWAVE_SECRET_HASH)
      .update(JSON.stringify(payload))
      .digest("hex");

    return hash === signature;
  }
}

module.exports = new FlutterwaveService();
