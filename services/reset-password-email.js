/**
 * Reset password email builder.
 */
function buildResetPasswordEmail({ email, token, name }) {
  const resetUrl = `https://shouldiholdoff.live/reset-password?token=${encodeURIComponent(token)}`;
  
  const subject = 'Reset Your HoldOff Password';

  const text = `
Hello${name ? ' ' + name : ''},

We received a request to reset the password for your HoldOff account.

Click the link below to reset your password. This link expires in 1 hour.

${resetUrl}

If you didn't request a password reset, you can safely ignore this email.

Respect yourself,
The HoldOff Team
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #d946a6 0%, #a946d9 100%); color: white; padding: 40px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8f4ff; padding: 40px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #d946a6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 20px 0; font-weight: 600; }
    .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
    .warning { background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 12px; margin: 20px 0; border-radius: 4px; }
    .timer { color: #d946a6; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">💜 Reset Your Password</h1>
    </div>
    <div class="content">
      <p>Hello${name ? ' <strong>' + name + '</strong>' : ''},</p>
      <p>We received a request to reset the password for your HoldOff account.</p>
      <p style="margin: 30px 0;">Click the button below to reset your password:</p>
      <p style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset My Password</a>
      </p>
      <p style="color: #888; font-size: 13px; text-align: center;">Or copy this link in your browser:<br><span style="word-break: break-all;">${resetUrl}</span></p>
      <div class="warning">
        <strong>⏱ This link expires in <span class="timer">1 hour</span>.</strong><br>
        If you don't use it by then, you'll need to request a new password reset.
      </div>
      <p style="margin-top: 30px;">If you didn't request a password reset, you can safely ignore this email. Your account is secure.</p>
    </div>
    <div class="footer">
      <p>&copy; HoldOff. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, text, html };
}

module.exports = { buildResetPasswordEmail };
