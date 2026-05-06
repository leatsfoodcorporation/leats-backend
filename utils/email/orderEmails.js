const { sendEmail: sendSMTPEmail, sendEmailWithEnv } = require("../../config/connectSMTP");
const { prisma } = require("../../config/database");

/**
 * Send email using centralized SMTP configuration
 */
async function sendOrderEmail(emailData) {
  try {
    // Get active email configuration from database
    const emailConfig = await prisma.emailConfiguration.findFirst({
      where: { isActive: true }
    });

    let result;
    
    if (emailConfig) {
      // Use database SMTP configuration
      result = await sendSMTPEmail(emailConfig, emailData);
    } else {
      // Fallback to environment variables
      result = await sendEmailWithEnv(emailData);
    }

    if (!result.success) {
      throw new Error(result.message || 'Failed to send email');
    }
    
    return result;
  } catch (error) {
    console.error("❌ Order email sending error:", error);
    throw error;
  }
}

/**
 * Send order status update email to customer
 */
async function sendOrderStatusEmail(customerEmail, orderData) {
  const { orderNumber, customerName, status, partnerName, partnerPhone } = orderData;
  
  const statusMessages = {
    confirmed: {
      subject: `Order ${orderNumber} Confirmed`,
      heading: 'Order Confirmed',
      message: 'Your order has been confirmed and will be processed soon.',
      color: '#3b82f6',
    },
    packing: {
      subject: `Order ${orderNumber} Being Prepared`,
      heading: 'Order Being Prepared',
      message: 'Your order is being packed and will be shipped soon.',
      color: '#f59e0b',
    },
    shipped: {
      subject: `Order ${orderNumber} Out for Delivery`,
      heading: 'Order Shipped',
      message: `Your order is on the way! ${partnerName ? `Delivered by ${partnerName}` : ''}`,
      color: '#8b5cf6',
    },
    delivered: {
      subject: `Order ${orderNumber} Delivered`,
      heading: 'Order Delivered',
      message: 'Your order has been delivered successfully. Thank you for shopping with us!',
      color: '#10b981',
    },
    cancelled: {
      subject: `Order ${orderNumber} Cancelled`,
      heading: 'Order Cancelled',
      message: 'Your order has been cancelled. Please contact support for more details.',
      color: '#ef4444',
    },
  };

  const statusInfo = statusMessages[status] || statusMessages.confirmed;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${statusInfo.subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background-color: ${statusInfo.color}; padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                    ${statusInfo.heading}
                  </h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px; font-size: 16px; color: #374151;">
                    Hi ${customerName},
                  </p>
                  
                  <p style="margin: 0 0 20px; font-size: 16px; color: #374151;">
                    ${statusInfo.message}
                  </p>
                  
                  <!-- Order Details Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; margin: 20px 0;">
                    <tr>
                      <td style="padding: 20px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding: 8px 0; font-size: 14px; color: #6b7280;">Order Number:</td>
                            <td style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: bold; text-align: right;">${orderNumber}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; font-size: 14px; color: #6b7280;">Status:</td>
                            <td style="padding: 8px 0; font-size: 14px; color: ${statusInfo.color}; font-weight: bold; text-align: right; text-transform: capitalize;">${status}</td>
                          </tr>
                          ${partnerName ? `
                          <tr>
                            <td style="padding: 8px 0; font-size: 14px; color: #6b7280;">Delivery Partner:</td>
                            <td style="padding: 8px 0; font-size: 14px; color: #111827; text-align: right;">${partnerName}</td>
                          </tr>
                          ` : ''}
                          ${partnerPhone ? `
                          <tr>
                            <td style="padding: 8px 0; font-size: 14px; color: #6b7280;">Contact:</td>
                            <td style="padding: 8px 0; font-size: 14px; color: #111827; text-align: right;">${partnerPhone}</td>
                          </tr>
                          ` : ''}
                        </table>
                      </td>
                    </tr>
                  </table>
                  
                  ${status === 'delivered' ? `
                  <p style="margin: 20px 0 0; font-size: 14px; color: #6b7280; text-align: center;">
                    We hope you enjoyed your purchase! Please rate your experience.
                  </p>
                  ` : ''}
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; font-size: 12px; color: #6b7280;">
                    This is an automated email. Please do not reply to this message.
                  </p>
                  <p style="margin: 10px 0 0; font-size: 12px; color: #6b7280;">
                    © ${new Date().getFullYear()} Your Company. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return await sendOrderEmail({
    to: customerEmail,
    subject: statusInfo.subject,
    html: html,
  });
}

module.exports = {
  sendOrderStatusEmail,
};
