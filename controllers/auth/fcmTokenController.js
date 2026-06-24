const { prisma } = require('../../config/database');

/**
 * Save/Update FCM token for user (Multi-device support)
 * POST /api/auth/fcm-token
 */
const saveFCMToken = async (req, res) => {
  try {
    const { userId, fcmToken, userType, deviceInfo } = req.body;

    if (!userId || !fcmToken || !userType) {
      return res.status(400).json({
        success: false,
        error: 'userId, fcmToken, and userType are required',
      });
    }

    if (!['user', 'admin', 'partner', 'employee'].includes(userType)) {
      return res.status(400).json({
        success: false,
        error: 'userType must be either "user", "admin", "employee", or "partner"',
      });
    }

    // Get device info (browser, OS, etc.)
    const device = deviceInfo || req.headers['user-agent'] || 'Unknown Device';
    const now = new Date();

    // Update FCM token based on user type
    if (userType === 'user') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, fcmTokens: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      // Get existing tokens array
      let tokens = Array.isArray(user.fcmTokens) ? user.fcmTokens : [];

      // ✅ FIX: Only remove the EXACT same token (not by device name)
      // This allows multiple systems with same browser/OS combination
      // Each system generates a unique FCM token even if device name is same
      tokens = tokens.filter(t => t.token !== fcmToken);

      // Add new token to the beginning
      tokens.unshift({
        token: fcmToken,
        device: device,
        lastUsed: now.toISOString(),
      });

      // Keep only last 10 devices (prevent unlimited growth)
      if (tokens.length > 10) {
        tokens = tokens.slice(0, 10);
      }

      // Update user with new tokens array
      await prisma.user.update({
        where: { id: userId },
        data: { fcmTokens: tokens },
      });

      console.log(`✅ FCM token saved for user: ${user.name} (${user.email}) - Total devices: ${tokens.length}`);

      return res.json({
        success: true,
        message: 'FCM token saved successfully',
        data: { 
          userId: user.id, 
          userType: 'user',
          totalDevices: tokens.length 
        },
      });
    } else if (userType === 'partner') {
      console.log('🔍 [Partner FCM] Looking up partner:', userId);
      
      const partner = await prisma.deliveryPartner.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, fcmTokens: true },
      });

      if (!partner) {
        console.error('❌ [Partner FCM] Partner not found:', userId);
        return res.status(404).json({
          success: false,
          error: 'Partner not found',
        });
      }

      console.log('✅ [Partner FCM] Partner found:', partner.name);
      console.log('📋 [Partner FCM] Current fcmTokens:', JSON.stringify(partner.fcmTokens, null, 2));

      // Get existing tokens array
      let tokens = Array.isArray(partner.fcmTokens) ? partner.fcmTokens : [];
      console.log('📊 [Partner FCM] Existing tokens count:', tokens.length);

      // Only remove the EXACT same token
      const beforeFilterCount = tokens.length;
      tokens = tokens.filter(t => t.token !== fcmToken);
      console.log(`🔄 [Partner FCM] Filtered tokens: ${beforeFilterCount} → ${tokens.length}`);

      // Add new token to the beginning
      tokens.unshift({
        token: fcmToken,
        device: device,
        lastUsed: now.toISOString(),
      });
      console.log('➕ [Partner FCM] Added new token, total:', tokens.length);

      // Keep only last 10 devices
      if (tokens.length > 10) {
        tokens = tokens.slice(0, 10);
        console.log('✂️ [Partner FCM] Trimmed to 10 devices');
      }

      console.log('💾 [Partner FCM] Updating database with tokens:', JSON.stringify(tokens, null, 2));

      // Update partner with new tokens array
      const updatedPartner = await prisma.deliveryPartner.update({
        where: { id: userId },
        data: { fcmTokens: tokens },
        select: { id: true, name: true, email: true, fcmTokens: true },
      });

      console.log('✅ [Partner FCM] Database updated successfully');
      console.log('🔍 [Partner FCM] Updated partner fcmTokens:', JSON.stringify(updatedPartner.fcmTokens, null, 2));
      
      // Verify the update by reading back from database
      const verifyPartner = await prisma.deliveryPartner.findUnique({
        where: { id: userId },
        select: { fcmTokens: true },
      });
      console.log('🔍 [Partner FCM] Verification read from DB:', JSON.stringify(verifyPartner.fcmTokens, null, 2));

      console.log(`✅ FCM token saved for partner: ${partner.name} (${partner.email}) - Total devices: ${tokens.length}`);

      return res.json({
        success: true,
        message: 'FCM token saved successfully',
        data: { 
          userId: partner.id, 
          userType: 'partner',
          totalDevices: tokens.length 
        },
      });
    } else if (userType === 'employee') {
      const result = await saveEmployeeFCMToken(userId, fcmToken, device, now);
      if (!result) {
        return res.status(404).json({ success: false, error: 'Employee not found' });
      }
      return res.json({ success: true, message: 'FCM token saved successfully', data: result });
    } else {
      const admin = await prisma.admin.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, fcmTokens: true },
      });

      if (!admin) {
        return res.status(404).json({
          success: false,
          error: 'Admin not found',
        });
      }

      // Get existing tokens array
      let tokens = Array.isArray(admin.fcmTokens) ? admin.fcmTokens : [];

      // ✅ FIX: Only remove the EXACT same token (not by device name)
      // This allows multiple systems with same browser/OS combination
      // Each system generates a unique FCM token even if device name is same
      tokens = tokens.filter(t => t.token !== fcmToken);

      // Add new token to the beginning
      tokens.unshift({
        token: fcmToken,
        device: device,
        lastUsed: now.toISOString(),
      });

      // Keep only last 10 devices
      if (tokens.length > 10) {
        tokens = tokens.slice(0, 10);
      }

      // Update admin with new tokens array
      await prisma.admin.update({
        where: { id: userId },
        data: { fcmTokens: tokens },
      });

      console.log(`✅ FCM token saved for admin: ${admin.name} (${admin.email}) - Total devices: ${tokens.length}`);

      return res.json({
        success: true,
        message: 'FCM token saved successfully',
        data: {
          userId: admin.id,
          userType: 'admin',
          totalDevices: tokens.length
        },
      });
    }
  } catch (error) {
    console.error('❌ Error saving FCM token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save FCM token',
      message: error.message,
    });
  }
};

