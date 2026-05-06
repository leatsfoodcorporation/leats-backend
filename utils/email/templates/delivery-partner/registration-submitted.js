const { getCompanyData } = require("./helpers");

/**
 * Delivery Partner Registration Submitted Email Template
 * Sent immediately after a partner submits their registration application
 */
async function getRegistrationSubmittedEmailTemplate({ name, email }) {
  const companyData = await getCompanyData();

  return {
    subject: `Registration Received - ${companyData.companyName} Delivery Partner`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px 10px 0 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .header-left {
            flex: 0 0 auto;
          }
          .header-logo {
            max-width: 180px;
            max-height: 80px;
          }
          .header-right {
            flex: 1;
            text-align: right;
          }
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
          }
          .header p {
            margin: 0;
            font-size: 16px;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .status-box {
            background: white;
            padding: 20px;
            border-left: 4px solid #f59e0b;
            margin: 20px 0;
            border-radius: 5px;
          }
          .status-box h3 {
            margin-top: 0;
            color: #f59e0b;
          }
          .steps {
            background: white;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .steps h3 {
            color: #667eea;
            margin-top: 0;
          }
          .steps ol {
            margin: 10px 0;
            padding-left: 20px;
          }
          .steps li {
            margin: 8px 0;
          }
          .info-box {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .info-box strong {
            color: #1e40af;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-right">
              <h1>Application Received</h1>
              <p>Registration Confirmation</p>
            </div>
          </div>

          <div class="content">
            <p>Dear <strong>${name}</strong>,</p>

            <p>Thank you for applying to join the <strong>${companyData.companyName}</strong> delivery partner network! We have successfully received your registration application.</p>

            <div class="status-box">
              <h3>Application Status: Under Review</h3>
              <p>Our admin team is currently reviewing your submitted documents and application details. This process usually takes <strong>24-48 hours</strong>.</p>
            </div>

            <div class="steps">
              <h3>What Happens Next?</h3>
              <ol>
                <li><strong>Document Verification</strong> — Our team will verify your submitted documents (Aadhar, Driving Licence, Vehicle RC, etc.)</li>
                <li><strong>Application Review</strong> — Your application details will be reviewed by our admin team</li>
                <li><strong>Approval Notification</strong> — Once approved, you will receive another email with your <strong>Partner ID</strong> and <strong>temporary login credentials</strong></li>
                <li><strong>Start Delivering</strong> — Log in to the app using your credentials and start accepting delivery requests!</li>
              </ol>
            </div>

            <div class="info-box">
              <strong>Important:</strong> Please do not attempt to log in until you receive the approval email with your credentials. Your account will only be activated after admin approval.
            </div>

            <p>If you have any questions about your application, feel free to reach out to our support team at <strong>${companyData.supportEmail}</strong> or call <strong>${companyData.supportPhone}</strong>.</p>

            <p>We appreciate your interest in partnering with us!</p>

            <p>Best regards,<br>
            <strong>${companyData.companyName} Delivery Team</strong></p>
          </div>

          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>If you didn't apply to become a delivery partner, please contact us at ${companyData.supportEmail}</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

module.exports = { getRegistrationSubmittedEmailTemplate };
