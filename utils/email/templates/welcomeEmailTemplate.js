const { prisma } = require("../../../config/database");
const { getPresignedUrl } = require("../../web/uploadsS3");

/**
 * Fetch company logo from web settings
 */
async function getCompanyLogo() {
  try {
    const webSettings = await prisma.webSettings.findFirst();
    if (webSettings && webSettings.logoUrl) {
      return getPresignedUrl(webSettings.logoUrl);
    }
    return null;
  } catch (error) {
    console.error("Error fetching company logo:", error);
    return null;
  }
}

/**
 * Fetch company name from company settings
 */
async function getCompanyName() {
  try {
    const companySettings = await prisma.companySettings.findFirst();
    if (companySettings && companySettings.companyName) {
      return companySettings.companyName;
    }
    return "Our Platform";
  } catch (error) {
    console.error("Error fetching company name:", error);
    return "Our Platform";
  }
}

/**
 * Welcome Email Template
 * Sent after user email verification
 */
const getWelcomeEmailTemplate = async (data) => {
  const { email, name } = data;
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const logoUrl = await getCompanyLogo();
  const companyName = await getCompanyName();

  return {
    subject: `Welcome to ${companyName}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; padding: 20px;">
        <div style="background-color: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb;">
            ${logoUrl ? `<img src="${logoUrl}" alt="${companyName} Logo" style="max-width: 180px; max-height: 80px; margin-bottom: 20px;" />` : ''}
            <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Welcome! 🎉</h1>
          </div>
          
          <div style="color: #374151; line-height: 1.6; font-size: 16px;">
            <p>Hello <strong>${name || 'there'}</strong>,</p>
            <p>Your email has been verified successfully!</p>
            <p>You can now access all features of <strong>${companyName}</strong>.</p>
          </div>

          <div style="text-align: center; margin: 40px 0;">
            <a href="${frontendUrl}/" 
               style="background-color: #10B981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
              Go to Dashboard
            </a>
          </div>

          <div style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            <p>Thank you for joining us!</p>
            <p style="margin-top: 20px;">Best regards,<br>The ${companyName} Team</p>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
          <p>This is an automated email. Please do not reply.</p>
        </div>
      </div>
    `,
  };
};

module.exports = {
  getWelcomeEmailTemplate,
};