/**
 * Save FCM token for employee
 * Called internally from saveFCMToken when userType === 'employee'
 */
const saveEmployeeFCMToken = async (userId, fcmToken, device, now) => {
  let employee = await prisma.employee.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, fcmTokens: true },
  });

  // If not found by ID (Google login sends User ID), find via User email
  if (!employee) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user) {
      employee = await prisma.employee.findUnique({
        where: { email: user.email },
        select: { id: true, name: true, email: true, fcmTokens: true },
      });
    }
  }
  if (!employee) return null;

  let tokens = Array.isArray(employee.fcmTokens) ? employee.fcmTokens : [];
  tokens = tokens.filter(t => t.token !== fcmToken);
  tokens.unshift({ token: fcmToken, device, lastUsed: now.toISOString() });
  if (tokens.length > 10) tokens = tokens.slice(0, 10);

  await prisma.employee.update({
    where: { id: employee.id },
    data: { fcmTokens: tokens },
  });

  console.log(`✅ FCM token saved for employee: ${employee.name} (${employee.email}) - Total devices: ${tokens.length}`);

  // Also save to User table (same person — needs notifications as customer too)
  try {
    const linkedUser = await prisma.user.findUnique({ where: { email: employee.email }, select: { id: true, fcmTokens: true } });
    if (linkedUser) {
      let userTokens = Array.isArray(linkedUser.fcmTokens) ? linkedUser.fcmTokens : [];
      userTokens = userTokens.filter(t => t.token !== fcmToken);
      userTokens.unshift({ token: fcmToken, device, lastUsed: now.toISOString() });
      if (userTokens.length > 10) userTokens = userTokens.slice(0, 10);
      await prisma.user.update({ where: { id: linkedUser.id }, data: { fcmTokens: userTokens } });
      console.log(`✅ FCM token also saved for linked user: ${employee.email}`);
    }
  } catch (e) { /* silent — employee-only, no linked user */ }

  return { userId: employee.id, userType: 'employee', totalDevices: tokens.length };
};

