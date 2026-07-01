const crypto = require('crypto');
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
 * Verify the X-Hub-Signature-256 header from Meta to ensure
 * the request is authentic and not forged by a third party.
 *
 * CRITICAL #2 — Without this check, anyone on the internet can send fake
 * delivery status events (e.g. fake "delivered") to manipulate the OTP
 * fallback pipeline and prevent users from receiving their OTPs.
 *
 * @param {Buffer} rawBody - The raw, unparsed request body buffer
 * @param {string} signatureHeader - The value of x-hub-signature-256
 * @returns {boolean}
 */
const verifyMetaSignature = (rawBody, signatureHeader) => {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!appSecret) {
    console.error('❌ WHATSAPP_APP_SECRET is not configured. Cannot verify webhook signature. Rejecting request for safety.');
    return false;
  }

  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    console.warn('⚠️ Missing or malformed x-hub-signature-256 header. Rejecting request.');
    return false;
  }

  const receivedSignature = signatureHeader.slice('sha256='.length);
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  // Use timingSafeEqual to prevent timing-based side-channel attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
};

/**
 * Real-time event receiver endpoint (POST)
 * Meta posts delivery statuses here.
 */
const receiveWebhookEvent = async (req, res) => {
  try {
    // CRITICAL #2 — Verify Meta's HMAC signature before processing any payload.
    // req.rawBody must be populated by a bodyParser rawBody option or equivalent middleware.
    const signatureHeader = req.headers['x-hub-signature-256'];
    const rawBody = req.rawBody;

    if (!rawBody) {
      console.error('❌ req.rawBody is not available. Ensure bodyParser is configured to expose rawBody.');
      return res.sendStatus(500);
    }

    if (!verifyMetaSignature(rawBody, signatureHeader)) {
      console.warn('🚫 Webhook request rejected: invalid or missing signature.');
      return res.sendStatus(401);
    }

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

module.exports = {
  verifyWebhook,
  receiveWebhookEvent
};
