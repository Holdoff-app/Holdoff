/**
 * One-shot Android launch blast job.
 * Run on app startup when BLAST_TRIGGER=1 is set.
 * Reads waitlist emails, sends the Android launch email to each,
 * logs results to stdout (Render logs).
 */
const { pool } = require('../db/index');
const { sendEmail } = require('../services/email');
const fs = require('fs');
const path = require('path');

const MARKER = path.join(__dirname, '.blast-done');

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

async function sendBlastEmail(to) {
  await sendEmail({ to, subject: SUBJECT, text: PLAIN_TEXT, html: HTML_BODY });
}

module.exports = async function runBlast() {
  if (process.env.BLAST_TRIGGER !== '1') return;
  if (fs.existsSync(MARKER)) {
    console.log('[blast] .blast-done marker found — skipping');
    return;
  }

  console.log('[blast] BLAST_TRIGGER set — starting Android launch email blast via Resend');

  console.log('[blast] Fetching waitlist emails…');
  const result = await pool.query('SELECT email FROM waitlist ORDER BY created_at');
  const emails = result.rows.map(r => r.email);
  console.log(`[blast] Found ${emails.length} waitlist email(s)`);

  if (emails.length === 0) {
    console.log('[blast] No emails to send — done.');
    return;
  }

  const RATE_LIMIT = 50;
  const toSend = emails.slice(0, RATE_LIMIT);

  if (emails.length > RATE_LIMIT) {
    console.warn(`[blast] ⚠️  ${emails.length} emails exceeds daily limit of ${RATE_LIMIT} — sending first ${RATE_LIMIT} only.`);
  }

  let sent = 0, failed = 0;

  for (const email of toSend) {
    try {
      await sendBlastEmail(email);
      console.log(`[blast] ✓ ${email}`);
      sent++;
    } catch (err) {
      console.error(`[blast] ✗ ${email}: ${err.message}`);
      failed++;
    }
    await sleep(200);
  }

  fs.writeFileSync(MARKER, new Date().toISOString());
  console.log('\n[blast] === SUMMARY ===');
  console.log(`[blast] Total in waitlist: ${emails.length} | Attempted: ${toSend.length} | Sent: ${sent} | Failed: ${failed}`);
  console.log('[blast] Blast complete — marker written, self-disabling on next deploy');
};