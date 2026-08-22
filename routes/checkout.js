/**
 * Checkout route — HoldOff Stripe Checkout + Billing Portal + magic link restore.
 * Owns: Stripe Checkout session creation, Billing Portal session, tier info,
 *   post-payment activation. Does NOT own: subscription DB writes from webhooks
 *   (routes/stripe-webhook.js), filter verdict enforcement (routes/filter.js).
 *
 * Auth-gated endpoints: POST /api/checkout/create-checkout, POST /api/checkout/portal.
 * Public endpoints: POST /session, POST /restore, GET /verify, POST /activate, GET /tiers.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../lib/auth');
const {
  createMagicToken,
  consumeMagicToken,
  upsertSubscription,
  getMembershipType,
  getSubscriptionByEmail,
} = require('../db/subscriptions');
const { updateMembershipType } = require('../db/users');
const { logExitIntentEvent } = require('../db/exit-intent');
const { PLANS, TIER_URLS } = require('../config/plans');
const { isCapabilityAvailable } = require('../config/dependency-policy');

const BASE_URL = process.env.APP_URL || 'https://shouldiholdoff.live';
const EMAIL_PROXY_URL = process.env.HOLDOFF_EMAIL_PROXY_URL;

// ─── POST /api/checkout/create-checkout ──────────────────────────────────────
// Creates a Stripe Checkout Session and returns the URL.
// Auth-gated — 401 + redirectTo '/login' if not authenticated.

router.post('/create-checkout', requireAuth, async (req, res) => {
  const { tier } = req.body || {};

  if (!tier || !TIER_URLS[tier]) {
    return res.status(400).json({
      error: 'Invalid tier. Must be one of: ' + Object.keys(TIER_URLS).join(', '),
      code: 'INVALID_TIER',
    });
  }

  // TIER_URLS holds Stripe Payment Link URLs, not price IDs.
  // Redirect the user to the payment link with their email pre-filled.
  const checkoutUrl = new URL(TIER_URLS[tier]);
  checkoutUrl.searchParams.set('prefilled_email', req.user.email);
  checkoutUrl.searchParams.set('client_reference_id', req.user.email);

  console.log(`[checkout] create-checkout tier=${tier} user=${req.user.email} url=${checkoutUrl.toString()}`);
  res.json({ url: checkoutUrl.toString() });
});

// ─── POST /api/checkout/portal ────────────────────────────────────────────────
// Creates a Stripe Billing Portal session for the current user.
// Auth-gated — 400 if no active subscription found.

router.post('/portal', requireAuth, async (req, res) => {
  if (!isCapabilityAvailable('payments.stripe')) {
    return res.status(503).json({ error: 'Billing portal is temporarily unavailable.', code: 'STRIPE_UNAVAILABLE' });
  }
  const sub = await getSubscriptionByEmail(req.user.email).catch(() => null);
  if (!sub?.stripe_customer_id) {
    return res.status(400).json({ error: 'No active subscription found.', code: 'NO_SUBSCRIPTION' });
  }

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${BASE_URL}/filter`,
  });

  res.json({ url: session.url });
});

// ─── GET /api/checkout/tiers ──────────────────────────────────────────────────
// Returns all tier definitions for client-side paywall rendering.

router.get('/tiers', (_req, res) => {
  res.json({ tiers: PLANS });
});

// ─── POST /api/checkout/session ───────────────────────────────────────────────
// Still used by client-side code that expects { url, tier }.

router.post('/session', async (req, res) => {
  if (!req.body?.tier) {
    return res.status(400).json({ error: 'tier is required' });
  }

  const rawEmail = (req.body.email || req.body.customer_email || '').toString().trim().toLowerCase();
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);
  if (!emailLooksValid) {
    return res.status(400).json({
      error: 'Enter your email before checkout so we can activate HoldOff after payment.',
      code: 'EMAIL_REQUIRED',
    });
  }

  const tier = req.body.tier;
  const selectedTier = TIER_URLS[tier] ? tier : 'online_monthly';
  const baseCheckoutUrl = TIER_URLS[selectedTier];
  if (!baseCheckoutUrl) {
    return res.status(500).json({ error: 'No checkout URL configured for tier: ' + selectedTier });
  }

  const checkoutUrl = new URL(baseCheckoutUrl);
  checkoutUrl.searchParams.set('prefilled_email', rawEmail);
  checkoutUrl.searchParams.set('client_reference_id', rawEmail);

  console.log(`[checkout] session for tier=${selectedTier} email=${rawEmail} url=${checkoutUrl.toString()}`);
  await logExitIntentEvent({ event_type: 'checkout_started', email: rawEmail, device_id: null })
    .catch(err => { console.error('[checkout] checkout_started log error:', err.message); });
  if (selectedTier.startsWith('app_')) {
    await logExitIntentEvent({ event_type: 'cashapp_checkout_started', email: rawEmail, device_id: null })
      .catch(err => { console.error('[checkout] cashapp_checkout_started log error:', err.message); });
  }
  res.json({ url: checkoutUrl.toString(), tier: selectedTier });
});

// ─── POST /api/checkout/start ──────────────────────────────────────────────────
// Email-optional checkout start — used by /pricing, /checkout pages that
// don't collect email upfront. Stripe's hosted page handles email collection;
// the webhook activates the account from the email the buyer enters there.

router.post('/start', async (req, res) => {
  const { tier } = req.body || {};
  const selectedTier = (tier && TIER_URLS[tier]) ? tier : 'online_monthly';
  const baseCheckoutUrl = TIER_URLS[selectedTier];
  if (!baseCheckoutUrl) {
    return res.status(500).json({ error: 'No checkout URL configured for tier: ' + selectedTier });
  }

  const checkoutUrl = new URL(baseCheckoutUrl);

  // Pre-fill email if available (from logged-in user or request body)
  const email = (req.body?.email || req.user?.email || '').toString().trim().toLowerCase();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    checkoutUrl.searchParams.set('prefilled_email', email);
    checkoutUrl.searchParams.set('client_reference_id', email);
  }

  console.log(`[checkout] start tier=${selectedTier} url=${checkoutUrl.toString()}`);
  res.json({ url: checkoutUrl.toString(), tier: selectedTier });
});

// ─── POST /api/checkout/restore ────────────────────────────────────────────────
// Sends a passwordless magic link to restore account access.

router.post('/restore', async (req, res) => {
  const { email } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Always return success — don't leak whether email is in the system
  const hasAccess = await getMembershipType(normalizedEmail).catch(() => null);

  if (hasAccess) {
    try {
      const token = await createMagicToken(normalizedEmail);
      const magicUrl = `${BASE_URL}/api/checkout/verify?token=${token}`;
      if (EMAIL_PROXY_URL) {
        await sendMagicLinkEmail(normalizedEmail, magicUrl);
      } else {
        console.log(`[checkout] Magic link for ${normalizedEmail}: ${magicUrl}`);
      }
    } catch (err) {
      console.error('[checkout] magic token error:', err.message);
    }
  }

  res.json({ ok: true, message: 'If that email has a subscription, a magic link is on its way.' });
});

// ─── GET /api/checkout/verify?token=<token> ────────────────────────────────────
// Validates magic link token, sets pro_token cookie, redirects to /filter.

router.get('/verify', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect('/filter?paywall=1&restore_error=1');

  try {
    const email = await consumeMagicToken(token);
    if (!email) return res.redirect('/filter?paywall=1&restore_error=1');

    const membershipType = await getMembershipType(email).catch(() => 'online');
    const tokenPayload = Buffer.from(JSON.stringify({ email, membership: membershipType || 'online', iat: Date.now() })).toString('base64url');

    res.cookie('pro_token', tokenPayload, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });

    res.redirect('/filter?pro_restored=1');
  } catch (err) {
    console.error('[checkout] verify error:', err.message);
    res.redirect('/filter?paywall=1&restore_error=1');
  }
});

// ─── POST /api/checkout/activate ────────────────────────────────────────────────
// Called client-side after successful Stripe payment to activate membership.

router.post('/activate', async (req, res) => {
  const { email, tier, sessionId } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required.' });
  }
  if (!tier) {
    return res.status(400).json({ error: 'tier is required.' });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const membershipType = tier.startsWith('app_') ? 'app' : tier === 'lifetime' ? 'lifetime' : 'online';

    // Map tier to period days for the pending subscription record
    const periodDays = tier === 'lifetime'
      ? 365 * 50 // effectively forever
      : tier.includes('annual')
        ? 365
        : tier.includes('weekly')
          ? 7
          : 31;

    await upsertSubscription({
      email: normalizedEmail,
      stripeCustomerId: sessionId || 'pending',
      stripeSubscriptionId: 'pending',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
      membershipType,
    });

    // Also update users table membership_type
    const { findUserByEmail } = require('../db/users');
    const user = await findUserByEmail(normalizedEmail).catch(() => null);
    if (user?.id) {
      await updateMembershipType(user.id, membershipType).catch(() => {});
    }

    const tokenPayload = Buffer.from(JSON.stringify({ email: normalizedEmail, membership: membershipType, iat: Date.now() })).toString('base64url');
    res.cookie('pro_token', tokenPayload, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });

    console.log(`[checkout] Membership activated: ${normalizedEmail} → ${membershipType}`);
    res.json({ ok: true, email: normalizedEmail, membership: membershipType });
  } catch (err) {
    console.error('[checkout] activate error:', err.message);
    res.status(500).json({ error: 'Could not activate membership. Try again.' });
  }
});

// ─── GET /api/checkout/verify-session?session_id= ────────────────────────────────
// Server-side session verification for /success page.
// Returns { verified: boolean, tier: string|null, amount: number|null, currency: string }

router.get('/verify-session', async (req, res) => {
  if (!isCapabilityAvailable('payments.stripe')) {
    return res.status(503).json({ error: 'Session verification is temporarily unavailable.', code: 'STRIPE_UNAVAILABLE' });
  }
  const { session_id } = req.query;
  if (!session_id) {
    return res.status(400).json({ error: 'session_id is required.', code: 'VALIDATION_ERROR' });
  }

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['customer']
    });
    const verified = session.payment_status === 'paid' || session.status === 'complete';
    const tier = session.metadata?.tier || null;
    const amount = session.amount_total ? session.amount_total / 100 : null;
    const currency = session.currency ? session.currency.toUpperCase() : null;
    const customer_name = session.customer_details?.name || session.customer?.name || null;
    const customer_email = session.customer_details?.email || session.customer_email || null;
    const promo_code = session.metadata?.promo_code || null;
    res.json({ verified, tier, amount, currency, customer_name, customer_email, promo_code });
  } catch (err) {
    console.error('[checkout] verify-session error:', err.message);
    res.status(500).json({ error: 'Could not verify session.' });
  }
});

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function sendMagicLinkEmail(email, magicUrl) {
  const resp = await fetch(EMAIL_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: email,
      subject: 'Your HoldOff access link',
      html: `<p>Here's your link to restore HoldOff access. It expires in 1 hour.</p>
             <p><a href="${magicUrl}">Restore my access →</a></p>
             <p style="color:#999;font-size:12px;">If you didn't request this, ignore it.</p>`,
      text: `Restore HoldOff access:\n${magicUrl}\n\nExpires in 1 hour. If you didn't request this, ignore it.`,
    }),
  });
  if (!resp.ok) throw new Error(`Email proxy returned ${resp.status}`);
}

module.exports = router;
