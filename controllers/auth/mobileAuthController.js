const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { prisma } = require("../../config/database");
const sessionManager = require("../../utils/auth/sessionManager");
const { sendEmail: sendSMTPEmail, sendEmailWithEnv } = require("../../config/connectSMTP");
const { sendNewUserRegistrationAlert, sendWelcomeNotification } = require("../../utils/notification/sendNotification");
const { sendWhatsAppOTP } = require("../../utils/notification/whatsappService");

// Email helper - uses SMTP configuration
const sendEmail = async (emailData) => {
  try {
    console.log("📧 Attempting to send email to:", emailData.to);

    // Get active email configuration from database
    const emailConfig = await prisma.emailConfiguration.findFirst({
      where: { isActive: true }
    });

    let result;

    if (emailConfig) {
      // Use database SMTP configuration
      console.log("📧 Using database SMTP configuration");
      result = await sendSMTPEmail(emailConfig, {
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text || emailData.html?.replace(/<[^>]*>/g, '') // Strip HTML for text version
      });
    } else {
      // Fallback to environment variables
      console.log("📧 Using environment SMTP configuration");
      result = await sendEmailWithEnv({
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text || emailData.html?.replace(/<[^>]*>/g, '')
      });
    }

    if (result.success) {
      console.log("✅ Email sent successfully to:", emailData.to);
    } else {
      console.error("❌ Failed to send email:", result.message);
    }

    return result;
  } catch (error) {
    console.error("❌ Email sending error:", error);
    return { success: false, message: error.message };
  }
};

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// Generate 6-digit OTP
const generateOTP = () => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`🔢 Generated OTP: "${otp}" (type: ${typeof otp})`);
  return otp;
};

// Validate OTP with strict checking
const validateOTP = (inputOTP, storedOTPs, context = 'general') => {
  console.log(`🔍 [${context.toUpperCase()}] === STARTING OTP VALIDATION ===`);
  console.log(`🔍 [${context.toUpperCase()}] Input OTP: "${inputOTP}" (type: ${typeof inputOTP})`);

  if (!inputOTP || typeof inputOTP !== 'string' || inputOTP.length !== 6 || !/^\d{6}$/.test(inputOTP)) {
    console.log(`❌ [${context.toUpperCase()}] Invalid OTP format - Length: ${inputOTP?.length}, Type: ${typeof inputOTP}, IsDigits: ${/^\d{6}$/.test(inputOTP || '')}`);
    return { valid: false, error: 'Invalid OTP format. Must be 6 digits.' };
  }

  const otpArray = Array.isArray(storedOTPs) ? storedOTPs : [];

  if (otpArray.length === 0) {
    console.log(`❌ [${context.toUpperCase()}] No OTPs found in database`);
    return { valid: false, error: 'No OTP found. Please request a new OTP.' };
  }

  console.log(`📋 [${context.toUpperCase()}] Available OTPs in database:`, otpArray.map((entry, index) => ({
    index,
    otp: entry.otp,
    type: typeof entry.otp,
    expiresAt: entry.expiresAt,
    expired: new Date(entry.expiresAt) <= new Date(),
    createdAt: entry.createdAt
  })));

  const now = new Date();
  let validOTP = null;

  // Check from latest to oldest
  for (let i = otpArray.length - 1; i >= 0; i--) {
    const otpEntry = otpArray[i];
    const expiryDate = new Date(otpEntry.expiresAt);

    console.log(`🔍 [${context.toUpperCase()}] Checking OTP #${i}:`);
    console.log(`   - Stored: "${otpEntry.otp}" (type: ${typeof otpEntry.otp})`);
    console.log(`   - Input:  "${inputOTP}" (type: ${typeof inputOTP})`);
    console.log(`   - String comparison: "${String(otpEntry.otp)}" === "${String(inputOTP)}" ? ${String(otpEntry.otp) === String(inputOTP)}`);
    console.log(`   - Expiry: ${expiryDate.toISOString()}, Now: ${now.toISOString()}, Expired: ${expiryDate <= now}`);

    // Strict comparison: both must be strings and exactly equal
    if (String(otpEntry.otp) === String(inputOTP) && expiryDate > now) {
      validOTP = otpEntry;
      console.log(`✅ [${context.toUpperCase()}] VALID OTP FOUND: ${otpEntry.otp}`);
      break;
    } else {
      console.log(`❌ [${context.toUpperCase()}] OTP #${i} does not match or expired`);
    }
  }

  if (!validOTP) {
    // Check if OTP exists but expired
    const expiredOTP = otpArray.find(entry => String(entry.otp) === String(inputOTP));
    if (expiredOTP) {
      console.log(`⏰ [${context.toUpperCase()}] OTP EXPIRED: ${expiredOTP.otp}`);
      return { valid: false, error: 'OTP has expired. Please request a new OTP.', expired: true };
    }

    console.log(`❌ [${context.toUpperCase()}] INVALID OTP: ${inputOTP} - No matching OTP found`);
    return { valid: false, error: 'Invalid OTP. Please check and try again.' };
  }

  console.log(`✅ [${context.toUpperCase()}] === OTP VALIDATION SUCCESSFUL ===`);
  return { valid: true, otpEntry: validOTP };
};

