/**
 * Canonical HoldOff pricing plan definitions.
 */
const TIER_URLS = {
  founding_member: 'https://buy.stripe.com/7sYfZa3Aeaau80a8bx0Jq02',
  online_weekly:   'https://buy.stripe.com/6oU5kEeZ35TP2rSbqn2sM0c',
  app_weekly:      'https://buy.stripe.com/bJe3cw7wB3LH2rS2TR2sM0d',
  online_monthly:  'https://buy.stripe.com/28EbJ23gl2HDgiIeCz2sM07',
  app_monthly:     'https://buy.stripe.com/5kQcN6cQVfupd6weCz2sM08',
  online_annual:   'https://buy.stripe.com/6oUeVeaIN5TPaYo0LJ2sM09',
  app_annual:      'https://buy.stripe.com/6oU9AU5otfup0jK2TR2sM0a',
  lifetime:        'https://buy.stripe.com/4gMfZi6sx4PLc2s9if2sM0b',
};

const PLANS = [
  {
    id: 'founding_member',
    label: 'Founding Member Beta',
    interval: 'monthly',
    price: 3.00,
    priceDisplay: '$3/mo',
    membershipType: 'online',
    highlight: true,
    badge: 'LIMITED — 50 spots',
    description: 'Lock in founding member pricing forever. First 50 only.',
  },
  {
    id: 'online_monthly',
    label: 'HoldOff Online',
    interval: 'monthly',
    price: 9.99,
    priceDisplay: '$9.99/mo',
    membershipType: 'online',
    highlight: false,
  },
  {
    id: 'app_monthly',
    label: 'HoldOff App',
    interval: 'monthly',
    price: 14.99,
    priceDisplay: '$14.99/mo',
    membershipType: 'app',
    highlight: false,
  },
  {
    id: 'lifetime',
    label: 'HoldOff Lifetime',
    interval: 'once',
    price: 299,
    priceDisplay: '$299 once',
    membershipType: 'lifetime',
    highlight: false,
  },
];

module.exports = { PLANS, TIER_URLS };
