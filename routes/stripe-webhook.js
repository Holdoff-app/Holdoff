/**
 * Stripe webhook handler.
 * Owns: subscription lifecycle events (checkout.session.created, checkout.session.completed,
 *   checkout.session.expired, customer.subscription.deleted, invoice.payment_failed, invoice.paid).
 *   Fires Meta Pixel Purchase on confirmed payment. Records abandoned sessions for recovery.
 *   Creates dunning_attempts rows on payment failure for involuntary churn recovery.
 * Does NOT own: Stripe Checkout session creation (routes/checkout.js),
 *   entitlement enforcement (routes/filter.js), recovery email sending (jobs/abandoned-checkout.js),
 *   dunning email sending (jobs/dunning-email.js).
 */
const express = require('express');
const router = express.Router();
const {
  upsertSubscription,
  setGracePeriod,
  clearGracePeriod,
  revokeSubscription,
} = require('../db/subscriptions');
const { updateMembershipType, findUserByEmail } = require('../db/users');
const { getAffiliateByCode } = require('../db/affiliates');
const {
  createAbandonedCheckout,
  markAbandonedCheckoutConverted,
} = require('../db/abandoned-checkouts');
const { logExitIntentEvent } = require('../db/exit-intent');
const {
  createDunningAttempt,
  getActiveDunningAttempt,
  markDunningRecovered,
  markDunningLost,
} = require('../db/dunning');

// Raw body is captured by express.json({ verify }) in server.js and stored as req.rawBody.
// WHY not here: a router.use() in this module runs for ALL routes (mounted without path
// prefix in routes/index.js). The old approach called req.on('end', next) after
// express.json() had already consumed the stream — 'end' never re-fired, blocking
// every route that passed through routes/index.js.

router.post(['/', '/stripe-webhook'], async (req, res) => {
  const sig = req.get('Stripe-Signature') || '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (!webhookSecret) throw new Error('Missing STRIPE_WEBHOOK_SECRET');
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err.message);
    return res.status(400).json({ error: 'webhook signature verification failed' });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    // Log but return 200 so Stripe doesn't retry indefinitely on transient DB errors
    console.error(`[stripe-webhook] handler error for ${event.type}:`, err.message);
  }

  res.json({ received: true });
});

// Tier payment links — mirrors routes/checkout.js TIER_URLS for recovery email CTA.
const TIER_PAYMENT_LINKS = {
  online_weekly:  'https://buy.stripe.com/6oU5kEeZ35TP2rSbqn2sM0c',
  app_weekly:     'https://buy.stripe.com/bJe3cw7wB3LH2rS2TR2sM0d',
  online_monthly: 'https://buy.stripe.com/28EbJ23gl2HDgiIeCz2sM07',
  app_monthly:    'https://buy.stripe.com/5kQcN6cQVfupd6weCz2sM08',
  online_annual:  'https://buy.stripe.com/6oUeVeaIN5TPaYo0LJ2sM09',
  app_annual:     'https://buy.stripe.com/6oU9AU5otfup0jK2TR2sM0a',
  lifetime:       'https://buy.stripe.com/4gMfZi6sx4PLc2s9if2sM0b',
};

function extractTierFromSession(obj) {
  return obj.metadata?.tier || obj.subscription_details?.metadata?.tier || null;
}

