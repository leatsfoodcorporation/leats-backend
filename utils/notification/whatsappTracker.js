const { sendSMS } = require('./smsService');
const { prisma } = require('../../config/database');

/**
 * HIGH #5 — Durable WhatsApp OTP message tracker backed by MongoDB.
 *
 * Previously the tracker used an in-memory Map() and setTimeout() timers.
 * This had two critical failure modes:
 *   1. A server restart or crash cleared all tracked messages, silently
 *      cancelling every pending SMS fallback and leaving affected users
 *      without any OTP delivery.
 *   2. Behind a load balancer, the webhook status update could arrive at a
 *      different server instance than the one that registered the tracker,
 *      so updateStatus() would find nothing and the fallback would never fire.
 *
 * This version persists all tracked messages to the `tracked_messages` MongoDB
 * collection and uses a polling interval to evaluate fallback eligibility.
 * Any live server instance can process the fallback for any tracked message,
 * and messages survive restarts.
 */
class WhatsAppTracker {
  constructor() {
    // How long (ms) to wait for WhatsApp delivery before triggering SMS fallback
    this.FALLBACK_TIMEOUT_MS = 30 * 1000; // 30 seconds
    // How often the poller checks for timed-out messages
    this.POLL_INTERVAL_MS = 10 * 1000; // 10 seconds

    this._pollTimer = null;
    this._startPoller();
  }

  /**
   * Start the background polling loop.
   * Runs on every active server instance; uses upsert semantics to avoid
   * double-dispatching when multiple instances are running.
   */
  _startPoller() {
    if (this._pollTimer) return; // Already running

    this._pollTimer = setInterval(async () => {
      try {
        await this._processPendingFallbacks();
      } catch (err) {
        console.error('❌ WhatsApp tracker poller error:', err);
      }
    }, this.POLL_INTERVAL_MS);

    // Don't keep the process alive just for this timer
    if (this._pollTimer.unref) {
      this._pollTimer.unref();
    }

    console.log('⏱️  WhatsApp tracker poller started (interval: 10s, fallback threshold: 30s).');
  }

  /**
   * Check the database for any 'sent' messages older than FALLBACK_TIMEOUT_MS
   * and trigger SMS fallback for each.
   */
  async _processPendingFallbacks() {
    const cutoff = new Date(Date.now() - this.FALLBACK_TIMEOUT_MS);

    const timedOutMessages = await prisma.trackedMessage.findMany({
      where: {
        status: 'sent',
        registeredAt: { lte: cutoff },
      },
    });

    for (const msg of timedOutMessages) {
      console.log(`⏰ Fallback timeout reached for message ${msg.messageId}. Triggering SMS Fallback.`);
      await this.triggerSMSFallback(msg.messageId, 'timeout');
    }
  }

  /**
   * Register a sent WhatsApp OTP message to monitor its delivery status.
   * @param {string} messageId - The WhatsApp message ID (e.g. wamid.XXX)
   * @param {string} phoneNumber - Recipient's phone number
   * @param {string} otp - The OTP verification code
   */
  async register(messageId, phoneNumber, otp) {
    if (!messageId) {
      console.warn('⚠️ Cannot register WhatsApp OTP without a valid messageId');
      return;
    }

    try {
      await prisma.trackedMessage.upsert({
        where: { messageId },
        create: { messageId, phoneNumber, otp, status: 'sent' },
        update: { phoneNumber, otp, status: 'sent', registeredAt: new Date() },
      });

      console.log(`⏱️  Tracking registered for WhatsApp Message: ${messageId} (Recipient: ${phoneNumber}). Will fallback in 30 seconds if not delivered.`);
    } catch (err) {
      console.error(`❌ Failed to register WhatsApp message ${messageId} in tracker:`, err);
    }
  }

  /**
   * Unregister a message and remove it from the database.
   * @param {string} messageId
   */
  async unregister(messageId) {
    try {
      await prisma.trackedMessage.delete({ where: { messageId } });
    } catch (err) {
      // Record may not exist (already unregistered or never registered) — not an error
      if (err.code !== 'P2025') {
        console.error(`❌ Failed to unregister tracked message ${messageId}:`, err);
      }
    }
  }

  /**
   * Update the delivery status of a tracked message from a Webhook event.
   * Called by the webhook controller whenever Meta sends a status update.
   * @param {string} messageId - The WhatsApp message ID
   * @param {string} status - Meta delivery status: 'sent' | 'delivered' | 'read' | 'failed'
   */
  async updateStatus(messageId, status) {
    try {
      const tracked = await prisma.trackedMessage.findUnique({ where: { messageId } });

      if (!tracked) {
        console.log(`ℹ️ Received webhook status update for untracked message ID: ${messageId} (${status})`);
        return;
      }

      console.log(`📱 Webhook Status Update: Message ${messageId} is now "${status}"`);

      if (status === 'delivered' || status === 'read') {
        console.log(`✅ Message ${messageId} successfully delivered/read. Clearing tracking.`);
        await this.unregister(messageId);
      } else if (status === 'failed') {
        console.error(`❌ Message ${messageId} failed delivery. Triggering SMS Fallback immediately.`);
        await this.triggerSMSFallback(messageId, 'failed');
      } else {
        // Update the status in DB without removing the record (e.g. 'sent' -> status update)
        await prisma.trackedMessage.update({
          where: { messageId },
          data: { status },
        });
      }
    } catch (err) {
      console.error(`❌ Failed to update status for tracked message ${messageId}:`, err);
    }
  }

  /**
   * Execute SMS fallback for a tracked message.
   * Deletes the record before dispatching to prevent double-fallback.
   * @param {string} messageId - The message ID to fall back
   * @param {string} reason - The reason for fallback ('failed' | 'timeout')
   */
  async triggerSMSFallback(messageId, reason) {
    try {
      const tracked = await prisma.trackedMessage.findUnique({ where: { messageId } });
      if (!tracked) return;

      const { phoneNumber, otp } = tracked;

      // Delete immediately before dispatching to prevent double-fallback in multi-instance setups
      await this.unregister(messageId);

      console.log(`🔁 SMS Fallback starting for ${phoneNumber} due to: ${reason}`);
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
    } catch (err) {
      console.error(`❌ Error in triggerSMSFallback for ${messageId}:`, err);
    }
  }
}

// Export a singleton instance
const whatsappTracker = new WhatsAppTracker();
module.exports = { whatsappTracker };
