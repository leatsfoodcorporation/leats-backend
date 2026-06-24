const { getCompanyData } = require("../delivery-partner/helpers");

/**
 * Employee invitation email — sent when status changes from draft → invited
 * Contains: welcome message, employee ID, temporary password, verification link
 */
function getInvitationEmailTemplate(data) {
  const {
    employeeName,
    employeeId,
    email,
    tempPassword,
    verificationLink,
    roleName,
    departmentName,
    companyData,
  } = data;

  const styles = {
    body: "margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;",
    container: "max-width:600px;margin:0 auto;background:#ffffff;",
    header: "background:#e63946;padding:24px;text-align:center;",
    content: "padding:32px 24px;",
    footer: "background:#f8f9fa;padding:16px 24px;text-align:center;border-top:1px solid #eee;",
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="${styles.body}">
      <div style="${styles.container}">
        <!-- Header -->
        <div style="${styles.header}">
          ${companyData?.logoUrl ? `<img src="${companyData.logoUrl}" alt="Logo" style="max-height: 60px; max-width: 200px;">` : ''}
          <h1 style="color: #ffffff; margin: 10px 0 0 0; font-size: 24px;">${companyData?.companyName || 'LEATS'}</h1>
        </div>

        <!-- Content -->
        <div style="${styles.content}">
          <h2 style="color: #333; margin-bottom: 20px;">Welcome to the Team! 🎉</h2>

          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            Hello <strong>${employeeName}</strong>,
          </p>

          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            You have been added as an employee at <strong>${companyData?.companyName || 'LEATS'}</strong>.
            Please verify your email and use the credentials below to access the dashboard.
          </p>

          <!-- Employee Details -->
          <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #e63946;">
            <h3 style="color: #333; margin-top: 0;">Your Account Details</h3>
            <table style="width: 100%; font-size: 14px; color: #555;">
              <tr><td style="padding: 6px 0; font-weight: bold;">Employee ID:</td><td>${employeeId}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Email:</td><td>${email}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Temporary Password:</td><td style="font-family: monospace; background: #fff3cd; padding: 4px 8px; border-radius: 4px;">${tempPassword}</td></tr>
              ${roleName ? `<tr><td style="padding: 6px 0; font-weight: bold;">Role:</td><td>${roleName}</td></tr>` : ''}
              ${departmentName ? `<tr><td style="padding: 6px 0; font-weight: bold;">Department:</td><td>${departmentName}</td></tr>` : ''}
            </table>
          </div>

          <!-- Verify Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background: #e63946; color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
              Verify Email & Activate Account
            </a>
          </div>

          <p style="color: #888; font-size: 13px; text-align: center;">
            After verification, login at the dashboard and change your password.
          </p>

          <!-- Steps -->
          <div style="background: #f0f7ff; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h4 style="color: #333; margin-top: 0;">Next Steps:</h4>
            <ol style="color: #555; font-size: 14px; line-height: 1.8;">
              <li>Click the "Verify Email" button above</li>
              <li>Login with your email and temporary password</li>
              <li>Change your password immediately after first login</li>
              <li>Start using the dashboard based on your assigned permissions</li>
            </ol>
          </div>
        </div>

        <!-- Footer -->
        <div style="${styles.footer}">
          <p style="margin: 0; color: #999; font-size: 12px;">
            This is an automated email from ${companyData?.companyName || 'LEATS'}. Please do not reply.
          </p>
          ${companyData?.phone ? `<p style="margin: 4px 0 0 0; color: #999; font-size: 12px;">Contact: ${companyData.phone}</p>` : ''}
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = { getInvitationEmailTemplate };