/**
 * Remove FCM token (on logout from specific device)
 * DELETE /api/auth/fcm-token
 */
const removeFCMToken = async (req, res) => {
  try {
    const { userId, userType, fcmToken } = req.body;

    if (!userId || !userType) {
      return res.status(400).json({
        success: false,
        error: 'userId and userType are required',
      });
    }

    if (!['user', 'admin', 'partner', 'employee'].includes(userType)) {
      return res.status(400).json({
        success: false,
        error: 'userType must be either "user", "admin", "employee", or "partner"',
      });
    }

    // Remove specific FCM token or all tokens
    if (userType === 'user') {
      if (fcmToken) {
        // Remove specific token (logout from one device)
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { fcmTokens: true },
        });

        if (user) {
          const tokens = Array.isArray(user.fcmTokens) ? user.fcmTokens : [];
          const updatedTokens = tokens.filter(t => t.token !== fcmToken);

          await prisma.user.update({
            where: { id: userId },
            data: { fcmTokens: updatedTokens },
          });

          console.log(`✅ FCM token removed for user: ${userId} - Remaining devices: ${updatedTokens.length}`);
        }
      } else {
        // Remove all tokens (logout from all devices)
        await prisma.user.update({
          where: { id: userId },
          data: { fcmTokens: [] },
        });

        console.log(`✅ All FCM tokens removed for user: ${userId}`);
      }
    } else if (userType === 'partner') {
      if (fcmToken) {
        const partner = await prisma.deliveryPartner.findUnique({ where: { id: userId }, select: { fcmTokens: true } });
        if (partner) {
          const updatedTokens = (Array.isArray(partner.fcmTokens) ? partner.fcmTokens : []).filter(t => t.token !== fcmToken);
          await prisma.deliveryPartner.update({ where: { id: userId }, data: { fcmTokens: updatedTokens } });
          console.log(`✅ FCM token removed for partner: ${userId}`);
        }
      } else {
        await prisma.deliveryPartner.update({ where: { id: userId }, data: { fcmTokens: [] } });
        console.log(`✅ All FCM tokens removed for partner: ${userId}`);
      }
    } else if (userType === 'employee') {
      if (fcmToken) {
        const employee = await prisma.employee.findUnique({ where: { id: userId }, select: { fcmTokens: true } });
        if (employee) {
          const updatedTokens = (Array.isArray(employee.fcmTokens) ? employee.fcmTokens : []).filter(t => t.token !== fcmToken);
          await prisma.employee.update({ where: { id: userId }, data: { fcmTokens: updatedTokens } });
          console.log(`✅ FCM token removed for employee: ${userId}`);
        }
      } else {
        await prisma.employee.update({ where: { id: userId }, data: { fcmTokens: [] } });
        console.log(`✅ All FCM tokens removed for employee: ${userId}`);
      }
    } else {
      if (fcmToken) {
        // Remove specific token
        const admin = await prisma.admin.findUnique({
          where: { id: userId },
          select: { fcmTokens: true },
        });

        if (admin) {
          const tokens = Array.isArray(admin.fcmTokens) ? admin.fcmTokens : [];
          const updatedTokens = tokens.filter(t => t.token !== fcmToken);

          await prisma.admin.update({
            where: { id: userId },
            data: { fcmTokens: updatedTokens },
          });

          console.log(`✅ FCM token removed for admin: ${userId} - Remaining devices: ${updatedTokens.length}`);
        }
      } else {
        // Remove all tokens
        await prisma.admin.update({
          where: { id: userId },
          data: { fcmTokens: [] },
        });

        console.log(`✅ All FCM tokens removed for admin: ${userId}`);
      }
    }

    res.json({
      success: true,
      message: 'FCM token removed successfully',
    });
  } catch (error) {
    console.error('❌ Error removing FCM token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove FCM token',
      message: error.message,
    });
  }
};

module.exports = {
  saveFCMToken,
  removeFCMToken,
};
