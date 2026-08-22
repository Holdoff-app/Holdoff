/**
 * Nurture email cron job — processes the auto_intercept waitlist sequence.
 * Runs every 15 minutes via render cron [[crons]].
 * Sends email 2 (72hr after signup) to any due rows in nurture_queue.
 * Email 3 (launch announcement) is triggered separately via POST /api/admin/auto-intercept-launch.
 */
const { getDueNurtureEmails, markNurtureSent, markNurtureFailed } = require('../db/nurture-queue');
const { sendEmail } = require('../services/email');
const { email2 } = require('../services/nurture-emails');

async function run() {
  const rows = await getDueNurtureEmails(2);

  if (rows.length === 0) {
    console.log('[nurture] no email-2 rows due');
    return { sent: 0, failed: 0 };
  }

  console.log(`[nurture] processing ${rows.length} email-2 row(s)`);

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const { subject, html, text } = email2({ email: row.email });
      await sendEmail({ to: row.email, subject, html, text });
      await markNurtureSent(row.id);
      console.log(`[nurture] email-2 sent to ${row.email}`);
      sent++;
    } catch (err) {
      await markNurtureFailed(row.id, err.message);
      console.error(`[nurture] email-2 FAILED for ${row.email}: ${err.message}`);
      failed++;
    }
  }

  console.log(`[nurture] done — sent=${sent} failed=${failed}`);
  return { sent, failed };
}

// Allow direct invocation as a cron command
if (require.main === module) {
  run()
    .then(({ sent, failed }) => {
      process.exit(failed > 0 && sent === 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('[nurture] fatal:', err.message);
      process.exit(1);
    });
}

module.exports = { run };
