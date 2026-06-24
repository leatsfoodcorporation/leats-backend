const { whatsappTracker } = require('../../utils/notification/whatsappTracker');

/**
 * Verification handshake endpoint (GET)
 * Meta requires this to validate the server webhook URL.
 */
const verifyWebhook = (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Retrieve secret token from environment configuration
    const MY_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'YOUR_CHOSEN_WEBHOOK_SECRET';

    if (mode === 'subscribe' && token === MY_VERIFY_TOKEN) {
      console.log('✅ WhatsApp Webhook Handshake verified successfully!');
      return res.status(200).send(challenge);
    }

    console.warn('⚠️ WhatsApp Webhook Handshake verification failed: Invalid verify token or mode.');
    return res.sendStatus(403);
  } catch (error) {
    console.error('❌ WhatsApp Webhook Handshake error:', error);
    return res.sendStatus(500);
  }
};

/**
 * Real-time event receiver endpoint (POST)
 * Meta posts delivery statuses here.
 */
const receiveWebhookEvent = async (req, res) => {
  try {
    const body = req.body;

    // Verify it is a WhatsApp webhook payload
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      if (value?.statuses && value.statuses.length > 0) {
        for (const statusUpdate of value.statuses) {
          const messageId = statusUpdate.id;
          const status = statusUpdate.status; // "sent", "delivered", "read", or "failed"
          const recipientNumber = statusUpdate.recipient_id;

          console.log(`💬 WhatsApp status update for ${messageId} to ${recipientNumber}: ${status}`);
          
          // Forward status to the tracker to monitor fallback / delivery success
          await whatsappTracker.updateStatus(messageId, status);
        }
      }

      // Return 200 OK immediately so Meta does not retry / flood the server
      return res.status(200).send('EVENT_RECEIVED');
    }

    // Return 404 if not matching WhatsApp events
    return res.sendStatus(404);
  } catch (error) {
    console.error('❌ Error processing WhatsApp Webhook POST event:', error);
    // Return 200/500 depending on resilience choice. We return 200 to prevent retry loops on bad payloads.
    return res.status(200).send('ERROR_HANDLED');
  }
};

/**
 * Debug endpoint to view active tracked messages
 */
const getTrackedMessages = (req, res) => {
  try {
    const tracked = whatsappTracker.getPendingMessages();
    return res.status(200).json({
      success: true,
      count: tracked.length,
      tracked
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  verifyWebhook,
  receiveWebhookEvent,
  getTrackedMessages
};
