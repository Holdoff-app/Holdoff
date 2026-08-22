/**
 * Dunning email templates — payment failure recovery for HoldOff Pro subscribers.
 * Owns: subject lines and HTML/text for dunning_d0 (T+0) and dunning_d3 (T+3 days).
 * Does NOT own: email sending (services/email.js), DB writes, Stripe Portal API calls.
 */

const APP_URL = process.env.APP_URL || 'https://shouldiholdoff.live';

/**
 * Build the day-0 dunning email (first notice, card declined).
 * @param {Object} opts
 * @param {string} opts.portalUrl — Stripe Customer Portal URL for payment method update
 * @returns {{ subject: string, html: string, text: string }}
 */
function buildDunningD0Email({ portalUrl }) {
  const subject = "Your HoldOff payment didn't go through.";
  const ctaUrl = `${portalUrl}&utm_source=email&utm_medium=transactional&utm_campaign=dunning_d0`;

  const html = buildHtml({
    headline: "Your card declined.",
    body: `Your filter is still on. Update your payment method in 60 seconds — link below. No action and your access lapses.`,
    ctaText: "Update payment method →",
    ctaUrl,
    footerNote: "You're receiving this because your HoldOff Pro payment failed.",
  });

  const text = `Your card declined.

Your filter is still on. Update your payment method in 60 seconds:
${ctaUrl}

No action and your access lapses.

---
You're receiving this because your HoldOff Pro payment failed.
${APP_URL}`;

  return { subject, html, text };
}

/**
 * Build the day-3 dunning email (last chance before lapse).
 * @param {Object} opts
 * @param {string} opts.portalUrl — Stripe Customer Portal URL for payment method update
 * @returns {{ subject: string, html: string, text: string }}
 */
function buildDunningD3Email({ portalUrl }) {
  const subject = "Last chance — your HoldOff lapses tomorrow.";
  const ctaUrl = `${portalUrl}&utm_source=email&utm_medium=transactional&utm_campaign=dunning_d3`;

  const html = buildHtml({
    headline: "Your filter lapses tomorrow.",
    body: `Still unpaid. Stripe cancels tomorrow. Fix it now — takes 30 seconds.`,
    ctaText: "Update payment method →",
    ctaUrl,
    footerNote: "You're receiving this because your HoldOff Pro subscription is past due.",
  });

  const text = `Your filter lapses tomorrow.

Still unpaid. Stripe cancels tomorrow. Fix it now — takes 30 seconds:
${ctaUrl}

---
You're receiving this because your HoldOff Pro subscription is past due.
${APP_URL}`;

  return { subject, html, text };
}

function buildHtml({ headline, body, ctaText, ctaUrl, footerNote }) {
  return `<!DOCTYPE html>
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
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;letter-spacing:-0.4px;">
                ${headline}
              </h1>
              <p style="margin:0 0 28px;font-size:15px;color:#aaaaaa;line-height:1.6;">
                ${body}
              </p>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="border-radius:8px;background:#8b5cf6;">
                    <a href="${ctaUrl}"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #2a2a2a;">
              <p style="margin:0;font-size:12px;color:#555555;line-height:1.6;">
                ${footerNote}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { buildDunningD0Email, buildDunningD3Email };
