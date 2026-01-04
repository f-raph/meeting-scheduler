const axios = require("axios");
const crypto = require("crypto");

/**
 * PaystackService - Official Paystack API Integration
 * 
 * Based on Paystack API Documentation:
 * 
 * BANKS:
 * - List Banks: GET /bank
 * - Resolve Account: GET /bank/resolve
 * 
 * SUBACCOUNTS (Split Payments):
 * - Create Subaccount: POST /subaccount
 * - List Subaccounts: GET /subaccount
 * - Fetch Subaccount: GET /subaccount/:id_or_code
 * - Update Subaccount: PUT /subaccount/:id_or_code
 * 
 * TRANSACTIONS (Collecting Payments):
 * - Initialize Transaction: POST /transaction/initialize
 * - Verify Transaction: GET /transaction/verify/:reference
 * 
 * CUSTOMERS:
 * - Create Customer: POST /customer
 * - List Customers: GET /customer
 * - Fetch Customer: GET /customer/:email_or_code
 * - Update Customer: PUT /customer/:code
 * 
 * TRANSFER RECIPIENTS (Payout Targets):
 * - Create Recipient: POST /transferrecipient
 * - List Recipients: GET /transferrecipient
 * - Fetch Recipient: GET /transferrecipient/:id_or_code
 * - Delete Recipient: DELETE /transferrecipient/:id_or_code
 * 
 * TRANSFERS (Payouts):
 * - Initiate Transfer: POST /transfer
 * - List Transfers: GET /transfer
 * - Fetch Transfer: GET /transfer/:id_or_code
 * - Verify Transfer: GET /transfer/verify/:reference
 * - Check Balance: GET /balance
 */
class PaystackService {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.baseURL = "https://api.paystack.co";

