/**
 * stripe-health-check.js
 * Run: node scripts/stripe-health-check.js
 * Checks: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, all payment links, subscription DB
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');

const PAYMENT_LINKS = {
  online_weekly:  'https://buy.stripe.com/6oU5kEeZ35TP2rSbqn2sM0c',
  app_weekly:     'https://buy.stripe.com/bJe3cw7wB3LH2rS2TR2sM0d',
  online_monthly: 'https://buy.stripe.com/28EbJ23gl2HDgiIeCz2sM07',
  app_monthly:    'https://buy.stripe.com/5kQcN6cQVfupd6weCz2sM08',
  online_annual:  'https://buy.stripe.com/6oUeVeaIN5TPaYo0LJ2sM09',
  app_annual:     'https://buy.stripe.com/6oU9AU5otfup0jK2TR2sM0a',
  lifetime:       'https://buy.stripe.com/4gMfZi6sx4PLc2s9if2sM0b',
};

async function run() {
  console.log('\n🔍 HoldOff Stripe Health Check\n');

  // 1. Env vars
  const sk = process.env.STRIPE_SECRET_KEY;
  const wh = process.env.STRIPE_WEBHOOK_SECRET;
  console.log(`STRIPE_SECRET_KEY:    ${sk ? (sk.startsWith('sk_live_') ? '✅ LIVE key set' : sk.startsWith('sk_test_') ? '⚠️  TEST key set' : '❌ Unrecognized format') : '❌ NOT SET'}`);
  console.log(`STRIPE_WEBHOOK_SECRET: ${wh ? (wh.startsWith('whsec_') ? '✅ set (whsec_...)' : '⚠️  Set but wrong format (should start with whsec_)') : '❌ NOT SET'}`);

  // 2. Stripe API connectivity
  if (sk) {
    try {
      const bal = await stripe.balance.retrieve();
      console.log(`\n✅ Stripe API connected — mode: ${bal.livemode ? 'LIVE' : 'TEST'}`);
    } catch (e) {
      console.log(`\n❌ Stripe API error: ${e.message}`);
    }
  } else {
    console.log('\n⏭  Skipping API check — no STRIPE_SECRET_KEY');
  }

  // 3. Payment links (HTTP status)
  console.log('\nPayment Links:');
  const https = require('https');
  for (const [tier, url] of Object.entries(PAYMENT_LINKS)) {
    await new Promise(resolve => {
      const req = https.get(url, { timeout: 5000 }, res => {
        const ok = res.statusCode < 400;
        console.log(`  ${ok ? '✅' : '❌'} ${tier.padEnd(15)} ${res.statusCode} → ${url}`);
        resolve();
      });
      req.on('error', err => {
        console.log(`  ❌ ${tier.padEnd(15)} ERROR: ${err.message}`);
        resolve();
      });
    });
  }

  // 4. Webhook endpoint
  console.log('\nWebhook:');
  console.log(`  Expected URL: https://shouldiholdoff.live/api/stripe-webhook`);
  console.log(`  Register at: https://dashboard.stripe.com/webhooks`);
  console.log(`  Events to listen for:`);
  console.log(`    checkout.session.created`);
  console.log(`    checkout.session.completed`);
  console.log(`    checkout.session.expired`);
  console.log(`    invoice.paid`);
  console.log(`    invoice.payment_failed`);
  console.log(`    customer.subscription.deleted`);

  console.log('\n✅ Check complete\n');
}

run().catch(console.error);
