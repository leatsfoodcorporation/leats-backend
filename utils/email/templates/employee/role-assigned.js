/**
 * Role assigned/changed notification email
 */
function getRoleAssignedEmailTemplate(data) {
  const { employeeName, roleName, permissions, companyData } = data;
  const styles = {
    body: "margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;",
    container: "max-width:600px;margin:0 auto;background:#ffffff;",
    header: "background:#e63946;padding:24px;text-align:center;",
    content: "padding:32px 24px;",
    footer: "background:#f8f9fa;padding:16px 24px;text-align:center;border-top:1px solid #eee;",
  };

  // Group permissions by group for display
  const permissionSummary = (permissions || [])
    .map(p => `${p.module.replace(/_/g, ' ')}: ${p.actions.join(', ')}`)
    .join('<br>');

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
          <h2 style="color: #333;">Role Updated 🔑</h2>
          <p style="color: #555; font-size: 16px;">Hello <strong>${employeeName}</strong>,</p>
          <p style="color: #555; font-size: 16px;">Your role has been updated to <strong>${roleName}</strong>.</p>
          <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #4CAF50;">
            <h4 style="margin-top: 0; color: #333;">Your Permissions:</h4>
            <p style="color: #555; font-size: 13px; line-height: 1.8;">${permissionSummary || 'No specific permissions assigned'}</p>
          </div>
          <p style="color: #888; font-size: 13px;">Your dashboard access has been updated. Please login to see the changes.</p>
        </div>
        <div style="${styles.footer}">
          <p style="margin: 0; color: #999; font-size: 12px;">This is an automated email from ${companyData?.companyName || 'LEATS'}.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = { getRoleAssignedEmailTemplate };
