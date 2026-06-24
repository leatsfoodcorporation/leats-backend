const axios = require('axios');

/**
 * Send OTP via WhatsApp API (Meta Cloud API or Twilio WhatsApp API)
 * @param {string} phoneNumber - Recipient's phone number with country code (e.g., "+919876543210")
 * @param {string} otp - 6-digit verification code
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
const sendWhatsAppOTP = async (phoneNumber, otp) => {
  try {
    const isEnabled = process.env.WHATSAPP_ENABLED === 'true';
    if (!isEnabled) {
      console.log('⚠️ WhatsApp OTP is disabled in configuration. Skipping dispatch.');
      return { success: false, error: 'WhatsApp OTP is disabled' };
    }

    if (!phoneNumber || !otp) {
      console.error('❌ Missing phoneNumber or OTP for WhatsApp dispatch');
      return { success: false, error: 'Missing phoneNumber or OTP' };
    }

    // Format phone number to ensure it has '+' sign for validation checks
    let formattedPhone = phoneNumber.trim();
    if (!formattedPhone.startsWith('+')) {
      // Default to India country code if no country code provided and it's a 10 digit number
      if (formattedPhone.length === 10) {
        formattedPhone = `+91${formattedPhone}`;
      } else {
        formattedPhone = `+${formattedPhone}`;
      }
    }

    const provider = (process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase();
    console.log(`💬 Preparing WhatsApp OTP dispatch via ${provider.toUpperCase()} to: ${formattedPhone}`);

    if (provider === 'meta') {
      return await sendViaMetaCloudAPI(formattedPhone, otp);
    } else if (provider === 'twilio') {
      return await sendViaTwilioREST(formattedPhone, otp);
    } else {
      throw new Error(`Unsupported WhatsApp provider: ${provider}`);
    }
  } catch (error) {
    console.error('❌ WhatsApp OTP dispatch error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Dispatch message using Meta WhatsApp Cloud API
 */
const sendViaMetaCloudAPI = async (phoneNumber, otp) => {
  const apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'otp_verification';

  if (!phoneId || !accessToken) {
    throw new Error('Meta WhatsApp configuration missing (WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN)');
  }

  // Meta expects phone numbers without the leading '+'
  const cleanPhone = phoneNumber.replace('+', '');
  const url = `${apiUrl}/${phoneId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: cleanPhone,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: "en_US"
      },
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: otp
            }
          ]
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [
            {
              type: "text",
              text: otp
            }
          ]
        }
      ]
    }
  };

  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (response.data && response.data.messages && response.data.messages.length > 0) {
    const messageId = response.data.messages[0].id;
    console.log(`✅ Meta WhatsApp OTP sent. Message ID: ${messageId}`);
    
    try {
      const { whatsappTracker } = require('./whatsappTracker');
      whatsappTracker.register(messageId, phoneNumber, otp);
    } catch (trackerErr) {
      console.error('⚠️ Failed to register message with WhatsApp tracker:', trackerErr.message);
    }

    return { success: true, messageId };
  }

  throw new Error('Meta API completed but returned no message ID');
};

/**
 * Dispatch message using Twilio WhatsApp API (via REST directly to avoid package dependency)
 */
const sendViaTwilioREST = async (phoneNumber, otp) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const senderNumber = process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886';

  if (!accountSid || !authToken) {
    throw new Error('Twilio configuration missing (TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN)');
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  
  // Format numbers with prefix "whatsapp:" for Twilio
  const twilioTo = `whatsapp:${phoneNumber}`;
  const twilioFrom = senderNumber.startsWith('whatsapp:') ? senderNumber : `whatsapp:${senderNumber}`;

  // Form url-encoded data
  const params = new URLSearchParams();
  params.append('To', twilioTo);
  params.append('From', twilioFrom);
  params.append('Body', `Your verification code is ${otp}. It is valid for 10 minutes.`);

  const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const response = await axios.post(url, params, {
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  if (response.data && response.data.sid) {
    console.log(`✅ Twilio WhatsApp OTP sent. Message SID: ${response.data.sid}`);
    return { success: true, messageId: response.data.sid };
  }

  throw new Error('Twilio API completed but returned no message SID');
};

module.exports = { sendWhatsAppOTP };
