/**
 * Detox email cron job — processes the 5-day Anxious Texting Detox drip sequence.
 * Runs every hour via render cron [[crons]].
 * Sends the next day's email to subscribers whose next_send_at <= NOW().
 */
const { getDueDetoxSubscribers, advanceDetoxSubscriber } = require('../db/detox');
const { sendEmail } = require('../services/email');
const { getDetoxEmail } = require('../services/detox-emails');

async function run() {
  const rows = await getDueDetoxSubscribers();

  if (rows.length === 0) {
    console.log('[detox] no subscribers due');
    return { sent: 0, failed: 0 };
  }

  console.log(`[detox] processing ${rows.length} subscriber(s)`);

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const emailFn = getDetoxEmail(row.next_step);
      const { subject, html, text } = emailFn({ email: row.email });
      await sendEmail({ to: row.email, subject, html, text });
      await advanceDetoxSubscriber(row.id);
      console.log(`[detox] day${row.next_step} sent to ${row.email}`);
      sent++;
    } catch (err) {
      // Non-fatal per subscriber — log and continue
      console.error(`[detox] day${row.next_step} FAILED for ${row.email}: ${err.message}`);
      failed++;
    }
  }

  console.log(`[detox] done — sent=${sent} failed=${failed}`);
  return { sent, failed };
}

// Allow direct invocation as a cron command
if (require.main === module) {
  run()
    .then(({ sent, failed }) => {
      process.exit(failed > 0 && sent === 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('[detox] fatal:', err.message);
      process.exit(1);
    });
}

module.exports = { run };
