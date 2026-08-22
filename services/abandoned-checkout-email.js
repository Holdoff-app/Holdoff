/**
 * Abandoned checkout recovery email templates.
 * Owns: subject line and HTML/text body for the one-shot abandoned-checkout email.
 * Does NOT own: email sending (services/email.js), DB writes, Stripe logic.
 */

const APP_URL = process.env.APP_URL || 'https://shouldiholdoff.live';

const TIER_LABELS = {
  online_weekly:  'HoldOff Online (weekly)',
  app_weekly:     'HoldOff App (weekly)',
  online_monthly: 'HoldOff Online (monthly)',
  app_monthly:    'HoldOff App (monthly)',
  online_annual:  'HoldOff Online (annual)',
  app_annual:     'HoldOff App (annual)',
  lifetime:       'HoldOff Lifetime',
};

/**
 * Build the recovery email for an abandoned Stripe checkout session.
 * @param {Object} opts
 * @param {string} opts.email
 * @param {string|null} opts.tier
 * @param {string|null} opts.paymentLink  — Stripe payment link URL
 * @param {string} opts.unsubToken
 * @returns {{ subject: string, html: string, text: string }}
 */
function buildAbandonedCheckoutEmail({ email, tier, paymentLink, unsubToken }) {
  const tierLabel = TIER_LABELS[tier] || 'HoldOff Pro';
  const ctaUrl = buildCtaUrl(paymentLink, tier);
  const unsubUrl = `${APP_URL}/api/abandoned-checkout/unsub?token=${unsubToken}`;

  const subject = "You almost held off — your spot's still open.";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 0;border-bottom:1px solid #2a2a2a;">
              <p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">HoldOff</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;letter-spacing:-0.4px;">
                Your ${tierLabel} spot is still here.
              </h1>
              <p style="margin:0 0 20px;font-size:15px;color:#aaaaaa;line-height:1.6;">
                You started checkout but didn't finish. Happens. No judgment.
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#cccccc;line-height:1.6;font-style:italic;border-left:3px solid #8b5cf6;padding-left:16px;">
                "The verdict you wanted at 11 PM is still there. So is the 30% of people who text anyway when they don't have it."
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="border-radius:8px;background:#8b5cf6;">
                    <a href="${ctaUrl}"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                      Complete your ${tierLabel} →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#666666;">
                Link expires. If you have questions, reply here — we read every one.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #2a2a2a;">
              <p style="margin:0;font-size:12px;color:#555555;line-height:1.6;">
                You're receiving this because you started a HoldOff checkout with this email address.
                <a href="${unsubUrl}" style="color:#666666;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = `Your ${tierLabel} spot is still here.

You started checkout but didn't finish. Happens. No judgment.

"The verdict you wanted at 11 PM is still there. So is the 30% of people who text anyway when they don't have it."

Complete your ${tierLabel}:
${ctaUrl}

---
You're receiving this because you started a HoldOff checkout with this email address.
Unsubscribe: ${unsubUrl}`;

  return { subject, html, text };
}

function buildCtaUrl(paymentLink, tier) {
  const base = paymentLink || fallbackPaymentLink(tier);
  if (!base) return `${APP_URL}/filter?utm_source=email&utm_medium=transactional&utm_campaign=abandoned_checkout`;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}utm_source=email&utm_medium=transactional&utm_campaign=abandoned_checkout`;
}

// Fallback to known payment links when session metadata doesn't include one.
const TIER_PAYMENT_LINKS = {
  online_weekly:  'https://buy.stripe.com/6oU5kEeZ35TP2rSbqn2sM0c',
  app_weekly:     'https://buy.stripe.com/bJe3cw7wB3LH2rS2TR2sM0d',
  online_monthly: 'https://buy.stripe.com/28EbJ23gl2HDgiIeCz2sM07',
  app_monthly:    'https://buy.stripe.com/5kQcN6cQVfupd6weCz2sM08',
  online_annual:  'https://buy.stripe.com/6oUeVeaIN5TPaYo0LJ2sM09',
  app_annual:     'https://buy.stripe.com/6oU9AU5otfup0jK2TR2sM0a',
  lifetime:       'https://buy.stripe.com/4gMfZi6sx4PLc2s9if2sM0b',
};

function fallbackPaymentLink(tier) {
  return TIER_PAYMENT_LINKS[tier] || null;
}

module.exports = { buildAbandonedCheckoutEmail };