/**
 * Mobile App Registration with OTP
 * POST /api/auth/mobile/register
 */
const mobileRegister = async (req, res) => {
  try {
    console.log("📱 Mobile registration request received:", req.body.email);
    const { email, password, name, phoneNumber } = req.body;

    // Validation
    if (!email || !password || !name || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: "Email, password, name, and phone number are required",
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format",
      });
    }

    // Phone number format validation
    const phoneRegex = /^\+?[\d\s-]{10,15}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: "Invalid phone number format",
      });
    }

    console.log("✅ Validation passed");

    // Determine if this should be an admin or user
    const adminEmails = [process.env.ADMIN_EMAIL];
    const isAdmin = adminEmails.includes(email.toLowerCase());
    console.log("👤 User type:", isAdmin ? "admin" : "user");

    // Check if user/admin already exists
    console.log("🔍 Checking for existing user...");
    const existingUser = isAdmin
      ? await prisma.admin.findUnique({ where: { email } })
      : await prisma.user.findUnique({ where: { email } });

    const existingInOtherCollection = isAdmin
      ? await prisma.user.findUnique({ where: { email } })
      : await prisma.admin.findUnique({ where: { email } });

    if (existingUser || existingInOtherCollection) {
      console.log("❌ User already exists with email");
      return res.status(400).json({
        success: false,
        error: "Account already exists. Please sign in with your email or phone number and password.",
      });
    }

    // Check if phone number already exists
    console.log("🔍 Checking for existing phone number...");
    const existingPhone = isAdmin
      ? await prisma.admin.findFirst({ where: { phoneNumber } })
      : await prisma.user.findFirst({ where: { phoneNumber } });

    const existingPhoneInOtherCollection = isAdmin
      ? await prisma.user.findFirst({ where: { phoneNumber } })
      : await prisma.admin.findFirst({ where: { phoneNumber } });

    if (existingPhone || existingPhoneInOtherCollection) {
      console.log("❌ Phone number already exists");
      return res.status(400).json({
        success: false,
        error: "Account already exists. Please sign in with your email or phone number and password.",
      });
    }

    console.log("✅ User does not exist, proceeding...");

    // Hash password
    console.log("🔐 Hashing password...");
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log("✅ Password hashed");

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Prepare user data with OTP array
    const userData = {
      email,
      password: hashedPassword,
      name,
      phoneNumber,
      googleId: `local_${crypto.randomUUID()}`, // Generate unique googleId for local users to avoid constraint issues
      emailOTPs: [
        {
          otp,
          expiresAt: otpExpiry.toISOString(),
          createdAt: new Date().toISOString(),
        }
      ],
    };

    // Create user in appropriate collection
    console.log("💾 Creating user in database...");
    const user = isAdmin
      ? await prisma.admin.create({ data: userData })
      : await prisma.user.create({ data: userData });
    console.log("✅ User created:", user.id);

    // Create or Link Customer record for non-admin users
    let customerId = null;
    if (!isAdmin) {
      try {
        console.log("📝 Checking for existing customer record for user:", user.id);

        const existingCustomer = await prisma.customer.findFirst({
          where: {
            OR: [
              { email: user.email },
              { phoneNumber: user.phoneNumber }
            ]
          }
        });

        if (existingCustomer) {
          console.log("🔗 Customer already exists, linking user to existing customer:", existingCustomer.id);
          const updatedCustomer = await prisma.customer.update({
            where: { id: existingCustomer.id },
            data: {
              userId: user.id,
              isVerified: existingCustomer.isVerified || false,
            }
          });
          customerId = updatedCustomer.id;
          console.log("✅ User linked to existing customer:", customerId);
        } else {
          console.log("📝 Creating new customer record for user:", user.id);
          const customer = await prisma.customer.create({
            data: {
              userId: user.id,
              email: user.email,
              name: user.name,
              phoneNumber: user.phoneNumber,
              isVerified: false,
              provider: 'local',
            },
          });
          customerId = customer.id;
          console.log("✅ Customer record created:", customer.id);
        }
      } catch (customerError) {
        console.error("❌ Failed to handle customer record:");
        console.error("Error details:", customerError);
      }
    }

    // Send OTP email
    const emailData = {
      to: email,
      subject: "Verify Your Email - OTP Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Email Verification</h2>
          <p>Hi ${name},</p>
          <p>Thank you for registering with us. Please use the following OTP to verify your email address:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 30px 0; border-radius: 8px;">
            <h1 style="color: #4F46E5; font-size: 36px; margin: 0; letter-spacing: 8px;">${otp}</h1>
          </div>
          <p style="color: #666;">This OTP will expire in 10 minutes.</p>
          <p style="color: #666;">If you didn't create this account, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">This is an automated email. Please do not reply.</p>
        </div>
      `,
    };

    // Send OTP via email and WhatsApp (if enabled)
    const whatsappEnabled = process.env.WHATSAPP_ENABLED === 'true';
    let otpChannel = 'email';
    let emailSent = false;
    let whatsappSent = false;

    // Send Email OTP
    try {
      await sendEmail(emailData);
      emailSent = true;
      console.log(`✅ OTP email sent to: ${email}`);
    } catch (emailErr) {
      console.error("❌ Failed to send OTP email:", emailErr);
    }

    // Send WhatsApp OTP if enabled and phone number exists
    if (whatsappEnabled && phoneNumber) {
      try {
        const wsResult = await sendWhatsAppOTP(phoneNumber, otp);
        if (wsResult && wsResult.success) {
          whatsappSent = true;
          otpChannel = 'both';
          console.log(`✅ WhatsApp OTP sent to: ${phoneNumber}`);
        } else {
          console.log('⚠️ WhatsApp OTP dispatch failed');
        }
      } catch (dispatchErr) {
        console.error("❌ Failed to send WhatsApp OTP:", dispatchErr);
      }
    }

    // Fallback: Ensure at least one was sent successfully
    if (!emailSent && !whatsappSent) {
      try {
        await sendEmail(emailData);
        emailSent = true;
        console.log(`✅ Emergency fallback OTP email sent to: ${email}`);
      } catch (err) {
        console.error("❌ Emergency fallback OTP email also failed:", err);
      }
    }

    res.status(201).json({
      success: true,
      message: otpChannel === 'both'
        ? "Registration successful. OTP sent to your WhatsApp and registered email."
        : "Registration successful. OTP sent to your registered email.",
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: isAdmin ? "admin" : "user",
        otpChannel,
        otpSent: true,
      },
    });

    // Admin registration alert is non-critical — keep fire-and-forget
    if (!isAdmin) {
      setImmediate(async () => {
        try {
          await sendNewUserRegistrationAlert(user.name, user.email, customerId);
          console.log(`📱 New user registration notification sent to admins`);
        } catch (notifError) {
          console.error('⚠️ Failed to send registration notification:', notifError.message);
        }
      });
    }
  } catch (error) {
    console.error("Mobile registration error:", error);
    res.status(500).json({
      success: false,
      error: "Registration failed",
    });
  }
};

/**
 * Verify OTP for Mobile App
 * POST /api/auth/mobile/verify-otp
 */
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    console.log("📱 OTP verification request received for:", email);

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: "Email and OTP are required",
      });
    }

    // Find user in both collections
    let user = await prisma.user.findUnique({ where: { email } });
    let userType = "user";

    if (!user) {
      user = await prisma.admin.findUnique({ where: { email } });
      userType = "admin";
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Check if already verified
    if (user.isVerified) {
      return res.json({
        success: true,
        message: "Email already verified",
        alreadyVerified: true,
      });
    }

    // Verify OTP with strict validation
    const otpValidation = validateOTP(otp, user.emailOTPs, 'registration-verify');

    if (!otpValidation.valid) {
      return res.status(400).json({
        success: false,
        error: otpValidation.error,
        ...(otpValidation.expired && { expired: true }),
      });
    }

    // OTP is valid - verify user
    const updateData = {
      isVerified: true,
      emailOTPs: [], // Clear all OTPs after successful verification
    };

    let verifiedUser;
    if (userType === "admin") {
      verifiedUser = await prisma.admin.update({
        where: { id: user.id },
        data: updateData,
      });
    } else {
      verifiedUser = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      // Update customer verification status
      try {
        await prisma.customer.updateMany({
          where: { userId: user.id },
          data: { isVerified: true },
        });
        console.log("✅ Customer verification status updated");
      } catch (customerError) {
        console.error("⚠️ Failed to update customer verification:", customerError);
      }
    }

    console.log(`✅ Email verified successfully for: ${verifiedUser.email}`);

    // Send welcome notification (non-blocking)
    if (userType === "user") {
      setImmediate(async () => {
        try {
          await sendWelcomeNotification(user.id, user.name);
          console.log(`🎉 Welcome notification sent to user: ${user.name}`);
        } catch (notifError) {
          console.error('⚠️ Failed to send welcome notification:', notifError.message);
        }
      });
    }

    res.json({
      success: true,
      message: "Email verified successfully",
      data: {
        id: verifiedUser.id,
        email: verifiedUser.email,
        name: verifiedUser.name,
        isVerified: true,
        role: userType,
      },
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({
      success: false,
      error: "OTP verification failed",
    });
  }
};

/**
 * Resend OTP for Mobile App
 * POST /api/auth/mobile/resend-otp
 */
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    console.log("📱 Resend OTP request received for:", email);

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    // Find user in both collections
    let user = await prisma.user.findUnique({ where: { email } });
    let userType = "user";

    if (!user) {
      user = await prisma.admin.findUnique({ where: { email } });
      userType = "admin";
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Check if already verified
    if (user.isVerified) {
      return res.json({
        success: true,
        message: "Email already verified",
        alreadyVerified: true,
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Get existing OTP array
    const existingOTPs = Array.isArray(user.emailOTPs) ? user.emailOTPs : [];

    // Add new OTP to array (keep last 5 OTPs for history)
    const updatedOTPs = [
      ...existingOTPs.slice(-4), // Keep last 4 OTPs
      {
        otp,
        expiresAt: otpExpiry.toISOString(),
        createdAt: new Date().toISOString(),
      }
    ];

    // Update user with new OTP
    if (userType === "admin") {
      await prisma.admin.update({
        where: { id: user.id },
        data: { emailOTPs: updatedOTPs },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailOTPs: updatedOTPs },
      });
    }

    console.log(`✅ New OTP generated for: ${email}`);

    // Send OTP email
    const emailData = {
      to: email,
      subject: "Verify Your Email - New OTP Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Email Verification - Resend OTP</h2>
          <p>Hi ${user.name},</p>
          <p>You requested a new OTP to verify your email address. Please use the following code:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 30px 0; border-radius: 8px;">
            <h1 style="color: #4F46E5; font-size: 36px; margin: 0; letter-spacing: 8px;">${otp}</h1>
          </div>
          <p style="color: #666;">This OTP will expire in 10 minutes.</p>
          <p style="color: #666;">If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">This is an automated email. Please do not reply.</p>
        </div>
      `,
    };

    const whatsappEnabled = process.env.WHATSAPP_ENABLED === 'true';
    const hasPhone = !!user.phoneNumber;

    // Send response immediately
    res.json({
      success: true,
      message: whatsappEnabled && hasPhone
        ? "New OTP sent to your email and WhatsApp"
        : "New OTP sent to your email",
      data: {
        email: user.email,
        otpSent: true,
      },
    });

    // Send email and WhatsApp after response (non-blocking)
    setImmediate(async () => {
      try {
        await sendEmail(emailData);
        console.log(`✅ Resend OTP email sent to: ${email}`);
      } catch (err) {
        console.error("Failed to send resend OTP email:", err);
      }

      if (whatsappEnabled && user.phoneNumber) {
        try {
          const wsResult = await sendWhatsAppOTP(user.phoneNumber, otp);
          if (wsResult && wsResult.success) {
            console.log(`✅ Resend OTP WhatsApp sent to: ${user.phoneNumber}`);
          } else {
            console.log("⚠️ Resend OTP WhatsApp dispatch failed");
          }
        } catch (wsErr) {
          console.error("Failed to send resend OTP WhatsApp:", wsErr);
        }
      }
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to resend OTP",
    });
  }
};

