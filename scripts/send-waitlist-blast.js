/**
 * Send Android launch email to all waitlist subscribers.
 *
 * Usage: node scripts/send-waitlist-blast.js
 * Env vars (read from Render env): HOLDOFF_EMAIL_PROXY_URL, HOLDOFF_API_KEY, DATABASE_URL
 */

// Use the shared DB pool (same pattern as all other files)
const { pool } = require('../db/index');

const EMAIL_PROXY_URL = process.env.HOLDOFF_EMAIL_PROXY_URL || 'https://shouldiholdoff.live/api/proxy/email/send';
const API_TOKEN = process.env.HOLDOFF_API_KEY || process.env.HOLDOFF_API_TOKEN;

const SUBJECT = 'HoldOff is live on Android. iOS is next.';
const FROM_NAME = 'HoldOff';
const REPLY_TO = 'holdoff@shouldiholdoff.live';

const PLAIN_TEXT = `HoldOff shipped on Android this week. Direct APK, no Play Store, installs in under a minute.

Download: https://shouldiholdoff.live (Android button on the page)

Three free verdicts. After that, $9/mo, cancel whenever.

If you're on iOS — you're still on the list. We'll email you the second the iOS build lands. Should be soon.

In the meantime, the web version works on iPhone too. Add it to your home screen and it behaves like an app: https://shouldiholdoff.live

That's it. Go intercept a text.

— HoldOff

---
You're receiving this because you joined the HoldOff waitlist. To unsubscribe, reply with "unsubscribe".`;

const HTML_BODY = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #2A2522; line-height: 1.7; padding: 2rem 1rem; background: #fff;">
  <p style="margin-bottom: 1rem;">HoldOff shipped on Android this week. Direct APK, no Play Store, installs in under a minute.</p>
  <p style="margin-bottom: 1rem;"><a href="https://shouldiholdoff.live" style="color: #2A2522; font-weight: 600;">Download HoldOff →</a></p>
  <p style="margin-bottom: 1rem;">Three free verdicts. After that, $9/mo, cancel whenever.</p>
  <p style="margin-bottom: 1rem;">If you're on iOS — you're still on the list. We'll email you the second the iOS build lands. Should be soon.</p>
  <p style="margin-bottom: 1rem;">In the meantime, the <a href="https://shouldiholdoff.live" style="color: #2A2522;">web version works on iPhone too</a>. Add it to your home screen and it behaves like an app.</p>
  <p style="margin-bottom: 1.5rem;">That's it. Go intercept a text.</p>
  <p style="margin-bottom: 2rem;">— HoldOff</p>
  <hr style="border: none; border-top: 1px solid #E5DED4; margin: 1.5rem 0;">
  <p style="font-size: 0.8rem; color: #8A7F79;">You're receiving this because you joined the HoldOff waitlist. To unsubscribe, reply with "unsubscribe".</p>
</body>
</html>`;

async function sendEmail(to) {
  const resp = await fetch(EMAIL_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({
      to,
      subject: SUBJECT,
      body: PLAIN_TEXT,
      html: HTML_BODY,
      from_name: FROM_NAME,
      reply_to: REPLY_TO,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Email proxy returned ${resp.status}: ${text}`);
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  if (!API_TOKEN) {
    console.error('[blast] HOLDOFF_API_KEY not set — aborting');
    process.exit(1);
  }

  if (!EMAIL_PROXY_URL) {
    console.error('[blast] HOLDOFF_EMAIL_PROXY_URL not set — aborting');
    process.exit(1);
  }

  console.log('[blast] Fetching waitlist emails…');
  const result = await pool.query('SELECT email FROM waitlist ORDER BY created_at');
  const emails = result.rows.map(r => r.email);

  console.log(`[blast] Found ${emails.length} waitlist email(s)`);

  if (emails.length === 0) {
    console.log('[blast] No emails to send — done.');
    return;
  }

  // Warn if we're about to blow the rate limit
  const RATE_LIMIT = 50;
  if (emails.length > RATE_LIMIT) {
    console.warn(`[blast] ⚠️  Waitlist has ${emails.length} emails but rate limit is ${RATE_LIMIT}/day from deployed apps. Sending first ${RATE_LIMIT} only.`);
  } else {
    console.log(`[blast] Rate limit check: ${emails.length} emails → ok (limit ${RATE_LIMIT}/day)`);
  }

  let sent = 0;
  let failed = 0;

  const toSend = emails.slice(0, RATE_LIMIT);

  for (const email of toSend) {
    try {
      await sendEmail(email);
      console.log(`[blast] ✓ Sent to ${email}`);
      sent++;
    } catch (err) {
      console.error(`[blast] ✗ Failed to send to ${email}: ${err.message}`);
      failed++;
    }
    // 200ms delay between sends to avoid hammering the proxy
    await sleep(200);
  }

  console.log('\n[blast] === SUMMARY ===');
  console.log(`[blast] Total in waitlist: ${emails.length}`);
  console.log(`[blast] Attempted to send: ${toSend.length}`);
  console.log(`[blast] Sent: ${sent}`);
  console.log(`[blast] Failed: ${failed}`);

  if (emails.length > RATE_LIMIT) {
    console.warn(`[blast] Note: ${emails.length - RATE_LIMIT} emails were skipped due to rate limit. Re-run tomorrow or split into batches.`);
  }
}

main().catch(err => {
  console.error('[blast] Fatal error:', err.message);
  process.exit(1);
});