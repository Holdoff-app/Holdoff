/**
 * One-shot waitlist blast route. POST /api/blast/send-waitlist
 * Owns: sending the Android launch email to waitlist subscribers.
 * Does NOT own: general mailing, list management.
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../db/index');
const { sendEmail } = require('../services/email');

const SUBJECT = 'HoldOff is live on Android. iOS is next.';
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
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #2A2522; line-height: 1.7; padding: 2rem 1rem; background: #fff;">
  <p style="margin-bottom: 1rem;">HoldOff shipped on Android this week. Direct APK, no Play Store, installs in under a minute.</p>
  <p style="margin-bottom: 1rem;"><a href="https://shouldiholdoff.live" style="color: #2A2522; font-weight: 600;">Download HoldOff</a></p>
  <p style="margin-bottom: 1rem;">Three free verdicts. After that, $9/mo, cancel whenever.</p>
  <p style="margin-bottom: 1rem;">If you're on iOS — you're still on the list. We'll email you the second the iOS build lands. Should be soon.</p>
  <p style="margin-bottom: 1rem;">In the meantime, <a href="https://shouldiholdoff.live" style="color: #2A2522;">the web version works on iPhone too</a>. Add it to your home screen and it behaves like an app.</p>
  <p style="margin-bottom: 1.5rem;">That's it. Go intercept a text.</p>
  <p style="margin-bottom: 2rem;">— HoldOff</p>
  <hr style="border: none; border-top: 1px solid #E5DED4; margin: 1.5rem 0;">
  <p style="font-size: 0.8rem; color: #8A7F79;">You're receiving this because you joined the HoldOff waitlist. To unsubscribe, reply with "unsubscribe".</p>
</body>
</html>`;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// POST /api/blast/send-waitlist — one-shot, delete after use
router.post('/send-waitlist', async (req, res) => {
  if (req.headers['x-blast-secret'] !== process.env.BLAST_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[blast] Starting waitlist email blast via Resend…');
  const result = await pool.query('SELECT email FROM waitlist ORDER BY created_at');
  const emails = result.rows.map(r => r.email);
  console.log(`[blast] Found ${emails.length} waitlist email(s)`);

  if (emails.length === 0) {
    return res.json({ sent: 0, failed: 0, note: 'No waitlist emails found' });
  }

  const RATE_LIMIT = 50;
  const toSend = emails.slice(0, RATE_LIMIT);

  if (emails.length > RATE_LIMIT) {
    console.warn(`[blast] ⚠️  ${emails.length} emails exceeds daily limit of ${RATE_LIMIT} — sending first ${RATE_LIMIT} only.`);
  }

  let sent = 0, failed = 0;
  const errors = [];

  for (const email of toSend) {
    try {
      await sendEmail({ to: email, subject: SUBJECT, text: PLAIN_TEXT, html: HTML_BODY });
      console.log(`[blast] ✓ ${email}`);
      sent++;
    } catch (err) {
      console.error(`[blast] ✗ ${email}: ${err.message}`);
      errors.push({ email, error: err.message });
      failed++;
    }
    await sleep(200);
  }

  console.log('\n[blast] === SUMMARY ===');
  console.log(`[blast] Total in waitlist: ${emails.length} | Attempted: ${toSend.length} | Sent: ${sent} | Failed: ${failed}`);

  res.json({ sent, failed, totalInWaitlist: emails.length, errors: errors.slice(0, 10) });
});

module.exports = router;