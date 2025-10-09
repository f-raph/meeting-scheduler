const paystack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);

class PaymentService {
  async initializePayment(amount, email, metadata = {}) {
    try {
      const response = await paystack.transaction.initialize({
        amount: Math.round(amount * 100), // Convert to kobo (smallest currency unit)
        email,
        metadata,
        callback_url: `${process.env.CLIENT_URL}/payment/callback`,
      });

      return response;
    } catch (error) {
      console.error('Initialize payment error:', error);
      throw new Error('Failed to initialize payment');
    }
  }

  async verifyPayment(reference) {
    try {
      const response = await paystack.transaction.verify(reference);
      return response;
    } catch (error) {
      console.error('Verify payment error:', error);
      throw new Error('Failed to verify payment');
    }
  }

  async processRefund(transactionId, amount = null, reason = 'requested_by_customer') {
    try {
      const refundData = {
        transaction: transactionId,
        reason
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to kobo
      }

      const refund = await paystack.refund.create(refundData);
      return refund;
    } catch (error) {
      console.error('Process refund error:', error);
      throw new Error('Failed to process refund');
    }
  }

  async createCustomer(email, first_name, last_name, phone = null) {
    try {
      const customer = await paystack.customer.create({
        email,
        first_name,
        last_name,
        phone
      });

      return customer;
    } catch (error) {
      console.error('Create customer error:', error);
      throw new Error('Failed to create customer');
    }
  }

  async getCustomerTransactions(customerId) {
    try {
      const transactions = await paystack.transaction.list({
        customer: customerId,
      });

      return transactions.data;
    } catch (error) {
      console.error('Get customer transactions error:', error);
      throw new Error('Failed to get customer transactions');
    }
  }

  async listTransactions(page = 1, perPage = 50) {
    try {
      const transactions = await paystack.transaction.list({
        page,
        perPage
      });

      return transactions;
    } catch (error) {
      console.error('List transactions error:', error);
      throw new Error('Failed to list transactions');
    }
  }

  async getBanks() {
    try {
      const banks = await paystack.misc.list_banks();
      return banks;
    } catch (error) {
      console.error('Get banks error:', error);
      throw new Error('Failed to get banks');
    }
  }

  // Utility method to format amount for display
  formatAmount(amount, currency = 'NGN') {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  // Utility method to calculate Paystack fees
  calculatePaystackFees(amount) {
    // Paystack fees: 1.5% + ₦100 for Nigerian cards, 3.9% for international cards
    // This is a simplified calculation for Nigerian cards
    const percentageFee = amount * 0.015;
    const fixedFee = 100 / 100; // Convert kobo to naira
    const totalFee = percentageFee + fixedFee;
    
    // Cap at ₦2000
    return Math.min(totalFee, 2000);
  }

  // Verify webhook signature
  verifyWebhookSignature(payload, signature) {
    const crypto = require('crypto');
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
                      .update(JSON.stringify(payload))
                      .digest('hex');
    
    return hash === signature;
  }
}

module.exports = new PaymentService();