/**
 * Win-back email job — 7-day paywall re-engagement with single-use 20% off Stripe coupon.
 * Runs every 6 hours. Finds logged-in free users whose paywall_hit_at was 7–8 days ago,
 * creates a per-user single-use Stripe coupon (20% off, expires 72hr), fires the email,
 * stamps winback_sent_at. Logs winback_sent to exit_intent_events for metrics.
 */
const { getWinbackCandidates, markWinbackSent } = require('../db/users');
const { sendEmail } = require('../services/email');
const { buildWinbackEmail } = require('../services/winback-email');
const { logExitIntentEvent } = require('../db/exit-intent');

const APP_URL = process.env.APP_URL || 'https://shouldiholdoff.live';
const UTM = 'utm_source=email&utm_medium=transactional&utm_campaign=winback_d7';

// Base payment links for Monthly Online and Annual Online tiers.
// Coupon will be pre-applied via ?prefilled_promo_code= on Stripe Checkout links.
const MONTHLY_BASE_URL = 'https://buy.stripe.com/28EbJ23gl2HDgiIeCz2sM07';
const ANNUAL_BASE_URL  = 'https://buy.stripe.com/6oUeVeaIN5TPaYo0LJ2sM09';

/**
 * Create a single-use 20% off Stripe coupon that expires 72hr from now.
 * Returns { couponId, couponCode } or throws on error.
 */
async function createWinbackCoupon(userId) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  // Short human-readable code — user_id prefix for traceability, 6 random hex chars.
  const suffix = require('crypto').randomBytes(3).toString('hex').toUpperCase();
  const couponCode = `HOLDOFF20-${suffix}`;

  const redeemBy = Math.floor(Date.now() / 1000) + 72 * 60 * 60; // 72hr from now

  const coupon = await stripe.coupons.create({
    id: couponCode,
    percent_off: 20,
    duration: 'once',
    max_redemptions: 1,
    redeem_by: redeemBy,
    metadata: { user_id: String(userId), campaign: 'winback_d7' },
  });

  return { couponId: coupon.id, couponCode };
}

/**
 * Build checkout URLs with coupon pre-applied and UTM params.
 */
function buildCheckoutUrls(couponCode) {
  const monthly = `${MONTHLY_BASE_URL}?prefilled_promo_code=${couponCode}&${UTM}`;
  const annual  = `${ANNUAL_BASE_URL}?prefilled_promo_code=${couponCode}&${UTM}`;
  return { monthly, annual };
}

async function run() {
  console.log('[winback] Running win-back email job');

  const candidates = await getWinbackCandidates();
  console.log(`[winback] ${candidates.length} candidate(s) eligible`);

  let sent = 0;
  let failed = 0;

  for (const user of candidates) {
    try {
      // Create per-user single-use coupon
      const { couponCode } = await createWinbackCoupon(user.id);
      const { monthly, annual } = buildCheckoutUrls(couponCode);

      const { subject, html, text } = buildWinbackEmail({
        monthlyUrl: monthly,
        annualUrl: annual,
        couponCode,
      });

      await sendEmail({ to: user.email, subject, html, text });

      // Stamp winback_sent_at — prevents re-send
      const stamped = await markWinbackSent(user.id);
      if (!stamped) {
        // Already sent by a concurrent run — skip logging
        console.log(`[winback] Concurrent dedup: winback already sent for ${user.email}`);
        continue;
      }

      // Log winback_sent for metrics
      await logExitIntentEvent({ event_type: 'winback_sent', email: user.email, device_id: null })
        .catch(() => {});

      console.log(`[winback] Sent to ${user.email} (id=${user.id}, coupon=${couponCode})`);
      sent++;
    } catch (err) {
      console.error(`[winback] Error for user ${user.id} (${user.email}):`, err.message);
      failed++;
    }
  }

  console.log(`[winback] Done — sent=${sent} failed=${failed}`);
}

// Run directly when invoked as a cron job
if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[winback] Fatal error:', err.message);
      process.exit(1);
    });
}

module.exports = { run };
