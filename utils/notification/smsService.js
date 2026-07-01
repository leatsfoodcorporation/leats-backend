const axios = require('axios');

/**
 * Send OTP via standard Twilio SMS API
 * @param {string} phoneNumber - Recipient's phone number with country code (e.g., "+919876543210")
 * @param {string} otp - 6-digit verification code
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
const sendSMS = async (phoneNumber, otp) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const senderNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !senderNumber) {
      console.log('⚠️ Twilio credentials or TWILIO_PHONE_NUMBER missing. Running developer console log fallback.');
      console.log(`📱 [SMS-Fallback-Log] OTP for ${phoneNumber}: ${otp}`);
      return { success: true, messageId: `mock_sms_sid_${Date.now()}` };
    }

    // Ensure phone number has country code (e.g., must start with +)
    let formattedPhone = phoneNumber.trim();
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.length === 10) {
        formattedPhone = `+91${formattedPhone}`;
      } else {
        formattedPhone = `+${formattedPhone}`;
      }
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    // For standard SMS, do NOT append 'whatsapp:' prefix
    const params = new URLSearchParams();
    params.append('To', formattedPhone);
    params.append('From', senderNumber);
    params.append('Body', `Your verification code is ${otp}. It is valid for 10 minutes.`);

    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    console.log(`💬 Dispatching SMS Fallback to: ${formattedPhone} via Twilio...`);
    const response = await axios.post(url, params, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (response.data && response.data.sid) {
      console.log(`✅ Twilio SMS OTP sent. Message SID: ${response.data.sid}`);
      return { success: true, messageId: response.data.sid };
    }

    throw new Error('Twilio SMS API completed but returned no message SID');
  } catch (error) {
    console.error('❌ Twilio SMS dispatch error:', error.response ? error.response.data : error.message);
    // As a final safety net, log to the console so flow isn't entirely broken during development
    console.log(`📱 [Emergency-SMS-Fallback-Log] OTP for ${phoneNumber}: ${otp}`);
    return { success: false, error: error.message };
  }
};

module.exports = { sendSMS };
