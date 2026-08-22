/**
 * Welcome email builder for new signup.
 */
function buildWelcomeEmail({ email, name }) {
  const subject = 'Welcome to HoldOff — Your Pause Starts Now';

  const text = `
Hello${name ? ' ' + name : ''},

Welcome to HoldOff! We're thrilled to have you join our community.

HoldOff is your 3-minute pause before you spiral — a moment to filter what you're about to send.

Get started:
1. Log in to your account
2. Connect your contacts
3. Start using the message filter

Questions? Reply to this email or visit our help center.

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
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">💜 Welcome to HoldOff</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Your 3-minute pause before you spiral</p>
    </div>
    <div class="content">
      <p>Hello${name ? ' <strong>' + name + '</strong>' : ''},</p>
      <p>We're thrilled to have you join our community of people who respect themselves enough to pause.</p>
      <p><strong>What's next?</strong></p>
      <ol>
        <li>Log in to your account</li>
        <li>Connect your contacts</li>
        <li>Start using the message filter</li>
      </ol>
      <a href="https://shouldiholdoff.live/login" class="button">Log In to HoldOff</a>
      <p>Questions? Reply to this email or visit our help center.</p>
      <p style="color: #888; font-size: 14px;">We're here to support your journey toward respecting yourself.</p>
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

module.exports = { buildWelcomeEmail };