/**
 * Mobile App Login (same as web, but returns mobile-friendly response)
 * POST /api/auth/mobile/login
 */
const mobileLogin = async (req, res) => {
  try {
    const { email, password, fcmToken } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email or phone number and password are required",
      });
    }

    // Check if input is email or phone number
    const isEmail = /\S+@\S+\.\S+/.test(email);
    const searchField = isEmail ? "email" : "phoneNumber";

    console.log(`📱 Mobile login attempt with ${searchField}:`, email);

    // Find user in both collections
    let user = isEmail
      ? await prisma.user.findUnique({ where: { email } })
      : await prisma.user.findFirst({ where: { phoneNumber: email } });
    let userType = "user";

    if (!user) {
      user = isEmail
        ? await prisma.admin.findUnique({ where: { email } })
        : await prisma.admin.findFirst({ where: { phoneNumber: email } });
      userType = "admin";
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid email/phone number or password",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: "Account is deactivated. Please contact administrator.",
      });
    }

    // Check if email is verified
    if (!user.isVerified) {
      return res.status(401).json({
        success: false,
        error: "Please verify your email before signing in. Check your inbox for the OTP.",
        needsVerification: true,
      });
    }

    // For Google OAuth users without password
    if (!user.password && user.provider === "google") {
      return res.status(401).json({
        success: false,
        error: "Please sign in with Google",
        useGoogleAuth: true,
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    // Update last login and FCM token if provided
    const updateData = { lastLogin: new Date() };

    // Handle FCM token for mobile app
    if (fcmToken) {
      const existingTokens = Array.isArray(user.fcmTokens) ? user.fcmTokens : [];
      const device = req.headers['user-agent'] || 'Mobile App';
      const now = new Date();

      // Remove existing token if present
      const filteredTokens = existingTokens.filter(t => t.token !== fcmToken);

      // Add new token
      filteredTokens.unshift({
        token: fcmToken,
        device: device,
        lastUsed: now.toISOString(),
      });

      // Keep only last 10 devices
      updateData.fcmTokens = filteredTokens.slice(0, 10);
    }

    if (userType === "admin") {
      await prisma.admin.update({
        where: { id: user.id },
        data: updateData,
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }

    // Generate token
    const token = generateToken(user.id);

    // Track active session
    await sessionManager.addSession(user.id, token);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: userType,
          image: user.image,
          isVerified: user.isVerified,
          phoneNumber: user.phoneNumber,
          address: user.address,
          city: user.city,
          state: user.state,
          zipCode: user.zipCode,
          country: user.country,
          dateOfBirth: user.dateOfBirth,
          currency: userType === "admin" ? user.currency : undefined,
          companyName: userType === "admin" ? user.companyName : undefined,
          gstNumber: userType === "admin" ? user.gstNumber : undefined,
          onboardingCompleted: userType === "admin" ? user.onboardingCompleted : undefined,
        },
      },
    });
  } catch (error) {
    console.error("Mobile login error:", error);
    res.status(500).json({
      success: false,
      error: "Login failed",
    });
  }
};

