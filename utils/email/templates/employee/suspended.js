/**
 * Employee suspension notice email
 */
function getSuspendedEmailTemplate(data) {
  const { employeeName, reason, note, companyData } = data;
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
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="${styles.body}">
      <div style="${styles.container}">
        <div style="${styles.header}">
          ${companyData?.logoUrl ? `<img src="${companyData.logoUrl}" alt="Logo" style="max-height: 60px;">` : ''}
          <h1 style="color: #ffffff; margin: 10px 0 0 0;">${companyData?.companyName || 'LEATS'}</h1>
        </div>
        <div style="${styles.content}">
          <h2 style="color: #dc2626;">Account Suspended ⚠️</h2>
          <p style="color: #555; font-size: 16px;">Hello <strong>${employeeName}</strong>,</p>
          <p style="color: #555; font-size: 16px;">Your employee account has been suspended.</p>
          ${reason ? `
            <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <h4 style="margin-top: 0; color: #dc2626;">Reason:</h4>
              <p style="color: #555; font-size: 14px;">${reason}</p>
              ${note ? `<p style="color: #888; font-size: 13px; margin-top: 8px;">${note}</p>` : ''}
            </div>
          ` : ''}
          <p style="color: #555; font-size: 14px;">You will not be able to login until your account is reactivated. Please contact the administrator for more information.</p>
        </div>
        <div style="${styles.footer}">
          <p style="margin: 0; color: #999; font-size: 12px;">This is an automated email from ${companyData?.companyName || 'LEATS'}.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = { getSuspendedEmailTemplate };