async function handleEvent(event) {
  const obj = event.data.object;

  switch (event.type) {
    case 'checkout.session.created': {
      // Record session so we can detect abandonment after 60 min.
      const email = obj.customer_details?.email || obj.customer_email || null;
      const tier = extractTierFromSession(obj);
      const paymentLink = tier ? TIER_PAYMENT_LINKS[tier] || null : null;
      await createAbandonedCheckout({
        sessionId: obj.id,
        email,
        tier,
        amount: obj.amount_total || null,
        currency: obj.currency || 'usd',
        paymentLink,
      }).catch(err => console.error('[stripe-webhook] createAbandonedCheckout error:', err.message));
      break;
    }

    case 'checkout.session.expired': {
      // Session expired without completing — trigger the job immediately for this session.
      // The cron sweep will also catch it, but this gives near-real-time recovery.
      const email = obj.customer_details?.email || obj.customer_email || null;
      if (email) {
        const { run } = require('../jobs/abandoned-checkout');
        run().catch(err => console.error('[stripe-webhook] abandoned-checkout job error:', err.message));
      }
      const expiredPaymentMethods = obj.payment_method_types || [];
      if (expiredPaymentMethods.includes('cashapp')) {
        const expiredEmail = obj.customer_details?.email || obj.customer_email || null;
        await logExitIntentEvent({ event_type: 'cashapp_checkout_failed', email: expiredEmail, device_id: null })
          .catch(err => console.error('[stripe-webhook] cashapp_checkout_failed log error:', err.message));
      }
      break;
    }

    case 'checkout.session.completed': {
      const email = obj.customer_details?.email || obj.customer_email;
      if (!email) {
        console.warn('[stripe-webhook] checkout.session.completed: no email on session', obj.id);
        break;
      }

      // Determine membership_type from session metadata or price
      const metadataTier = obj.metadata?.tier || obj.subscription_details?.metadata?.tier;
      let membershipType = 'online';
      if (metadataTier) {
        membershipType = metadataTier.startsWith('app_') ? 'app' :
                         metadataTier === 'lifetime' ? 'lifetime' : 'online';
      }

      if (obj.mode === 'subscription') {
        await upsertSubscription({
          email,
          stripeCustomerId: obj.customer,
          stripeSubscriptionId: obj.subscription,
          status: 'active',
          currentPeriodEnd: null,
          membershipType,
        });
      } else {
        // Lifetime one-time payment
        await upsertSubscription({
          email,
          stripeCustomerId: obj.customer,
          stripeSubscriptionId: 'lifetime',
          status: 'active',
          currentPeriodEnd: null,
          membershipType: 'lifetime',
        });
      }

      // Also update users table
      const user = await findUserByEmail(email).catch(() => null);
      if (user?.id) {
        await updateMembershipType(user.id, membershipType).catch(() => {});
      }

      // Mark abandoned checkout row as converted so recovery email is suppressed.
      await markAbandonedCheckoutConverted(obj.id).catch(() => {});

      const amount = (obj.amount_total || 0) / 100;
      const currency = (obj.currency || 'usd').toUpperCase();
      console.log(`[stripe-webhook] Membership activated — email: ${email}, tier: ${membershipType}, amount: ${amount} ${currency}`);
      console.log(`[meta] Purchase fired — amount: ${amount} ${currency}, email: ${email}`);

      // CashApp Pay completion tracking
      const paymentMethods = obj.payment_method_types || [];
      if (paymentMethods.includes('cashapp')) {
        await logExitIntentEvent({ event_type: 'cashapp_checkout_completed', email, device_id: null })
          .catch(err => console.error('[stripe-webhook] cashapp_checkout_completed log error:', err.message));
        console.log(`[stripe-webhook] CashApp checkout completed for ${email}`);
      }

      // Win-back conversion: log if session was completed with a winback_d7 coupon.
      // Coupon metadata.campaign = 'winback_d7' is set by jobs/winback-email.js.
      const discounts = obj.total_details?.breakdown?.discounts || [];
      const winbackDiscount = discounts.find(
        d => d?.discount?.coupon?.metadata?.campaign === 'winback_d7'
      );
      if (winbackDiscount) {
        logExitIntentEvent({ event_type: 'winback_converted', email, device_id: null })
          .catch(err => console.error('[stripe-webhook] winback_converted log error:', err.message));
        console.log(`[stripe-webhook] winback_converted logged for ${email}`);
      }

      // Affiliate attribution — credit the affiliate whose cookie was present at checkout.
      // The aff_code is stored in session metadata when available. We log it here for
      // manual reconciliation until Stripe Connect automation is wired up.
      const affCodeOnSession = obj.metadata?.aff;
      if (affCodeOnSession) {
        try {
          const affiliate = await getAffiliateByCode(affCodeOnSession);
          if (affiliate) {
            console.log(JSON.stringify({
              event: 'affiliate_conversion',
              aff_code: affCodeOnSession,
              affiliate_email: affiliate.email,
              customer_email: email,
              amount,
              currency,
              session_id: obj.id,
            }));
          }
        } catch (affErr) {
          console.error('[stripe-webhook] affiliate attribution lookup failed:', affErr.message);
        }
      }
      break;
    }

    case 'invoice.paid':
    case 'invoice.payment_succeeded': {
      // Renewal: keep current_period_end fresh so entitlement stays valid.
      // Clear grace_until since payment succeeded.
      const subId = obj.subscription;
      if (!subId) break;

      const email = obj.customer_email;
      if (!email) break;

      let periodEnd = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
      if (process.env.STRIPE_SECRET_KEY) {
        try {
          const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
          const sub = await stripe.subscriptions.retrieve(subId);
          periodEnd = new Date(sub.current_period_end * 1000);
        } catch (err) {
          console.warn(`[stripe-webhook] Could not retrieve subscription ${subId}: ${err.message}`);
        }
      }

      await upsertSubscription({
        email,
        stripeCustomerId: obj.customer,
        stripeSubscriptionId: subId,
        status: 'active',
        currentPeriodEnd: periodEnd,
      });

      // Clear grace period and resolve any active dunning attempt.
      await clearGracePeriod(subId).catch(err =>
        console.error('[stripe-webhook] clearGracePeriod error:', err.message));
      await markDunningRecovered(subId).catch(err =>
        console.error('[stripe-webhook] markDunningRecovered error:', err.message));
      break;
    }

    case 'customer.subscription.updated': {
      // Sync subscription status (active / past_due / cancelled).
      const subId = obj.id;
      if (!subId) break;

      const email = obj.customer_email || obj.metadata?.email || null;
      const rawStatus = obj.status;
      let status = 'active';
      if (rawStatus === 'past_due') status = 'past_due';
      else if (rawStatus === 'canceled' || rawStatus === 'unpaid') status = 'cancelled';

      const membershipType = obj.metadata?.membership_type ||
        obj.items?.data?.[0]?.price?.metadata?.membership_type || 'online';

      let periodEnd = null;
      if (obj.current_period_end) {
        periodEnd = new Date(obj.current_period_end * 1000);
      }

      await upsertSubscription({
        email: email || undefined,
        stripeCustomerId: obj.customer,
        stripeSubscriptionId: subId,
        status,
        currentPeriodEnd: periodEnd,
        membershipType,
      }).catch(err =>
        console.error('[stripe-webhook] subscription.updated upsert error:', err.message));
      break;
    }

    case 'invoice.payment_failed': {
      const subId = obj.subscription;
      if (!subId) break;
      // 3-day grace period before access revoked (see db/subscriptions.js)
      await setGracePeriod(subId);
      console.log(`[stripe-webhook] Payment failed — grace set for ${subId}`);

      // Skip Lifetime tier — no renewal billing to recover.
      const failedEmail = obj.customer_email;
      const customerId = obj.customer;
      const membershipType = obj.subscription_details?.metadata?.membership_type || null;
      if (membershipType === 'lifetime') {
        console.log(`[stripe-webhook] Lifetime tier — skipping dunning for ${subId}`);
        break;
      }

      // Only create a dunning attempt if there's no active one for this sub.
      // WHY: Stripe can fire multiple payment_failed events per window on retry.
      const existing = await getActiveDunningAttempt(subId).catch(() => null);
      if (!existing) {
        await createDunningAttempt({
          subscriptionId: subId,
          customerId: customerId || null,
          email: failedEmail || null,
        }).catch(err => console.error('[stripe-webhook] createDunningAttempt error:', err.message));
        console.log(`[stripe-webhook] Dunning attempt created for sub ${subId}`);
      } else {
        console.log(`[stripe-webhook] Dunning attempt already active for sub ${subId} (id=${existing.id}) — skipping duplicate`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      await revokeSubscription(obj.id);
      console.log(`[stripe-webhook] Subscription cancelled — revoked ${obj.id}`);
      // Mark any active dunning attempt as lost.
      await markDunningLost(obj.id).catch(err =>
        console.error('[stripe-webhook] markDunningLost error:', err.message));
      break;
    }

    default:
      break;
  }
}

module.exports = router;
