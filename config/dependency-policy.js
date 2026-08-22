function has(value) {
  return !!String(value || '').trim();
}

function getDependencyStatus() {
  const status = {
    ai: {
      anthropic: has(process.env.ANTHROPIC_API_KEY),
      openai: has(process.env.OPENAI_API_KEY),
    },
    payments: {
      stripe: has(process.env.STRIPE_SECRET_KEY) && has(process.env.STRIPE_WEBHOOK_SECRET),
    },
    email: {
      postmark: has(process.env.POSTMARK_API_KEY),
      proxy: has(process.env.HOLDOFF_EMAIL_PROXY_URL) || has(process.env.HOLDOFF_API_BASE_URL),
    },
    auth: {
      google: has(process.env.GOOGLE_CLIENT_ID),
      jwt: has(process.env.JWT_SECRET),
    },
    database: {
      postgres: has(process.env.DATABASE_URL),
    },
    notifications: {
      push: has(process.env.VAPID_PUBLIC_KEY) && has(process.env.VAPID_PRIVATE_KEY),
    },
    observability: {
      sentry: has(process.env.SENTRY_DSN),
    },
    storage: {
      s3: has(process.env.AWS_ACCESS_KEY_ID) && has(process.env.AWS_SECRET_ACCESS_KEY) && has(process.env.AWS_REGION) && has(process.env.S3_BUCKET),
    },
  };

  const fullMode = status.database.postgres &&
    (status.ai.anthropic || status.ai.openai) &&
    status.payments.stripe &&
    (status.email.postmark || status.email.proxy) &&
    status.auth.jwt;

  return {
    mode: fullMode ? 'full' : 'degraded',
    status,
  };
}

function isCapabilityAvailable(check) {
  const { status } = getDependencyStatus();
  const parts = String(check || '').split('.');
  if (parts.length !== 2) return false;
  return !!(status[parts[0]] && status[parts[0]][parts[1]]);
}

module.exports = {
  getDependencyStatus,
  isCapabilityAvailable,
};