/**
 * Send OTP to Email based on Phone Number
 * POST /api/auth/mobile/send-otp-phone
 */
const sendOTPByPhone = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    console.log("📱 Send OTP by phone request received for:", phoneNumber);

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: "Phone number is required",
      });
    }

    // Find user by phone number in both collections
    let user = await prisma.user.findFirst({ where: { phoneNumber } });
    let userType = "user";

    if (!user) {
      user = await prisma.admin.findFirst({ where: { phoneNumber } });
      userType = "admin";
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "No account found with this phone number",
      });
    }

    // Get existing OTP array
    const existingOTPs = Array.isArray(user.emailOTPs) ? user.emailOTPs : [];
    const now = new Date();

    // Find the latest valid OTP that was already generated (e.g. for email)
    const validExistingOTP = existingOTPs.slice().reverse().find(
      (entry) => new Date(entry.expiresAt) > now
    );

    // HIGH #4 / CRITICAL #3 — Always generate a fresh OTP.
    // We NEVER reuse an existing OTP regardless of whether a valid one already exists in the
    // database. Reuse creates a cross-channel attack vector: an OTP originally sent over email
    // could be silently reused when the user requests OTP via WhatsApp.
    const otp = generateOTP();
    const otpExpiry = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    // Add new OTP to array (keep last 5 for audit; only the freshest valid one will be matched)
    const updatedOTPs = [
      ...existingOTPs.slice(-4), // Keep last 4
      {
        otp,
        expiresAt: otpExpiry.toISOString(),
        createdAt: now.toISOString(),
      }
    ];

    // Persist the new OTP to the database
    if (userType === "admin") {
      await prisma.admin.update({
        where: { id: user.id },
        data: { emailOTPs: updatedOTPs },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailOTPs: updatedOTPs },
      });
    }

    const whatsappEnabled = process.env.WHATSAPP_ENABLED === 'true';
    console.log(`✅ OTP generated for phone: ${phoneNumber}, dispatch options: [WhatsApp Enabled: ${whatsappEnabled}]`);

    // Prepare OTP email data in case of fallback
    const emailData = {
      to: user.email,
      subject: "Your OTP Code - Phone Verification",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Phone Verification OTP</h2>
          <p>Hi ${user.name},</p>
          <p>You requested an OTP for phone number verification. Please use the following code:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 30px 0; border-radius: 8px;">
            <h1 style="color: #4F46E5; font-size: 36px; margin: 0; letter-spacing: 8px;">${otp}</h1>
          </div>
          <p style="color: #666;">This OTP will expire in 10 minutes.</p>
          <p style="color: #666;">Phone Number: ${phoneNumber}</p>
          <p style="color: #666;">If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">This is an automated email. Please do not reply.</p>
        </div>
      `,
    };

    // HIGH #4 — Dispatch the OTP BEFORE responding so we can tell the user exactly
    // which channel was used. Responding first and sending in the background means
    // the user is told "sent to WhatsApp" even if WhatsApp fails and we silently
    // fall back to email — causing them to never check their inbox.
    let deliveredVia = 'email';
    let emailSent = false;
    let whatsappSent = false;

    // Send Email
    try {
      await sendEmail(emailData);
      emailSent = true;
      console.log(`✅ OTP email sent to: ${user.email}`);
    } catch (emailErr) {
      console.error("❌ Failed to send OTP email:", emailErr);
    }

    // Send WhatsApp if enabled
    if (whatsappEnabled) {
      try {
        const wsResult = await sendWhatsAppOTP(phoneNumber, otp);
        if (wsResult && wsResult.success) {
          whatsappSent = true;
          deliveredVia = 'both';
          console.log(`✅ WhatsApp OTP sent to: ${phoneNumber}`);
        } else {
          console.log('⚠️ WhatsApp OTP dispatch failed');
        }
      } catch (dispatchErr) {
        console.error("❌ Failed to send WhatsApp OTP:", dispatchErr);
      }
    }

    // Ensure at least one was sent successfully
    if (!emailSent && !whatsappSent) {
      try {
        await sendEmail(emailData);
        emailSent = true;
        console.log(`✅ Emergency fallback OTP email sent to: ${user.email}`);
      } catch (emailErr) {
        console.error("❌ Emergency fallback email also failed:", emailErr);
        return res.status(500).json({
          success: false,
          error: "Failed to send OTP. Please try again.",
        });
      }
    }

    // Respond after dispatch — channel is now confirmed
    res.json({
      success: true,
      message: deliveredVia === 'both'
        ? "OTP sent to your WhatsApp number and registered email"
        : "OTP sent to your registered email",
      data: {
        phoneNumber,
        channel: deliveredVia,
        email: user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"), // Masked email is always shown since it was sent to email
        otpSent: true,
      },
    });
  } catch (error) {
    console.error("Send OTP by phone error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send OTP",
    });
  }
};

/**
 * Verify OTP by Phone Number
 * POST /api/auth/mobile/verify-otp-phone
 */
const verifyOTPByPhone = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    console.log("📱 OTP verification by phone request received for:", phoneNumber);

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        error: "Phone number and OTP are required",
      });
    }

    // Find user by phone number
    let user = await prisma.user.findFirst({ where: { phoneNumber } });
    let userType = "user";

    if (!user) {
      user = await prisma.admin.findFirst({ where: { phoneNumber } });
      userType = "admin";
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Get OTP array
    const otpArray = Array.isArray(user.emailOTPs) ? user.emailOTPs : [];

    if (otpArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No OTP found. Please request a new OTP.",
      });
    }

    // Find valid OTP (check from latest to oldest)
    const now = new Date();
    let validOTP = null;

    for (let i = otpArray.length - 1; i >= 0; i--) {
      const otpEntry = otpArray[i];
      const expiryDate = new Date(otpEntry.expiresAt);

      if (otpEntry.otp === otp && expiryDate > now) {
        validOTP = otpEntry;
        break;
      }
    }

    if (!validOTP) {
      // Check if OTP exists but expired
      const expiredOTP = otpArray.find(entry => entry.otp === otp);
      if (expiredOTP) {
        return res.status(400).json({
          success: false,
          error: "OTP has expired. Please request a new OTP.",
          expired: true,
        });
      }

      return res.status(400).json({
        success: false,
        error: "Invalid OTP. Please check and try again.",
      });
    }

    console.log(`✅ OTP verified successfully for phone: ${phoneNumber}`);

    // Generate JWT token for login
    const token = generateToken(user.id);

    // Track active session
    await sessionManager.addSession(user.id, token);

    // Update last login
    const updateData = {
      lastLogin: new Date(),
      emailOTPs: [], // Clear OTPs after successful verification
    };

    if (userType === "admin") {
      await prisma.admin.update({
        where: { id: user.id },
        data: updateData,
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }

    res.json({
      success: true,
      message: "OTP verified successfully",
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: userType,
          image: user.image,
          isVerified: user.isVerified,
          phoneNumber: user.phoneNumber,
          address: user.address,
          city: user.city,
          state: user.state,
          zipCode: user.zipCode,
          country: user.country,
          dateOfBirth: user.dateOfBirth,
        },
      },
    });
  } catch (error) {
    console.error("OTP verification by phone error:", error);
    res.status(500).json({
      success: false,
      error: "OTP verification failed",
    });
  }
};

/**
 * Reset Password using Phone Number and OTP
 * POST /api/auth/mobile/reset-password-phone-otp
 */
const resetPasswordPhoneOTP = async (req, res) => {
  try {
    const { phoneNumber, otp, newPassword } = req.body;

    console.log("📱 Reset password by phone OTP request received for:", phoneNumber);
    console.log("📱 OTP received:", otp);
    console.log("📱 Password length:", newPassword?.length);

    if (!phoneNumber || !otp || !newPassword) {
      console.log("❌ Missing required fields");
      return res.status(400).json({
        success: false,
        error: "Phone number, OTP, and new password are required",
      });
    }

    if (newPassword.length < 8) {
      console.log("❌ Password too short");
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters long",
      });
    }

    // Find user by phone number
    let user = await prisma.user.findFirst({ where: { phoneNumber } });
    let userType = "user";

    if (!user) {
      user = await prisma.admin.findFirst({ where: { phoneNumber } });
      userType = "admin";
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Verify OTP
    const otpArray = Array.isArray(user.emailOTPs) ? user.emailOTPs : [];
    const now = new Date();
    let validOTP = null;

    for (let i = otpArray.length - 1; i >= 0; i--) {
      const otpEntry = otpArray[i];
      const expiryDate = new Date(otpEntry.expiresAt);

      if (otpEntry.otp === otp && expiryDate > now) {
        validOTP = otpEntry;
        break;
      }
    }

    if (!validOTP) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired OTP",
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear OTPs
    const updateData = {
      password: hashedPassword,
      emailOTPs: [],
    };

    if (userType === "admin") {
      await prisma.admin.update({
        where: { id: user.id },
        data: updateData,
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }

    console.log(`✅ Password reset successfully for phone: ${phoneNumber}`);

    res.json({
      success: true,
      message: "Password reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    console.error("Reset password by phone OTP error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reset password",
    });
  }
};

/**
 * Mobile Forgot Password - Send OTP to Email
 * POST /api/auth/mobile/forgot-password
 */
const mobileForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    console.log("📱 Mobile forgot password request received for:", email);

    if (!email) {
      console.log("❌ No email provided");
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log("❌ Invalid email format:", email);
      return res.status(400).json({
        success: false,
        error: "Invalid email format",
      });
    }

    // Find user in both collections
    let user = await prisma.user.findUnique({ where: { email } });
    let userType = "user";

    if (!user) {
      user = await prisma.admin.findUnique({ where: { email } });
      userType = "admin";
    }

    if (!user) {
      console.log("❌ User not found with email:", email);
      return res.status(404).json({
        success: false,
        error: "No account found with this email address",
      });
    }

    console.log(`✅ User found: ${user.email} (${userType})`);

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Get existing OTP array
    const existingOTPs = Array.isArray(user.emailOTPs) ? user.emailOTPs : [];

    // Add new OTP to array (keep last 5 OTPs for history)
    const updatedOTPs = [
      ...existingOTPs.slice(-4), // Keep last 4 OTPs
      {
        otp,
        expiresAt: otpExpiry.toISOString(),
        createdAt: new Date().toISOString(),
      }
    ];

    // Update user with new OTP
    if (userType === "admin") {
      await prisma.admin.update({
        where: { id: user.id },
        data: { emailOTPs: updatedOTPs },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailOTPs: updatedOTPs },
      });
    }

    console.log(`✅ Password reset OTP generated for: ${email}`);

    // Send OTP email
    const emailData = {
      to: email,
      subject: "Password Reset OTP - Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hi ${user.name},</p>
          <p>You requested to reset your password. Please use the following OTP to proceed:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 30px 0; border-radius: 8px;">
            <h1 style="color: #DC2626; font-size: 36px; margin: 0; letter-spacing: 8px;">${otp}</h1>
          </div>
          <p style="color: #666;">This OTP will expire in 10 minutes.</p>
          <p style="color: #666;">If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">This is an automated email. Please do not reply.</p>
        </div>
      `,
    };

    const whatsappEnabled = process.env.WHATSAPP_ENABLED === 'true';
    const hasPhone = !!user.phoneNumber;

    // Send response immediately
    res.json({
      success: true,
      message: whatsappEnabled && hasPhone
        ? "Password reset OTP sent to your email and WhatsApp"
        : "Password reset OTP sent to your email",
      data: {
        email: email,
        otpSent: true,
      },
    });

    // Send email and WhatsApp after response (non-blocking)
    setImmediate(async () => {
      try {
        await sendEmail(emailData);
        console.log(`✅ Password reset OTP email sent to: ${email}`);
      } catch (err) {
        console.error("Failed to send password reset OTP email:", err);
      }

      if (whatsappEnabled && user.phoneNumber) {
        try {
          const wsResult = await sendWhatsAppOTP(user.phoneNumber, otp);
          if (wsResult && wsResult.success) {
            console.log(`✅ Password reset OTP WhatsApp sent to: ${user.phoneNumber}`);
          } else {
            console.log("⚠️ Password reset OTP WhatsApp dispatch failed");
          }
        } catch (wsErr) {
          console.error("Failed to send password reset OTP WhatsApp:", wsErr);
        }
      }
    });
  } catch (error) {
    console.error("Mobile forgot password error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send password reset OTP",
    });
  }
};

