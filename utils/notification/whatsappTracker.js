const { sendSMS } = require('./smsService');

class WhatsAppTracker {
  constructor() {
    this.pendingMessages = new Map();
  }

  /**
   * Register a sent WhatsApp OTP message to monitor its delivery status
   * @param {string} messageId - The WhatsApp message ID (e.g. wamid.XXX)
   * @param {string} phoneNumber - Recipient's phone number
   * @param {string} otp - The OTP verification code
   */
  register(messageId, phoneNumber, otp) {
    if (!messageId) {
      console.warn('⚠️ Cannot register WhatsApp OTP without a valid messageId');
      return;
    }

    // Clear any existing tracking for this message ID
    this.unregister(messageId);

    console.log(`⏱️  Tracking registered for WhatsApp Message: ${messageId} (Recipient: ${phoneNumber}). Will fallback in 30 seconds if not delivered.`);

    const timeoutId = setTimeout(async () => {
      console.log(`⏰ 30s Timeout reached for message ${messageId}. Triggering SMS Fallback.`);
      await this.triggerSMSFallback(messageId, 'timeout');
    }, 30000);

    this.pendingMessages.set(messageId, {
      phoneNumber,
      otp,
      status: 'sent',
      registeredAt: new Date(),
      timeoutId
    });
  }

  /**
   * Unregister a message ID and clear its timeout
   * @param {string} messageId 
   */
  unregister(messageId) {
    const tracked = this.pendingMessages.get(messageId);
    if (tracked) {
      if (tracked.timeoutId) {
        clearTimeout(tracked.timeoutId);
      }
      this.pendingMessages.delete(messageId);
    }
  }

  /**
   * Update the status of a tracked message from a Webhook update event
   * @param {string} messageId - The WhatsApp message ID
   * @param {string} status - Meta delivery status ('sent', 'delivered', 'read', 'failed')
   */
  async updateStatus(messageId, status) {
    const tracked = this.pendingMessages.get(messageId);
    if (!tracked) {
      console.log(`ℹ️ Received webhook status update for untracked message ID: ${messageId} (${status})`);
      return;
    }

    console.log(`📱 Webhook Status Update: Message ${messageId} is now "${status}"`);
    tracked.status = status;

    if (status === 'delivered' || status === 'read') {
      console.log(`✅ Message ${messageId} successfully delivered/read. Clearing tracking.`);
      this.unregister(messageId);
    } else if (status === 'failed') {
      console.error(`❌ Message ${messageId} failed delivery. Triggering SMS Fallback immediately.`);
      await this.triggerSMSFallback(messageId, 'failed');
    }
  }

  /**
   * Execute SMS fallback for a tracked message
   * @param {string} messageId - The message ID to fall back
   * @param {string} reason - The reason for fallback ('failed' or 'timeout')
   */
  async triggerSMSFallback(messageId, reason) {
    const tracked = this.pendingMessages.get(messageId);
    if (!tracked) {
      return;
    }

    const { phoneNumber, otp } = tracked;
    
    // Clear tracking immediately to avoid double dispatch
    this.unregister(messageId);

    console.log(`🔁 SMS Fallback loop starting for ${phoneNumber} due to: ${reason}`);
    try {
      const result = await sendSMS(phoneNumber, otp);
      if (result.success) {
        console.log(`✅ SMS Fallback successfully dispatched. SID: ${result.messageId}`);
      } else {
        console.error(`❌ SMS Fallback dispatch failed: ${result.error}`);
      }
    } catch (err) {
      console.error(`❌ Fatal error executing SMS fallback:`, err);
    }
  }

  /**
   * Get all currently pending/tracked messages (for debug/diagnostics)
   */
  getPendingMessages() {
    const list = [];
    for (const [messageId, details] of this.pendingMessages.entries()) {
      list.push({
        messageId,
        phoneNumber: details.phoneNumber,
        otp: details.otp,
        status: details.status,
        registeredAt: details.registeredAt,
        timeElapsedMs: Date.now() - details.registeredAt.getTime()
      });
    }
    return list;
  }
}

// Export a singleton instance
const whatsappTracker = new WhatsAppTracker();
module.exports = { whatsappTracker };