    if (!this.secretKey) {
      console.warn(
        "⚠️  PAYSTACK_SECRET_KEY not found. Payment features will be disabled."
      );
    }
  }

  /**
   * Get axios config with authorization headers
   */
  _getConfig() {
    return {
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
      },
    };
  }

  /**
   * Ensure Paystack is configured
   */
  _ensureConfigured() {
    if (!this.secretKey) {
      throw new Error(
        "Paystack is not configured. Please add PAYSTACK_SECRET_KEY to your .env file."
      );
    }
  }

  // ============================================================
  // BANK OPERATIONS
  // ============================================================

  /**
   * List Banks
   * GET /bank
   * 
   * @param {string} country - Country code (e.g., "ghana", "nigeria")
   * @returns {Promise<object>} List of banks
   */
  async listBanks(country = "ghana") {
    this._ensureConfigured();

    try {
      const response = await axios.get(
        `${this.baseURL}/bank?country=${country}`,
        this._getConfig()
      );

      return {
        status: "success",
        data: response.data.data || [],
      };
    } catch (error) {
      console.error("List banks error:", error.response?.data || error.message);
      throw new Error(error.response?.data?.message || "Failed to fetch banks");
    }
  }

  /**
   * Resolve Account Number
   * GET /bank/resolve
   * 
   * @param {string} accountNumber - Bank account number (13 digits for Ghana, 10 for Nigeria)
   * @param {string} bankCode - Bank code (e.g., "GH040100" for Ghana, "058" for Nigeria)
   * @param {string} country - Country code: "ghana" or "nigeria"
   * @returns {Promise<object>} Account details with account_name
   */
  async resolveAccount(accountNumber, bankCode, country = "ghana") {
    this._ensureConfigured();

    if (!accountNumber) {
      throw new Error("Account number is required");
    }
    if (!bankCode) {
      throw new Error("Bank code is required");
    }

    // Validate account number length based on country
    // Ghana: 13 digits, Nigeria: 10 digits
    const cleanedAccountNumber = accountNumber.replace(/\s/g, "");
    if (country === "ghana" && cleanedAccountNumber.length !== 13) {
      throw new Error("Ghana bank account numbers must be 13 digits");
    }
    if (country === "nigeria" && cleanedAccountNumber.length !== 10) {
      throw new Error("Nigerian bank account numbers must be 10 digits");
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/bank/resolve?account_number=${cleanedAccountNumber}&bank_code=${bankCode}`,
        this._getConfig()
      );

      return {
        status: "success",
        data: response.data.data,
      };
    } catch (error) {
      console.error("Resolve account error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Failed to resolve account"
      );
    }
  }

  // ============================================================
  // SUBACCOUNT OPERATIONS
  // ============================================================

  /**
   * Create Subaccount
   * POST /subaccount
   * 
   * Required Parameters:
   * - business_name: Name of business for the subaccount
   * - settlement_bank: Bank code (e.g., "058" for GTBank, NOT the full code)
   * - account_number: Bank account number
   * - percentage_charge: Percentage of transaction that goes to subaccount
   * 
   * @param {object} params - Subaccount parameters
   * @returns {Promise<object>} Created subaccount with subaccount_code
   */
  async createSubaccount({
    business_name,
    settlement_bank,
    account_number,
    percentage_charge = 100,
    description = "",
    primary_contact_email = "",
    country = "ghana", // "ghana" or "nigeria"
  }) {
    this._ensureConfigured();

    // Validate required fields
    if (!business_name) {
      throw new Error("business_name is required");
    }
    if (!settlement_bank) {
      throw new Error("settlement_bank (bank code) is required");
    }
    if (!account_number) {
      throw new Error("account_number is required");
    }

    // Validate account number length based on country
    // Ghana: 13 digits, Nigeria: 10 digits
    const cleanedAccountNumber = account_number.replace(/\s/g, "");
    if (country === "ghana" && cleanedAccountNumber.length !== 13) {
      throw new Error("Ghana bank account numbers must be 13 digits");
    }
    if (country === "nigeria" && cleanedAccountNumber.length !== 10) {
      throw new Error("Nigerian bank account numbers must be 10 digits");
    }

    const params = {
      business_name,
      settlement_bank, // Bank code like "GH040100" for Ghana, "058" for Nigeria
      account_number: cleanedAccountNumber,
      percentage_charge: Number(percentage_charge),
    };

    if (description) {
      params.description = description;
    }
    if (primary_contact_email) {
      params.primary_contact_email = primary_contact_email;
    }

    console.log("\n========================================");
    console.log("[Paystack] Creating Subaccount");
    console.log("========================================");
    console.log("Params:", JSON.stringify(params, null, 2));
    console.log("========================================\n");

    try {
      const response = await axios.post(
        `${this.baseURL}/subaccount`,
        params,
        this._getConfig()
      );

      if (response.data.status) {
        const data = response.data.data;
        console.log("\n✅ [Paystack] Subaccount Created Successfully!");
        console.log("   subaccount_code:", data.subaccount_code);
        console.log("   business_name:", data.business_name);
        console.log("   account_name:", data.account_name);
        console.log("   settlement_bank:", data.settlement_bank);
        console.log("");

        return {
          status: "success",
          message: response.data.message,
          data: {
            subaccount_code: data.subaccount_code,
            id: data.id,
            business_name: data.business_name,
            account_number: data.account_number,
            account_name: data.account_name,
            settlement_bank: data.settlement_bank,
            percentage_charge: data.percentage_charge,
            currency: data.currency,
            is_verified: data.is_verified,
            active: data.active,
          },
        };
      } else {
        throw new Error(response.data.message || "Subaccount creation failed");
      }
    } catch (error) {
      console.error("\n❌ [Paystack] Subaccount Creation Failed");
      console.error("   Error:", error.response?.data?.message || error.message);
      if (error.response?.data) {
        console.error("   Response:", JSON.stringify(error.response.data, null, 2));
      }
      console.error("");

      throw new Error(
        error.response?.data?.message || "Failed to create subaccount"
      );
    }
  }

  /**
   * List Subaccounts
   * GET /subaccount
   * 
   * @param {number} perPage - Number of records per page
   * @param {number} page - Page number
   * @returns {Promise<object>} List of subaccounts
   */
  async listSubaccounts(perPage = 50, page = 1) {
    this._ensureConfigured();

    try {
      const response = await axios.get(
        `${this.baseURL}/subaccount?perPage=${perPage}&page=${page}`,
        this._getConfig()
      );

      return {
        status: "success",
        data: response.data.data || [],
        meta: response.data.meta,
      };
    } catch (error) {
      console.error("List subaccounts error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Failed to list subaccounts"
      );
    }
  }

  /**
   * Fetch Subaccount
   * GET /subaccount/:id_or_code
   * 
   * @param {string} idOrCode - Subaccount ID or code (e.g., "ACCT_xxxxx")
   * @returns {Promise<object>} Subaccount details
   */
  async fetchSubaccount(idOrCode) {
    this._ensureConfigured();

    if (!idOrCode) {
      throw new Error("Subaccount ID or code is required");
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/subaccount/${idOrCode}`,
        this._getConfig()
      );

      if (response.data.status) {
        return {
          status: "success",
          data: response.data.data,
        };
      } else {
        throw new Error(response.data.message || "Subaccount not found");
      }
    } catch (error) {
      console.error("Fetch subaccount error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Failed to fetch subaccount"
      );
    }
  }

  /**
   * Update Subaccount
   * PUT /subaccount/:id_or_code
   * 
   * @param {string} idOrCode - Subaccount ID or code
   * @param {object} updates - Fields to update
   * @returns {Promise<object>} Updated subaccount
   */
  async updateSubaccount(idOrCode, updates) {
    this._ensureConfigured();

    if (!idOrCode) {
      throw new Error("Subaccount ID or code is required");
    }

    try {
      const response = await axios.put(
        `${this.baseURL}/subaccount/${idOrCode}`,
        updates,
        this._getConfig()
      );

      if (response.data.status) {
        return {
          status: "success",
          data: response.data.data,
        };
      } else {
        throw new Error(response.data.message || "Subaccount update failed");
      }
    } catch (error) {
      console.error("Update subaccount error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Failed to update subaccount"
      );
    }
  }

  // ============================================================
  // TRANSACTION OPERATIONS
  // ============================================================

  /**
   * Initialize Transaction
   * POST /transaction/initialize
   * 
   * For split payments, include subaccount code
   * 
   * @param {object} params - Transaction parameters
   * @returns {Promise<object>} Authorization URL and reference
   */
  async initializeTransaction({
    amount,
    email,
    currency = "GHS",
    reference = null,
    callback_url = null,
    metadata = {},
    subaccount = null,
    bearer = "subaccount", // Who bears Paystack fees: "account" or "subaccount"
  }) {
    this._ensureConfigured();

    if (!amount || !email) {
      throw new Error("Amount and email are required");
    }

    // Convert amount to pesewas/kobo (smallest currency unit)
    const amountInSmallestUnit = Math.round(amount * 100);

    const params = {
      amount: amountInSmallestUnit,
      email,
      currency,
      metadata,
    };

    if (reference) {
      params.reference = reference;
    }
    if (callback_url) {
      params.callback_url = callback_url;
    }

    // Add split payment parameters if subaccount provided
    if (subaccount) {
      params.subaccount = subaccount;
      params.bearer = bearer;
    }

    console.log("\n========================================");
    console.log("[Paystack] Initializing Transaction");
    console.log("========================================");
    console.log("Amount:", amount, currency, `(${amountInSmallestUnit} smallest unit)`);
    console.log("Email:", email);
    if (subaccount) {
      console.log("Subaccount:", subaccount);
      console.log("Fee Bearer:", bearer);
    }
    console.log("========================================\n");

    try {
      const response = await axios.post(
        `${this.baseURL}/transaction/initialize`,
        params,
        this._getConfig()
      );

      if (response.data.status) {
        const data = response.data.data;
        console.log("✅ [Paystack] Transaction Initialized");
        console.log("   Reference:", data.reference);
        console.log("   Authorization URL:", data.authorization_url);
        console.log("");

        return {
          status: "success",
          data: {
            authorization_url: data.authorization_url,
            access_code: data.access_code,
            reference: data.reference,
          },
        };
      } else {
        throw new Error(response.data.message || "Transaction initialization failed");
      }
    } catch (error) {
      console.error("Initialize transaction error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Failed to initialize transaction"
      );
    }
  }

  /**
   * Verify Transaction
   * GET /transaction/verify/:reference
   * 
   * @param {string} reference - Transaction reference
   * @returns {Promise<object>} Transaction details
   */
  async verifyTransaction(reference) {
    this._ensureConfigured();

    if (!reference) {
      throw new Error("Transaction reference is required");
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/transaction/verify/${reference}`,
        this._getConfig()
      );

      if (response.data.status) {
        const data = response.data.data;
        
        return {
          status: "success",
          data: {
            reference: data.reference,
            amount: data.amount / 100, // Convert back to major unit
            currency: data.currency,
            status: data.status, // "success", "failed", "abandoned"
            gateway_response: data.gateway_response,
            paid_at: data.paid_at,
            channel: data.channel,
            customer: data.customer,
            metadata: data.metadata,
            subaccount: data.subaccount,
          },
        };
      } else {
        throw new Error(response.data.message || "Transaction not found");
      }
    } catch (error) {
      console.error("Verify transaction error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Failed to verify transaction"
      );
    }
  }

  // ============================================================
  // CUSTOMER OPERATIONS
  // ============================================================

  /**
   * Create Customer
   * POST /customer
   * 
   * @param {object} params - Customer parameters
   * @returns {Promise<object>} Created customer with customer_code
   */
  async createCustomer({ email, first_name = "", last_name = "", phone = "", metadata = {} }) {
    this._ensureConfigured();

    if (!email) {
      throw new Error("Email is required");
    }

    const params = { email };
    if (first_name) params.first_name = first_name;
    if (last_name) params.last_name = last_name;
    if (phone) params.phone = phone;
    if (Object.keys(metadata).length > 0) params.metadata = metadata;

    try {
      const response = await axios.post(
        `${this.baseURL}/customer`,
        params,
        this._getConfig()
      );

      if (response.data.status) {
        return {
          status: "success",
          data: response.data.data,
        };
      } else {
        throw new Error(response.data.message || "Customer creation failed");
      }
    } catch (error) {
      console.error("Create customer error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Failed to create customer"
      );
    }
  }

  /**
   * List Customers
   * GET /customer
   * 
   * @param {number} perPage - Number of records per page
   * @param {number} page - Page number
   * @returns {Promise<object>} List of customers
   */
  async listCustomers(perPage = 50, page = 1) {
    this._ensureConfigured();

    try {
      const response = await axios.get(
        `${this.baseURL}/customer?perPage=${perPage}&page=${page}`,
        this._getConfig()
      );

      return {
        status: "success",
        data: response.data.data || [],
        meta: response.data.meta,
      };
    } catch (error) {
      console.error("List customers error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Failed to list customers"
      );
    }
  }

  /**
   * Fetch Customer
   * GET /customer/:email_or_code
   * 
   * @param {string} emailOrCode - Customer email or code (e.g., "CUS_xxxxx")
   * @returns {Promise<object>} Customer details
   */
  async fetchCustomer(emailOrCode) {
    this._ensureConfigured();

    if (!emailOrCode) {
      throw new Error("Customer email or code is required");
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/customer/${encodeURIComponent(emailOrCode)}`,
        this._getConfig()
      );

      if (response.data.status) {
        return {
          status: "success",
          data: response.data.data,
        };
      } else {
        throw new Error(response.data.message || "Customer not found");
      }
    } catch (error) {
      console.error("Fetch customer error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Failed to fetch customer"
      );
    }
  }

  /**
   * Update Customer
   * PUT /customer/:code
   * 
   * @param {string} code - Customer code (e.g., "CUS_xxxxx")
   * @param {object} updates - Fields to update
   * @returns {Promise<object>} Updated customer
   */
  async updateCustomer(code, updates) {
    this._ensureConfigured();

    if (!code) {
      throw new Error("Customer code is required");
    }

    try {
      const response = await axios.put(
        `${this.baseURL}/customer/${code}`,
        updates,
        this._getConfig()
      );

      if (response.data.status) {
        return {
          status: "success",
          data: response.data.data,
        };
      } else {
        throw new Error(response.data.message || "Customer update failed");
      }
    } catch (error) {
      console.error("Update customer error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Failed to update customer"
      );
    }
  }

  // ============================================================
  // TRANSFER RECIPIENT OPERATIONS (Required for Payouts)
  // ============================================================

  /**
   * Create Transfer Recipient
   * POST /transferrecipient
   * 
   * Creates a recipient that can receive transfers (payouts)
   * 
   * @param {object} params - Recipient parameters
   * @returns {Promise<object>} Created recipient with recipient_code
   */
  async createTransferRecipient({
    type = "ghipss", // "ghipss" for Ghana, "nuban" for Nigerian banks, "mobile_money" for mobile money
    name,
    account_number,
    bank_code,
    currency = "GHS",
    description = "",
    metadata = {},
  }) {
    this._ensureConfigured();

    if (!name) {
      throw new Error("Recipient name is required");
    }
    if (!account_number) {
      throw new Error("Account number is required");
    }
    if (!bank_code) {
      throw new Error("Bank code is required");
    }

    // Validate account number length based on country/type
    // Ghana (ghipss): 13 digits
    // Nigeria (nuban): 10 digits
    const cleanedAccountNumber = account_number.replace(/\s/g, "");
    if (type === "ghipss" && cleanedAccountNumber.length !== 13) {
      throw new Error("Ghana bank account numbers must be 13 digits");
    }
    if (type === "nuban" && cleanedAccountNumber.length !== 10) {
      throw new Error("Nigerian bank account numbers must be 10 digits");
    }

    const params = {
      type,
      name,
      account_number: cleanedAccountNumber,
      bank_code,
      currency,
    };

    if (description) params.description = description;
    if (Object.keys(metadata).length > 0) params.metadata = metadata;

    console.log("\n========================================");
    console.log("[Paystack] Creating Transfer Recipient");
    console.log("========================================");
    console.log("Name:", name);
    console.log("Account:", account_number);
    console.log("Bank Code:", bank_code);
    console.log("========================================\n");

    try {
      const response = await axios.post(
        `${this.baseURL}/transferrecipient`,
        params,
        this._getConfig()
      );

      if (response.data.status) {
        const data = response.data.data;
        console.log("✅ [Paystack] Transfer Recipient Created");
        console.log("   recipient_code:", data.recipient_code);
        console.log("");

        return {
          status: "success",
          data: {
            recipient_code: data.recipient_code,
            id: data.id,
            type: data.type,
            name: data.name,
            details: data.details,
            currency: data.currency,
            active: data.active,
          },
        };
      } else {
        throw new Error(response.data.message || "Recipient creation failed");
      }
    } catch (error) {
      console.error("Create transfer recipient error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Failed to create transfer recipient"
      );
    }
  }

  /**
   * List Transfer Recipients
   * GET /transferrecipient
   * 
   * @param {number} perPage - Number of records per page
   * @param {number} page - Page number
   * @returns {Promise<object>} List of recipients
   */
  async listTransferRecipients(perPage = 50, page = 1) {
    this._ensureConfigured();

    try {
      const response = await axios.get(
        `${this.baseURL}/transferrecipient?perPage=${perPage}&page=${page}`,
        this._getConfig()
      );

      return {
        status: "success",
        data: response.data.data || [],
        meta: response.data.meta,
      };
    } catch (error) {
      console.error("List transfer recipients error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Failed to list transfer recipients"
      );
    }
  }

  /**
   * Fetch Transfer Recipient
   * GET /transferrecipient/:id_or_code
   * 
   * @param {string} idOrCode - Recipient ID or code (e.g., "RCP_xxxxx")
   * @returns {Promise<object>} Recipient details
   */
  async fetchTransferRecipient(idOrCode) {
    this._ensureConfigured();

    if (!idOrCode) {
      throw new Error("Recipient ID or code is required");
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/transferrecipient/${idOrCode}`,
        this._getConfig()
      );

      if (response.data.status) {
        return {
          status: "success",
          data: response.data.data,
        };
      } else {
        throw new Error(response.data.message || "Recipient not found");
      }
    } catch (error) {
      console.error("Fetch transfer recipient error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Failed to fetch transfer recipient"
      );
    }
  }

  /**
   * Delete Transfer Recipient
   * DELETE /transferrecipient/:id_or_code
   * 
   * @param {string} idOrCode - Recipient ID or code
   * @returns {Promise<object>} Deletion result
   */
  async deleteTransferRecipient(idOrCode) {
    this._ensureConfigured();

    if (!idOrCode) {
      throw new Error("Recipient ID or code is required");
    }

    try {
      const response = await axios.delete(
        `${this.baseURL}/transferrecipient/${idOrCode}`,
        this._getConfig()
      );

      return {
        status: "success",
        message: response.data.message || "Recipient deleted",
      };
    } catch (error) {
      console.error("Delete transfer recipient error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Failed to delete transfer recipient"
      );
    }
  }

  // ============================================================
  // TRANSFER OPERATIONS (Payouts)
  // ============================================================

  /**
   * Initiate Transfer (Payout)
   * POST /transfer
   * 
   * Send money to a transfer recipient
   * 
   * @param {object} params - Transfer parameters
   * @returns {Promise<object>} Transfer details
   */
  async initiateTransfer({
    amount,
    recipient,
    reason = "Payout",
    reference = null,
    currency = "GHS",
  }) {
    this._ensureConfigured();

    if (!amount) {
      throw new Error("Amount is required");
    }
    if (!recipient) {
      throw new Error("Recipient code is required");
    }

    // Convert amount to smallest currency unit
    const amountInSmallestUnit = Math.round(amount * 100);

    const params = {
      source: "balance",
      amount: amountInSmallestUnit,
      recipient,
      reason,
      currency,
    };

    if (reference) {
      params.reference = reference;
    }

    console.log("\n========================================");
    console.log("[Paystack] Initiating Transfer (Payout)");
    console.log("========================================");
    console.log("Amount:", amount, currency, `(${amountInSmallestUnit} smallest unit)`);
    console.log("Recipient:", recipient);
    console.log("Reason:", reason);
    console.log("========================================\n");

    try {
      const response = await axios.post(
        `${this.baseURL}/transfer`,
        params,
        this._getConfig()
      );

      if (response.data.status) {
        const data = response.data.data;
        console.log("✅ [Paystack] Transfer Initiated");
        console.log("   transfer_code:", data.transfer_code);
        console.log("   reference:", data.reference);
        console.log("   status:", data.status);
        console.log("");

        return {
          status: "success",
          data: {
            transfer_code: data.transfer_code,
            reference: data.reference,
            amount: data.amount / 100,
            currency: data.currency,
            status: data.status, // "pending", "success", "failed"
            recipient: data.recipient,
            reason: data.reason,
            createdAt: data.createdAt,
          },
        };
      } else {
        throw new Error(response.data.message || "Transfer initiation failed");
      }
    } catch (error) {
      console.error("\n❌ [Paystack] Transfer Failed");
      console.error("   Error:", error.response?.data?.message || error.message);
      console.error("");

      throw new Error(
        error.response?.data?.message || "Failed to initiate transfer"
      );
    }
  }

  /**
   * List Transfers
   * GET /transfer
   * 
   * @param {object} options - Query options
   * @returns {Promise<object>} List of transfers
   */
  async listTransfers({ perPage = 50, page = 1, status = null } = {}) {
    this._ensureConfigured();

    try {
      let url = `${this.baseURL}/transfer?perPage=${perPage}&page=${page}`;
      if (status) {
        url += `&status=${status}`;
      }

      const response = await axios.get(url, this._getConfig());

      return {
        status: "success",
        data: response.data.data || [],
        meta: response.data.meta,
      };
    } catch (error) {
      console.error("List transfers error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Failed to list transfers"
      );
    }
  }

  /**
   * Fetch Transfer
   * GET /transfer/:id_or_code
   * 
   * @param {string} idOrCode - Transfer ID or code (e.g., "TRF_xxxxx")
   * @returns {Promise<object>} Transfer details
   */
  async fetchTransfer(idOrCode) {
    this._ensureConfigured();

    if (!idOrCode) {
      throw new Error("Transfer ID or code is required");
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/transfer/${idOrCode}`,
        this._getConfig()
      );

      if (response.data.status) {
        const data = response.data.data;
        return {
          status: "success",
          data: {
            ...data,
            amount: data.amount / 100, // Convert to major unit
          },
        };
      } else {
        throw new Error(response.data.message || "Transfer not found");
      }
    } catch (error) {
      console.error("Fetch transfer error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Failed to fetch transfer"
      );
    }
  }

  /**
   * Verify Transfer
   * GET /transfer/verify/:reference
   * 
   * @param {string} reference - Transfer reference
   * @returns {Promise<object>} Transfer verification result
   */
  async verifyTransfer(reference) {
    this._ensureConfigured();

    if (!reference) {
      throw new Error("Transfer reference is required");
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/transfer/verify/${reference}`,
        this._getConfig()
      );

      if (response.data.status) {
        const data = response.data.data;
        return {
          status: "success",
          data: {
            reference: data.reference,
            amount: data.amount / 100,
            currency: data.currency,
            status: data.status,
            recipient: data.recipient,
            reason: data.reason,
            transfer_code: data.transfer_code,
            transferred_at: data.transferred_at,
          },
        };
      } else {
        throw new Error(response.data.message || "Transfer not found");
      }
    } catch (error) {
      console.error("Verify transfer error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Failed to verify transfer"
      );
    }
  }

  /**
   * Check Paystack Balance
   * GET /balance
   * 
   * Check available balance before initiating transfers
   * 
   * @returns {Promise<object>} Balance details
   */
  async checkBalance() {
    this._ensureConfigured();

    try {
      const response = await axios.get(
        `${this.baseURL}/balance`,
        this._getConfig()
      );

      if (response.data.status) {
        // Convert amounts to major units
        const balances = response.data.data.map(b => ({
          currency: b.currency,
          balance: b.balance / 100,
        }));

        return {
          status: "success",
          data: balances,
        };
      } else {
        throw new Error(response.data.message || "Failed to fetch balance");
      }
    } catch (error) {
      console.error("Check balance error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Failed to check balance"
      );
    }
  }

  // ============================================================
  // WEBHOOK VERIFICATION
  // ============================================================

  /**
   * Verify Webhook Signature
   * 
   * @param {string} payload - Raw request body
   * @param {string} signature - x-paystack-signature header
   * @returns {boolean} Whether signature is valid
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.secretKey) return false;

    const hash = crypto
      .createHmac("sha512", this.secretKey)
      .update(payload)
      .digest("hex");

    return hash === signature;
  }
}

// Export singleton instance
module.exports = new PaystackService();
