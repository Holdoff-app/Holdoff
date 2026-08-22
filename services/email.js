/**
 * Email service — Postmark API wrapper for HoldOff transactional and outreach email.
 * Owns: email composition, sending, domain verification status.
 * Does NOT own: list management, unsubscribe handling, template design.
 *
 * Falls back to HoldOff email service when POSTMARK_API_KEY is not set.
 * Falls back to console logging when neither Postmark nor HoldOff proxy is configured.
 */
const postmark = require('postmark');
const { isCapabilityAvailable } = require('../config/dependency-policy');
const { appendFailedWork } = require('./degraded-queue');

const FROM_NAME = 'HoldOff';
const FROM_EMAIL = 'hello@shouldiholdoff.live';

function createClient() {
  const apiKey = process.env.POSTMARK_API_KEY;
  if (!apiKey) return null;
  return new postmark.ServerClient(apiKey);
}

/**
 * Send a single email via Postmark.
 * @param {Object} opts
 * @param {string} opts.to          — recipient email
 * @param {string} opts.subject     — email subject
 * @param {string} opts.text        — plain text body
 * @param {string} [opts.html]      — HTML body (optional)
 * @param {string} [opts.replyTo]   — reply-to address override
 */
async function sendEmail({ to, subject, text, html, replyTo }) {
  const client = createClient();

  if (client && isCapabilityAvailable('email.postmark')) {
    try {
      const result = await client.sendEmail({
        From: `${FROM_NAME} <${FROM_EMAIL}>`,
        To: to,
        Subject: subject,
        TextBody: text,
        HtmlBody: html || undefined,
        ReplyTo: replyTo || undefined,
      });

      if (!result || result.ErrorCode !== 0) {
        throw new Error(`Postmark error: ${result?.Message || 'unknown'}`);
      }

      return { id: result.MessageID };
    } catch (err) {
      console.error('[email] postmark send failed:', err.message);
      appendFailedWork('email', { to, subject }, err.message);
    }
  }

  // HoldOff email service fallback when POSTMARK_API_KEY is not provisioned
  const proxyUrl =
    process.env.HOLDOFF_EMAIL_PROXY_URL ||
    (process.env.HOLDOFF_API_BASE_URL
      ? `${process.env.HOLDOFF_API_BASE_URL}/api/proxy/email/send`
      : null);
  const proxyToken = process.env.HOLDOFF_API_TOKEN || process.env.HOLDOFF_API_KEY;

  if (!proxyUrl || !proxyToken || !isCapabilityAvailable('email.proxy')) {
    // Last-resort: log to console so devs can see emails in dev
    console.log(`[email] ${subject} → ${to}`);
    console.log(`[email] text: ${text.slice(0, 200)}`);
    appendFailedWork('email', { to, subject }, 'No email provider configured');
    return { id: null, degraded: true };
  }

  try {
    const resp = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + proxyToken,
      },
      body: JSON.stringify({
        to,
        subject,
        text,
        html: html || undefined,
        from_name: FROM_NAME,
        from: FROM_EMAIL,
        reply_to: replyTo || undefined,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`HoldOff proxy error ${resp.status}: ${body}`);
    }

    const data = await resp.json().catch(() => ({}));
    return { id: data?.id || null };
  } catch (err) {
    console.error('[email] proxy send failed:', err.message);
    appendFailedWork('email', { to, subject }, err.message);
    return { id: null, degraded: true };
  }
}

/**
 * Check whether a sending domain is verified in Postmark.
 * Returns { verified: boolean, domain: string, records: array }
 */
async function getDomainStatus() {
  const client = createClient();
  if (!client) {
    return { verified: false, domain: FROM_EMAIL.split('@')[1], error: 'POSTMARK_API_KEY not set' };
  }

  const domain = FROM_EMAIL.split('@')[1];
  try {
    const data = await client.getDomain(domain);
    return {
      verified: data?.DNSSettings?.DKIM?.Verified ?? false,
      domain,
      records: data?.DNSSettings || [],
    };
  } catch (err) {
    return { verified: false, domain, error: err.message };
  }
}

module.exports = { sendEmail, getDomainStatus, FROM_EMAIL, FROM_NAME };
