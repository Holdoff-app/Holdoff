/**
 * Dunning email job — involuntary churn recovery.
 * Sends email-1 (T+0) to new payment failures, email-2 (T+3d) if still unpaid.
 * Skips Lifetime tier (no renewal billing). Max 2 emails per subscription per window.
 */
const {
  getPendingDunningD0,
  getPendingDunningD3,
  markDunningSentD0,
  markDunningSentD3,
} = require('../db/dunning');
const { sendEmail } = require('../services/email');
const { buildDunningD0Email, buildDunningD3Email } = require('../services/dunning-email');

/**
 * Create a Stripe Customer Portal URL for payment method update.
 * Returns null if STRIPE_SECRET_KEY is unavailable (will skip send).
 */
async function createPortalUrl(customerId, subscriptionId) {
  if (!process.env.STRIPE_SECRET_KEY || !customerId) return null;
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: (process.env.APP_URL || 'https://shouldiholdoff.live') + '/filter',
      flow_data: {
        type: 'payment_method_update',
      },
    });
    return session.url;
  } catch (err) {
    console.error(`[dunning] Could not create portal URL for customer ${customerId}:`, err.message);
    return null;
  }
}

async function run() {
  console.log('[dunning] Running dunning email job');

  // Email 1 — T+0 (pending rows, no email sent)
  const d0Rows = await getPendingDunningD0();
  console.log(`[dunning] ${d0Rows.length} row(s) pending d0`);

  for (const row of d0Rows) {
    try {
      const portalUrl = await createPortalUrl(row.customer_id, row.subscription_id);
      if (!portalUrl) {
        console.warn(`[dunning] No portal URL for sub ${row.subscription_id} — skipping d0`);
        continue;
      }

      const { subject, html, text } = buildDunningD0Email({ portalUrl });
      await sendEmail({ to: row.email, subject, html, text });
      await markDunningSentD0(row.id);
      console.log(`[dunning] d0 sent to ${row.email} (sub=${row.subscription_id})`);
    } catch (err) {
      console.error(`[dunning] d0 error for sub ${row.subscription_id}:`, err.message);
    }
  }

  // Email 2 — T+3d (sent_d0, still unpaid after 3 days)
  const d3Rows = await getPendingDunningD3();
  console.log(`[dunning] ${d3Rows.length} row(s) pending d3`);

  for (const row of d3Rows) {
    try {
      const portalUrl = await createPortalUrl(row.customer_id, row.subscription_id);
      if (!portalUrl) {
        console.warn(`[dunning] No portal URL for sub ${row.subscription_id} — skipping d3`);
        continue;
      }

      const { subject, html, text } = buildDunningD3Email({ portalUrl });
      await sendEmail({ to: row.email, subject, html, text });
      await markDunningSentD3(row.id);
      console.log(`[dunning] d3 sent to ${row.email} (sub=${row.subscription_id})`);
    } catch (err) {
      console.error(`[dunning] d3 error for sub ${row.subscription_id}:`, err.message);
    }
  }

  console.log('[dunning] Done');
}

// Run directly when invoked as a cron job
if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[dunning] Fatal error:', err.message);
      process.exit(1);
    });
}

module.exports = { run };
