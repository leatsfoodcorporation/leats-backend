const express = require('express');
const {
  mobileRegister,
  verifyOTP,
  resendOTP,
  mobileLogin,
  sendOTPByPhone,
  verifyOTPByPhone,
  resetPasswordPhoneOTP,
  resetPasswordEmailOTP,
  mobileForgotPassword,
  verifyResetOTP,
} = require('../../controllers/auth/mobileAuthController');

// Import Phone Auth Controller
const {
  phoneRegister,
  phoneLogin,
} = require('../../controllers/auth/phoneAuthController');

// Import Mobile Forgot Password Controller
const {
  resetPasswordWithPhone,
} = require('../../controllers/auth/mobileForgotPasswordController');

const router = express.Router();

// ============================================
// MOBILE APP SPECIFIC ROUTES
// ============================================

/**
 * Mobile App Registration with OTP
 * POST /api/auth/mobile/register
 * Body: { email, password, name, phoneNumber }
 * Response: { success, message, data: { id, email, name, role, otpSent } }
 */
router.post('/register', mobileRegister);

/**
 * Verify OTP for Mobile App
 * POST /api/auth/mobile/verify-otp
 * Body: { email, otp }
 * Response: { success, message, data: { id, email, name, isVerified, role } }
 */
router.post('/verify-otp', verifyOTP);

/**
 * Resend OTP for Mobile App
 * POST /api/auth/mobile/resend-otp
 * Body: { email }
 * Response: { success, message, data: { email, otpSent } }
 */
router.post('/resend-otp', resendOTP);

/**
 * Mobile App Login
 * POST /api/auth/mobile/login
 * Body: { email, password, fcmToken? }
 * Response: { success, message, data: { token, user } }
 */
router.post('/login', mobileLogin);

/**
 * Mobile Forgot Password - Send OTP to Email
 * POST /api/auth/mobile/forgot-password
 * Body: { email }
 * Response: { success, message, data: { email, otpSent } }
 */
router.post('/forgot-password', mobileForgotPassword);

/**
 * Verify Reset Password OTP (without resetting password)
 * POST /api/auth/mobile/verify-reset-otp
 * Body: { email, otp }
 * Response: { success, message }
 */
router.post('/verify-reset-otp', verifyResetOTP);

/**
 * Reset Password using Email and OTP
 * POST /api/auth/mobile/reset-password-email-otp
 * Body: { email, otp, newPassword }
 * Response: { success, message }
 * 
 * Note: First call /forgot-password to send OTP, then use this endpoint with OTP
 */
router.post('/reset-password-email-otp', resetPasswordEmailOTP);

// ============================================
// PHONE-BASED EMAIL OTP ROUTES (No SMS)
// ============================================

/**
 * Send OTP to Email based on Phone Number
 * POST /api/auth/mobile/send-otp-phone
 * Body: { phoneNumber }
 * Response: { success, message, data: { phoneNumber, email (masked), otpSent } }
 * 
 * Note: Finds user by phone number and sends OTP to their registered email
 */
router.post('/send-otp-phone', sendOTPByPhone);

/**
 * Verify OTP by Phone Number (Login)
 * POST /api/auth/mobile/verify-otp-phone
 * Body: { phoneNumber, otp }
 * Response: { success, message, data: { token, user } }
 * 
 * Note: Verifies OTP and logs in user
 */
router.post('/verify-otp-phone', verifyOTPByPhone);

/**
 * Reset Password using Phone Number and OTP
 * POST /api/auth/mobile/reset-password-phone-otp
 * Body: { phoneNumber, otp, newPassword }
 * Response: { success, message }
 * 
 * Note: First call /send-otp-phone, then use this endpoint with OTP
 */
router.post('/reset-password-phone-otp', resetPasswordPhoneOTP);

// ============================================
// PHONE AUTHENTICATION ROUTES (Firebase SMS OTP)
// ============================================

/**
 * Register with Phone Verification (Firebase SMS OTP)
 * POST /api/auth/mobile/phone-register
 * Body: { name, email, phoneNumber, password, firebaseToken }
 * Response: { success, message, data: { token, user } }
 * 
 * Note: firebaseToken is obtained after Firebase phone verification on client
 */
router.post('/phone-register', phoneRegister);

/**
 * Login with Phone Verification (Firebase SMS OTP)
 * POST /api/auth/mobile/phone-login
 * Body: { phoneNumber, firebaseToken, fcmToken? }
 * Response: { success, message, data: { token, user } }
 * 
 * Note: firebaseToken is obtained after Firebase phone verification on client
 */
router.post('/phone-login', phoneLogin);

// ============================================
// FORGOT PASSWORD ROUTES (Firebase SMS OTP)
// ============================================

/**
 * Reset Password with Phone Verification (Firebase SMS OTP)
 * POST /api/auth/mobile/reset-password-phone
 * Body: { phoneNumber, newPassword, firebaseToken }
 * Response: { success, message }
 * 
 * Note: firebaseToken is obtained after Firebase phone verification on client
 */
router.post('/reset-password-phone', resetPasswordWithPhone);

module.exports = router;
