const { sendEmail, sendEmailWithEnv } = require("../../config/connectSMTP");
const { prisma } = require("../../config/database");

// Handle contact form submission
const submitContactForm = async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: "Name is required",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Message is required",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format",
      });
    }

    console.log("Processing contact form submission...");

    // Get company settings to get admin email
    const companySettings = await prisma.companySettings.findFirst();
    const adminEmail = companySettings?.email || process.env.ADMIN_EMAIL;

    if (!adminEmail) {
      console.error("Admin email not configured");
      return res.status(500).json({
        success: false,
        error: "Contact form is not configured properly. Please try again later.",
      });
    }

    // Prepare email content
    const emailSubject = `New Contact Form Submission from ${name}`;
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #E63946; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .field { margin-bottom: 15px; }
          .label { font-weight: bold; color: #555; }
          .value { margin-top: 5px; padding: 10px; background-color: white; border-left: 3px solid #E63946; }
          .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Contact Form Submission</h2>
          </div>
          <div class="content">
            <div class="field">
              <div class="label">Name:</div>
              <div class="value">${name}</div>
            </div>
            <div class="field">
              <div class="label">Email:</div>
              <div class="value">${email}</div>
            </div>
            ${phone ? `
            <div class="field">
              <div class="label">Phone:</div>
              <div class="value">${phone}</div>
            </div>
            ` : ''}
            <div class="field">
              <div class="label">Message:</div>
              <div class="value">${message.replace(/\n/g, '<br>')}</div>
            </div>
          </div>
          <div class="footer">
            <p>This email was sent from your website's contact form.</p>
            <p>Received on ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailText = `
New Contact Form Submission

Name: ${name}
Email: ${email}
${phone ? `Phone: ${phone}` : ''}

Message:
${message}

---
Received on ${new Date().toLocaleString()}
    `;

    // Try to send email with SMTP configuration
    let emailResult;
    try {
      // First try with company email configuration if available
      const emailConfig = await prisma.emailConfiguration.findFirst();
      
      if (emailConfig && emailConfig.smtpHost) {
        emailResult = await sendEmail(emailConfig, {
          to: adminEmail,
          subject: emailSubject,
          text: emailText,
          html: emailHtml,
        });
      } else {
        // Fallback to environment variables
        emailResult = await sendEmailWithEnv({
          to: adminEmail,
          subject: emailSubject,
          text: emailText,
          html: emailHtml,
        });
      }

      if (!emailResult.success) {
        console.error("Failed to send email:", emailResult.message);
        return res.status(500).json({
          success: false,
          error: "Failed to send your message. Please try again later.",
        });
      }

      console.log("Contact form email sent successfully");

      res.status(200).json({
        success: true,
        message: "Your message has been sent successfully! We'll get back to you soon.",
      });
    } catch (emailError) {
      console.error("Error sending contact form email:", emailError);
      return res.status(500).json({
        success: false,
        error: "Failed to send your message. Please try again later.",
      });
    }
  } catch (error) {
    console.error("Error processing contact form:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred while processing your request",
      message: error.message,
    });
  }
};

module.exports = {
  submitContactForm,
};
