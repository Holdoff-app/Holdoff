/**
 * Win-back email template — 7-day paywall re-engagement with 20% off coupon.
 * Owns: HTML/text templates for the d7 win-back email (subject, body, CTAs).
 * Does NOT own: email sending (services/email.js), Stripe coupon creation, DB writes.
 */

const APP_URL = process.env.APP_URL || 'https://shouldiholdoff.live';

/**
 * Build the win-back email.
 * @param {Object} opts
 * @param {string} opts.monthlyUrl  — checkout link for Monthly Online with coupon pre-applied + UTM
 * @param {string} opts.annualUrl   — checkout link for Annual Online with coupon pre-applied + UTM
 * @param {string} opts.couponCode  — Stripe coupon code to display as backup in email body
 * @returns {{ subject: string, html: string, text: string }}
 */
function buildWinbackEmail({ monthlyUrl, annualUrl, couponCode }) {
  const subject = "The 5 verdicts ran out. Here's 20% off the rest.";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">
          <tr>
            <td style="padding:32px 40px 0;border-bottom:1px solid #2a2a2a;">
              <p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">HoldOff</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px 8px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;letter-spacing:-0.4px;">
                You used what was free.
              </h1>
              <p style="margin:0 0 20px;font-size:15px;color:#aaaaaa;line-height:1.6;">
                The next 11 PM spiral is still coming. 20% off any plan, one time, expires in 72 hours.
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#aaaaaa;line-height:1.6;">
                Or use code <strong style="color:#ffffff;">${couponCode}</strong> at checkout.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="border-radius:8px;background:#8b5cf6;">
                    <a href="${monthlyUrl}"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                      Monthly — $7.99/mo →
                    </a>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="border-radius:8px;background:#2a2a2a;border:1px solid #444444;">
                    <a href="${annualUrl}"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                      Annual — $79.20/yr &nbsp;<span style="font-size:12px;color:#8b5cf6;font-weight:700;">BEST VALUE</span>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #2a2a2a;">
              <p style="margin:0;font-size:12px;color:#555555;line-height:1.6;">
                You're receiving this because you tried HoldOff and hit the free verdict limit.
                Offer expires 72 hours after send. <a href="${APP_URL}" style="color:#555555;">shouldiholdoff.live</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `You used what was free.

The next 11 PM spiral is still coming. 20% off any plan, one time, expires in 72 hours.

Monthly ($7.99/mo after discount):
${monthlyUrl}

Annual ($79.20/yr after discount) — best value:
${annualUrl}

Or use code ${couponCode} at checkout.

---
You're receiving this because you tried HoldOff and hit the free verdict limit.
Offer expires 72 hours after send.
${APP_URL}`;

  return { subject, html, text };
}

module.exports = { buildWinbackEmail };