/**
 * Reset Password using Email and OTP
 * POST /api/auth/mobile/reset-password-email-otp
 */
const resetPasswordEmailOTP = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    console.log("📱 Reset password by email OTP request received for:", email);
    console.log("📱 OTP received:", otp, "(type:", typeof otp, ")");
    console.log("📱 Password length:", newPassword?.length);

    if (!email || !otp || !newPassword) {
      console.log("❌ Missing required fields");
      return res.status(400).json({
        success: false,
        error: "Email, OTP, and new password are required",
      });
    }

    if (newPassword.length < 8) {
      console.log("❌ Password too short");
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters long",
      });
    }

    // Find user by email
    let user = await prisma.user.findUnique({ where: { email } });
    let userType = "user";

    if (!user) {
      user = await prisma.admin.findUnique({ where: { email } });
      userType = "admin";
    }

    if (!user) {
      console.log("❌ User not found with email:", email);
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    console.log(`✅ User found: ${user.email} (${userType})`);
    console.log("📋 User's emailOTPs:", user.emailOTPs);

    // Verify OTP with strict validation
    const otpValidation = validateOTP(otp, user.emailOTPs, 'reset-password');

    if (!otpValidation.valid) {
      console.log("❌ OTP validation failed:", otpValidation.error);
      return res.status(400).json({
        success: false,
        error: otpValidation.error,
        ...(otpValidation.expired && { expired: true }),
      });
    }

    console.log("✅ OTP validation successful");

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear OTPs
    const updateData = {
      password: hashedPassword,
      emailOTPs: [],
    };

    if (userType === "admin") {
      await prisma.admin.update({
        where: { id: user.id },
        data: updateData,
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }

    console.log(`✅ Password reset successfully for email: ${email}`);

    res.json({
      success: true,
      message: "Password reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    console.error("Reset password by email OTP error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reset password",
    });
  }
};

/**
 * Verify Reset Password OTP (without actually resetting password)
 * POST /api/auth/mobile/verify-reset-otp
 */
const verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    console.log("📱 Verify reset OTP request received for:", email);
    console.log("📱 OTP received:", otp, "(type:", typeof otp, ")");

    if (!email || !otp) {
      console.log("❌ Missing required fields");
      return res.status(400).json({
        success: false,
        error: "Email and OTP are required",
      });
    }

    // Find user by email
    let user = await prisma.user.findUnique({ where: { email } });
    let userType = "user";

    if (!user) {
      user = await prisma.admin.findUnique({ where: { email } });
      userType = "admin";
    }

    if (!user) {
      console.log("❌ User not found with email:", email);
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    console.log(`✅ User found: ${user.email} (${userType})`);
    console.log("📋 User's emailOTPs:", user.emailOTPs);

    // Verify OTP with strict validation
    const otpValidation = validateOTP(otp, user.emailOTPs, 'verify-reset-otp');

    if (!otpValidation.valid) {
      console.log("❌ OTP validation failed:", otpValidation.error);
      return res.status(400).json({
        success: false,
        error: otpValidation.error,
        ...(otpValidation.expired && { expired: true }),
      });
    }

    console.log("✅ Reset OTP verification successful");

    res.json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("Verify reset OTP error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify OTP",
    });
  }
};

module.exports = {
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
};
