/**
 * Abandoned checkout recovery job.
 * Sweeps pending sessions older than 60 min and fires one recovery email per email address.
 * Suppresses if the address converted in the last 30 days or already received an email.
 */
const {
  getPendingAbandonedCheckouts,
  markAbandonedCheckoutEmailed,
  markAbandonedCheckoutSuppressed,
  emailConvertedRecently,
  emailAlreadySentRecently,
} = require('../db/abandoned-checkouts');
const { sendEmail } = require('../services/email');
const { buildAbandonedCheckoutEmail } = require('../services/abandoned-checkout-email');

async function run() {
  const rows = await getPendingAbandonedCheckouts(60 * 60 * 1000); // 60 min
  if (rows.length === 0) {
    console.log('[abandoned-checkout] nothing to process');
    return;
  }

  console.log(`[abandoned-checkout] processing ${rows.length} pending session(s)`);

  // Deduplicate by email — only contact each address once per sweep
  const seenEmails = new Set();

  for (const row of rows) {
    const email = row.email;

    if (seenEmails.has(email.toLowerCase())) {
      // Already queued a send to this address this sweep — suppress this dupe session
      await markAbandonedCheckoutSuppressed(row.session_id).catch(() => {});
      continue;
    }
    seenEmails.add(email.toLowerCase());

    try {
      // Suppression checks
      const converted = await emailConvertedRecently(email);
      if (converted) {
        console.log(`[abandoned-checkout] ${email} converted recently — suppressing ${row.session_id}`);
        await markAbandonedCheckoutSuppressed(row.session_id);
        continue;
      }

      const alreadyEmailed = await emailAlreadySentRecently(email);
      if (alreadyEmailed) {
        console.log(`[abandoned-checkout] ${email} already emailed recently — suppressing ${row.session_id}`);
        await markAbandonedCheckoutSuppressed(row.session_id);
        continue;
      }

      const { subject, html, text } = buildAbandonedCheckoutEmail({
        email,
        tier: row.tier,
        paymentLink: row.payment_link,
        unsubToken: row.unsub_token,
      });

      await sendEmail({ to: email, subject, html, text });
      await markAbandonedCheckoutEmailed(row.session_id);
      console.log(`[abandoned-checkout] sent recovery email to ${email} (session=${row.session_id}, tier=${row.tier})`);

    } catch (err) {
      console.error(`[abandoned-checkout] error for session ${row.session_id}:`, err.message);
    }
  }
}

// Run directly when invoked as a cron job
if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[abandoned-checkout] fatal error:', err.message);
      process.exit(1);
    });
}

module.exports = { run };
