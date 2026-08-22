/**
 * HoldOff application entry point.
 * Handles landing page, filter page, and API routes.
 */
const express = require('express');
// Express 4 does not forward rejected promises from async handlers to error
// middleware, so any rejection there terminates the process. Must be required
// before the routers are built.
require('express-async-errors');
const path = require('path');
const cookieParser = require('cookie-parser');
const { buildLandingContext } = require(path.join(__dirname, 'lib', 'landing-context'));
const rateLimit = require('express-rate-limit');
const { getDependencyStatus, isCapabilityAvailable } = require(path.join(__dirname, 'config', 'dependency-policy'));

// Sentry error tracking — initialized before any other middleware so all downstream errors are captured.
const Sentry = require('@sentry/node');
if (isCapabilityAvailable('observability.sentry')) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    sampleRate: 0.1,
    tracesSampler: (ctx) => {
      if (ctx.tag?.request?.status === 200) return 0.1;
      return 1.0;
    },
  });
} else {
  console.warn('[startup] Sentry DSN missing — running without external observability');
}
const { verifyToken, getCookieTokens } = require(path.join(__dirname, 'lib', 'auth'));
const authRouter = require(path.join(__dirname, 'routes', 'auth'));
const { mountSharePages } = require(path.join(__dirname, 'routes', 'share'));
const { ensureCommunityTables } = require(path.join(__dirname, 'db', 'community'));
const googleAuthHandler = require(path.join(__dirname, 'routes', 'google-auth'));
const checkoutRouter = require(path.join(__dirname, 'routes', 'checkout'));
const messagingRouter = require(path.join(__dirname, 'routes', 'messaging'));
const contactsRouter = require(path.join(__dirname, 'routes', 'contacts'));

const app = express();
const port = process.env.PORT || 3000;

app.use(cookieParser());
// Inject Google Client ID into all views
app.use((_req, res, next) => {
  res.locals.googleClientId = process.env.GOOGLE_CLIENT_ID || '251734222269-l5fn6rbfcmtmm161q3g7e7k840lavf3f.apps.googleusercontent.com';
  next();
});

// Capture raw body for Stripe webhook signature verification.
app.use(express.json({
  verify: (req, _res, buf) => {
    if (req.originalUrl === '/api/stripe-webhook') {
      req.rawBody = buf.toString('utf8');
    }
  },
}));
app.use(express.urlencoded({ extended: true }));

// Middleware safety net for /api/filter/analyze
app.use('/api/filter', (req, res, next) => {
  const t0 = Date.now();
  console.log(`[mw] ${req.method} ${req.path} started`);

  if (req.method === 'POST' && req.path === '/analyze') {
    const safetyTimer = setTimeout(() => {
      if (!res.headersSent) {
        console.log(`[mw] SAFETY TIMEOUT at ${Date.now() - t0}ms — returning static HOLD`);
        res.status(200).json({
          verdict: 'HOLD',
          pattern: 'late-night spiral',
          whats_happening: "Something's off tonight — maybe the timing, maybe the headspace. Either way, this message can wait.",
          grounded_voice: "You know yourself. Send this tomorrow when you can actually see it clearly. Tonight is not the moment.",
          rewrite: 'send nothing tonight',
          verdict_source: 'fallback',
        });
      }
    }, 16000);

    res.on('finish', () => {
      clearTimeout(safetyTimer);
      console.log(`[mw] POST /analyze finished ${res.statusCode} ${Date.now() - t0}ms`);
    });
    res.on('close', () => {
      clearTimeout(safetyTimer);
      if (!res.writableFinished) console.log(`[mw] POST /analyze CLIENT DISCONNECTED ${Date.now() - t0}ms`);
    });
  }

  next();
});

// Mount API routes
app.use('/api/auth', rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' },
}));
app.use('/api/verdict', rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' },
  skip: (req) => req.method === 'GET',
}));
// Secondary per-user rate limit (60/hour) — prevents authenticated VPN bypass
const { requireAuth: _requireAuthForRateLimit } = require('./lib/auth');
const perUserVerdictLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID from JWT if present, fall back to IP
    try {
      const jwt = require('jsonwebtoken');
      const token = req.cookies?.holdoff_token;
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'holdoff_jwt_secret_dev_only');
        if (decoded?.id) return `user:${decoded.id}`;
      }
    } catch (_) { /* fall through to IP */ }
    return `ip:${req.ip}`;
  },
  message: { error: 'Hourly limit reached. Try again later.', code: 'RATE_LIMITED' },
  skip: (req) => req.method === 'GET',
});
app.use('/api/verdict', perUserVerdictLimit);
app.use('/api/filter/interpret', perUserVerdictLimit);

// Additional API endpoints
app.get('/api/health', (_req, res) => {
  const deps = getDependencyStatus();
  res.json({ status: 'ok', mode: deps.mode, dependencies: deps.status });
});

// Mount SEO routes at root
app.use('/', require(path.join(__dirname, 'routes', 'seo')));

// Main API router
app.use('/api/auth', authRouter);
app.post('/api/auth/google', googleAuthHandler);
app.use('/api/filter', require(path.join(__dirname, 'routes', 'filter')));
// Google auth handler — POST /api/google-auth (standalone, complements /api/auth/google in authRouter)
app.post('/api/google-auth', rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' },
}), googleAuthHandler);
app.use('/api/spiral-lock', require(path.join(__dirname, 'routes', 'spiral-lock')));
app.use('/api/stripe-webhook', require(path.join(__dirname, 'routes', 'stripe-webhook')));
app.use('/api/checkout', checkoutRouter);
app.use('/api/waitlist', require(path.join(__dirname, 'routes', 'waitlist')));
app.use('/api/referral', require(path.join(__dirname, 'routes', 'referral')));
app.use('/api/journal', require(path.join(__dirname, 'routes', 'journal')));
app.use('/api/push', require(path.join(__dirname, 'routes', 'push')));
app.use('/api/users', require(path.join(__dirname, 'routes', 'users')));
app.use('/api/community', require(path.join(__dirname, 'routes', 'community')));
app.use('/api/detox', require(path.join(__dirname, 'routes', 'detox')));
app.use('/api/quiz', require(path.join(__dirname, 'routes', 'quiz')));
app.use('/api/admin', require(path.join(__dirname, 'routes', 'admin')));
app.use('/api/affiliates', require(path.join(__dirname, 'routes', 'affiliates')));
app.use('/api/chronicle', require(path.join(__dirname, 'routes', 'chronicle')));
app.use('/api/outreach', require(path.join(__dirname, 'routes', 'outreach')));
app.use('/api/blast', require(path.join(__dirname, 'routes', 'blast')));
app.post('/api/interpret', require(path.join(__dirname, 'routes', 'interpret')));
app.use('/api/meta', require(path.join(__dirname, 'routes', 'meta')));
app.use('/api/contact', require(path.join(__dirname, 'routes', 'contact')));
app.use('/api/abandoned-checkout', require(path.join(__dirname, 'routes', 'abandoned-checkout')));
app.use('/api/share', require(path.join(__dirname, 'routes', 'share')));
app.use('/api/contacts', require(path.join(__dirname, 'routes', 'contacts')));
app.use('/api/contact-insights', rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' },
}));
app.use('/api/contact-insights', require(path.join(__dirname, 'routes', 'contact-insights')));
app.use('/api/questionnaire', require(path.join(__dirname, 'routes', 'questionnaire')));
app.use('/api/quiz-invites', require(path.join(__dirname, 'routes', 'quiz-invites')));
app.use('/api/messaging', require(path.join(__dirname, 'routes', 'messaging')));
app.use('/api/verdict', require(path.join(__dirname, 'routes', 'verdict')));
app.use('/api/interpreter', require(path.join(__dirname, 'routes', 'interpreter')));
app.use('/api/companion', require(path.join(__dirname, 'routes', 'companion')));
// Android APK download redirect
app.use('/api/download', require(path.join(__dirname, 'routes', 'download')));
// Explicit health-check alias
app.use('/api/health-check', require(path.join(__dirname, 'routes', 'health')));

// EJS view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Redirect aliases
app.get('/waitlist', (_req, res) => res.redirect(301, '/filter'));
app.get('/contact', (_req, res) => res.redirect(301, '/#contact'));
app.get('/interpret', (_req, res) => res.redirect(301, '/filter'));
app.get('/verdict', (_req, res) => res.redirect(301, '/filter'));
app.get('/referral', (_req, res) => res.redirect(301, '/referrals'));
app.get('/share', (_req, res) => res.redirect(301, '/filter'));

// Health check
app.get('/robots.txt', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('User-agent: *\nAllow: /\n\nSitemap: https://shouldiholdoff.live/sitemap.xml');
});
app.get('/health', (_req, res) => res.json({ status: 'healthy' }));
const healthzLimit = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
app.get('/healthz', healthzLimit, async (_req, res) => {
  const result = { ok: true, db: false, ai: false, ts: new Date().toISOString() };
  try {
    const { pool } = require('./db/index');
    await pool.query('SELECT 1');
    result.db = true;
  } catch (_) { result.ok = false; }
  result.ai = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENAI_DIRECT_API_KEY);
  if (!result.ai) result.ok = false;
  res.status(result.ok ? 200 : 503).json(result);
});
app.get('/favicon.ico', (_req, res) => res.redirect(302, '/icon.svg'));
app.get('/notifications', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('notifications', { user: user || null });
});
app.get('/onboarding', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('onboarding', { user: user || null });
});

// Digital Asset Links — verifies the Android app (TWA) owns this domain.
// Served explicitly because express.static ignores dot-folders like /.well-known.
app.get('/.well-known/assetlinks.json', (_req, res) => {
  res.type('application/json').send(JSON.stringify([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.holdoff.app',
        sha256_cert_fingerprints: [
          'EA:E1:01:A1:B2:08:14:1C:9E:63:E9:CA:8C:E4:00:8C:74:36:ED:07:76:F9:C2:A2:25:19:EB:90:29:2D:AB:3E',
        ],
      },
    },
  ], null, 2));
});

// Static files
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Serve APK directly
app.get('/android-app.apk', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'holdoff.apk'), {
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="holdoff.apk"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
});

/** Extract logged-in user from JWT cookies, or null. */
async function getUserFromCookies(req) {
  const tokens = getCookieTokens(req);
  const payload = tokens.accessPayload || tokens.refreshPayload;
  if (!payload?.id) return null;

  // Enrich with membership_type for paywall decisions
  const { findUserById } = require(path.join(__dirname, 'db', 'users'));
  const fullUser = await findUserById(payload.id).catch(() => null);
  return {
    id: payload.id,
    email: payload.email,
    membership_type: fullUser?.membership_type || null,
    subscription_status: fullUser?.subscription_status || null,
  };
}

// Landing page
app.get('/', async (req, res) => {
  const user = await getUserFromCookies(req);
  const affCode = req.query.aff;
  const refCode = req.query.ref;
  if (refCode && /^[a-z0-9]{8,32}$/.test(refCode)) {
    res.cookie('ref', refCode, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
  if (affCode && /^[a-z0-9-]{4,32}$/.test(affCode)) {
    res.cookie('aff', affCode, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });
  }
  res.render('index', { user, variant: (process.env.LANDING_VARIANT || 'A').toUpperCase() });
});

// Inbox
app.get('/inbox', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/inbox');
  res.render('inbox', { user });
});

// Contacts
app.get('/contacts', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/contacts');
  res.render('contacts', { user });
});

app.get('/chronicle', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/chronicle');
  res.render('chronicle', { user });
});

app.get('/community', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/community');
  res.render('community', { user });
});

app.get('/quiz', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('quiz', { user: user || null });
});

app.get('/quiz-invites', (_req, res) => res.redirect('/quiz'));

app.get('/journal', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/journal');
  res.render('journal', { user });
});

app.get('/detox', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('detox', { user: user || null });
});

app.get('/referrals', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/referrals');
  res.render('referrals', { user });
});

app.get('/history', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/history');
  res.render('history', { user });
});

app.get('/spirals', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('spirals', { user: user || null });
});

app.get('/insights', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/insights');
  res.render('insights', { user });
});

app.get('/examples', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('examples', { user: user || null });
});

app.get('/prologue', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('prologue', { user: user || null });
});

app.get('/upgrade', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/upgrade');
  res.render('upgrade', { user });
});

app.get('/account', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/account');
  res.render('account', { user });
});

app.get('/affiliates', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('affiliates', { user: user || null });
});

app.get('/cancel', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('cancel', { user: user || null });
});

app.get('/success', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('success', { user: user || null });
});

app.get('/checkout', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('checkout', { user: user || null });
});

app.get('/thread/:id', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect(`/login?returnTo=${encodeURIComponent(req.originalUrl)}`);
  res.render('thread', { user, threadId: req.params.id });
});

app.get('/compose', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/compose');
  res.render('compose', { user });
});

app.get('/compare/:page', async (req, res, next) => {
  const user = await getUserFromCookies(req);
  const page = (req.params.page || '').toLowerCase();
  const allowedPages = new Set(['index', 'character-ai', 'chatgpt', 'replika']);
  if (!allowedPages.has(page)) return next();
  res.render(`compare/${page}`, { user: user || null });
});

app.get('/compare', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('compare/index', { user: user || null });
});

app.get('/account/:page', async (req, res, next) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect(`/login?returnTo=${encodeURIComponent(req.originalUrl)}`);
  const page = (req.params.page || '').toLowerCase();
  const allowedPages = new Set(['attachment-research', 'personality', 'portrait', 'trusted-contacts']);
  if (!allowedPages.has(page)) return next();
  res.render(`account/${page}`, { user });
});

app.use('/download', require(path.join(__dirname, 'routes', 'download')));

// Filter page
app.get('/filter', async (req, res) => {
  const user = await getUserFromCookies(req);
  const refCode = req.query.ref;
  if (refCode && /^[a-z0-9]{8,32}$/.test(refCode)) {
    res.cookie('ref', refCode, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
  res.render('filter', buildLandingContext({ user }));
});

// Pricing page
app.get('/pricing', async (req, res) => {
  const tokens = getCookieTokens(req);
  const user = tokens.accessPayload || tokens.refreshPayload || null;
  res.render('pricing', { user });
});

// Settings page
app.get('/settings', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) {
    return res.redirect('/login?returnTo=/settings');
  }
  res.render('settings', { user });
});

// Profile page
app.get('/profile', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/profile');
  const { findUserById } = require(path.join(__dirname, 'db', 'users'));
  const fullUser = await findUserById(user.id).catch(() => null);
  res.render('profile', { user, fullUser });
});

// Redeem page
app.get('/redeem', async (req, res) => {
  const user = await getUserFromCookies(req);
  const code = (req.query.code || '').toString().replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
  res.render('redeem', { user: user || null, code });
});

// Redeem endpoint
app.post('/api/redeem', async (req, res) => {
  try {
    const user = await getUserFromCookies(req);
    if (!user?.id) {
      return res.status(401).json({ ok: false, error: 'Please sign in or create your account first, then redeem.' });
    }
    const raw = (req.body?.code || '').toString().trim().toUpperCase();
    const FREE_ACCESS_CODES = {
      DNA: { membership: 'lifetime', label: 'Founder Free Access' },
    };
    const entry = FREE_ACCESS_CODES[raw];
    if (!entry) {
      return res.status(400).json({ ok: false, error: "That code isn't valid. Double-check it and try again." });
    }
    const { updateMembershipType } = require(path.join(__dirname, 'db', 'users'));
    await updateMembershipType(user.id, entry.membership);
    try {
      const { upsertSubscription } = require(path.join(__dirname, 'db', 'subscriptions'));
      await upsertSubscription({
        email: (user.email || '').toLowerCase().trim(),
        stripeCustomerId: 'promo:' + raw,
        stripeSubscriptionId: 'promo:' + raw,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 365 * 50 * 24 * 60 * 60 * 1000),
        membershipType: entry.membership,
      });
    } catch (subErr) {
      console.warn('[redeem] subscription mirror skipped:', subErr.message);
    }
    console.log(`[redeem] ${user.email} redeemed ${raw} → ${entry.membership}`);
    return res.json({ ok: true, membership: entry.membership });
  } catch (err) {
    console.error('[redeem] error:', err.message);
    return res.status(500).json({ ok: false, error: 'Something went wrong. Try again in a moment.' });
  }
});

// Affiliate
app.get('/affiliate', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('affiliate', { user: user || null });
});

// Partnerships
app.get('/partnerships', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('partnerships', { user: user || null });
});

// Partnership application endpoint
app.post('/api/partnership-apply', async (req, res) => {
  try {
    const { name, email, phone, organization, type, details, website } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ ok: false, error: 'Name is required.' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ ok: false, error: 'Valid email is required.' });
    }
    if (!organization || !organization.trim()) {
      return res.status(400).json({ ok: false, error: 'Organization is required.' });
    }

    const HOLDOFF_API_BASE_URL = process.env.HOLDOFF_API_BASE_URL;
    const HOLDOFF_API_TOKEN = process.env.HOLDOFF_API_TOKEN || process.env.HOLDOFF_API_KEY;
    const SUPPORT_EMAIL = 'company@shouldiholdoff.live';

    const body = [
      `Name: ${name.trim()}`,
      `Email: ${email.trim()}`,
      phone ? `Phone: ${phone.trim()}` : null,
      `Organization: ${organization.trim()}`,
      type ? `Type: ${type}` : null,
      details ? `Details: ${details.trim()}` : null,
      website ? `Website: ${website.trim()}` : null,
    ].filter(Boolean).join('\n');

    if (HOLDOFF_API_BASE_URL && HOLDOFF_API_TOKEN) {
      try {
        const proxyUrl = `${HOLDOFF_API_BASE_URL}/api/proxy/email/send`;
        await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + HOLDOFF_API_TOKEN
          },
          body: JSON.stringify({
            to: SUPPORT_EMAIL,
            subject: `Partnership Application: ${name.trim()} — ${organization.trim()}`,
            text: body,
            from_name: name.trim(),
            reply_to: email.trim(),
          }),
        });
      } catch (emailErr) {
        console.warn('[partnership-apply] email send failed:', emailErr.message);
      }
    }

    console.log(`[partnership-apply] ${name.trim()} <${email.trim()}> — ${organization.trim()}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[partnership-apply] error:', err.message);
    return res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
});

// Suggest
app.get('/suggest', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('suggest', { user: user || null });
});

// Legal pages
app.get('/privacy', (_req, res) => res.render('privacy'));
app.get('/terms', (_req, res) => res.render('terms'));
// Permissions disclosure (required by Google Play)
app.get('/permissions', (_req, res) => res.render('permissions'));

// ─── Premium interactive story ───────────────────────────────────────────────
// /story-preview = Stacy's real story (free, served as the preview).
// /story-experience = "put on my shoes" personalized version (premium only).
// /story = legacy alias → preview.
app.get('/story', (_req, res) => res.redirect('/story-preview'));

app.get('/story-preview', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('story-animated', {
    user,
    isPremium: !!(user && ['premium', 'lifetime', 'founder'].includes((user.membership_type || '').toLowerCase())),
  });
});

app.get('/story-experience', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) {
    return res.redirect('/login?returnTo=' + encodeURIComponent('/story-experience'));
  }
  const tier = (user.membership_type || '').toLowerCase();
  const isPremium = ['premium', 'lifetime', 'founder'].includes(tier);
  if (!isPremium) {
    return res.redirect('/pricing?reason=story');
  }
  res.render('story-experience', { user, isPremium: true });
});

// Companion chat page — Sadie or Dan
app.get('/companion', async (req, res) => {
  const user = await getUserFromCookies(req).catch(() => null);
  if (!user) {
    return res.redirect('/login?returnTo=' + encodeURIComponent(req.originalUrl));
  }
  const soul = req.query.soul === 'Dan' ? 'Dan' : 'Sadie';
  const CHARACTERS = {
    Sadie: {
      name: 'Sadie',
      tagline: 'Your soft-spoken pattern spotter',
      emoji: '🌙',
      image: '/assets/SADIE_COMPANION.png',
      greeting: "Hey… I noticed something. Want to talk about it?"
    },
    Dan: {
      name: 'Dan',
      tagline: "The mirror you didn't ask for",
      emoji: '🔥',
      image: '/assets/DAN_COMPANION.png',
      greeting: "Okay. What's actually going on here?"
    }
  };
  const userContext = {
    name: (user && (user.name || user.firstName)) || null,
    isPremium: !!(user && (user.isPremium || user.premium)),
    soul
  };
  res.render('companion', { character: CHARACTERS[soul], user, userContext });
});

// Auth pages
app.get('/login', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (user) return res.redirect('/inbox');
  res.render('login', buildLandingContext({ user: null }));
});

// POST /login safety net — handles form submits (e.g. JS disabled, JS error, or
// browsers that bypass onsubmit handlers). Keeps the page from ever returning
// "Cannot POST /login". Mirrors POST /api/auth/login but supports both
// application/json (xhr) and application/x-www-form-urlencoded (plain form).
app.post('/login', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { findUserByEmail } = require(path.join(__dirname, 'db', 'users'));
    const {
      signAccessToken,
      signRefreshToken,
      holdoffTokenCookieOpts,
      refreshCookieOpts,
    } = require(path.join(__dirname, 'lib', 'auth'));

    const wantsJson =
      req.is('application/json') ||
      (req.headers.accept || '').includes('application/json') ||
      req.xhr === true;

    const { email, password } = req.body || {};
    const normalizedEmail = (email || '').toLowerCase().trim();
    const returnTo = (req.query.returnTo || req.body.returnTo || '/filter').toString();

    const fail = (status, message) => {
      if (wantsJson) return res.status(status).json({ error: message });
      return res.redirect(`/login?error=${encodeURIComponent(message)}&returnTo=${encodeURIComponent(returnTo)}`);
    };

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return fail(400, 'Email is required.');
    }
    if (!password) {
      return fail(400, 'Password is required.');
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user || !user.password_hash) {
      return fail(401, 'Invalid email or password.');
    }
    const valid = await bcrypt.compare(password, user.password_hash).catch(() => false);
    if (!valid) {
      return fail(401, 'Invalid email or password.');
    }

    const accessToken = signAccessToken({ id: user.id, email: normalizedEmail });
    const rawRefreshToken = await signRefreshToken(user.id, normalizedEmail, req.headers['user-agent']);
    res.cookie('holdoff_token', accessToken, holdoffTokenCookieOpts());
    res.cookie('refresh_token', rawRefreshToken, refreshCookieOpts());

    if (wantsJson) {
      return res.json({
        ok: true,
        user: { id: user.id, email: normalizedEmail, name: user.name, subscription_tier: user.membership_type },
      });
    }
    return res.redirect(returnTo);
  } catch (err) {
    console.error('[POST /login] error:', err);
    if ((req.headers.accept || '').includes('application/json')) {
      return res.status(500).json({ error: 'Login failed. Please try again.' });
    }
    return res.redirect('/login?error=' + encodeURIComponent('Login failed. Please try again.'));
  }
});

// Forgot email / account recovery page
app.get('/forgot-email', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (user) return res.redirect('/inbox');
  res.render('forgot-email', { user: null });
});

// Forgot password page
app.get('/forgot-password', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (user) return res.redirect('/inbox');
  res.render('forgot-password', { user: null });
});

// Reset password page
app.get('/reset-password', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (user) return res.redirect('/inbox');
  res.render('reset-password', { user: null });
});

app.get('/signup', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (user) return res.redirect('/inbox');
  res.render('signup', buildLandingContext({ user: null }));
});

app.get('/dashboard', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/dashboard');
  return res.render('dashboard', { user });
});

// Share pages
mountSharePages(app);

// ─── App page routes ──────────────────────────────────────────────────────────

// Journal
app.get('/journal', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/journal');
  res.render('journal', { user });
});

// Chronicle (personalised tips)
app.get('/chronicle', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/chronicle');
  res.render('chronicle', { user });
});

// Community
app.get('/community', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/community');
  res.render('community', { user });
});

// Insights (stats + forecast)
app.get('/insights', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/insights');
  res.render('insights', { user, contacts: [] });
});

// /api/insights/stats — summary counts for the insights page
app.get('/api/insights/stats', async (req, res) => {
  try {
    const user = await getUserFromCookies(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const { getVerdictStats } = require(path.join(__dirname, 'db', 'verdict-history'));
    const stats = await getVerdictStats(user.id).catch(() => null);
    const total = stats?.totalVerdicts || 0;
    // Approximate breakdown: ~60 % held, ~20 % rewritten, ~20 % intercepted
    const held = Math.round(total * 0.6);
    const rewritten = Math.round(total * 0.2);
    const intercepted = total - held - rewritten;
    const holdRate = total > 0 ? Math.round((held / total) * 100) : 0;
    res.json({ held, rewritten, intercepted: Math.max(0, intercepted), holdRate, total });
  } catch (err) {
    console.error('[insights/stats] error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Compose (message composer + AI verdict)
app.get('/compose', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/compose');
  res.render('compose', { user });
});

// Thread view
app.get('/thread/:id', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/thread/' + req.params.id);
  res.render('thread', { user, threadId: req.params.id });
});

// Profile
app.get('/profile', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/profile');
  res.render('profile', { user });
});

// Account
app.get('/account', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/account');
  res.render('account', { user });
});

// Attachment-style quiz (optional auth)
app.get('/quiz', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('quiz', { user: user || null });
});

// Referrals dashboard
app.get('/referrals', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('referrals', { user: user || null });
});

// Examples gallery
app.get('/examples', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('examples', { user: user || null });
});

// Verdict history
app.get('/history', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/history');
  res.render('history', { user });
});

// Upgrade / paywall
app.get('/upgrade', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('upgrade', { user: user || null });
});

// Post-cancel page
app.get('/cancel', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('cancel', { user: user || null });
});

// Post-checkout success page
app.get('/success', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('success', { user: user || null });
});

// Anxious Texting Detox landing
app.get('/detox', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('detox', { user: user || null });
});

// Download page (Android APK)
app.get('/download', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('download', { user: user || null });
});

// Spiral Lock (cooldown screen)
app.get('/spiral-lock', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('spiral-lock', { user: user || null });
});

// Prologue (onboarding story)
app.get('/prologue', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('prologue', { user: user || null });
});

// Beta tester signup page
app.get('/beta', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('beta', { user: user || null });
});

// Beta tester signup API
app.post('/api/beta-signup', async (req, res) => {
  try {
    const { name, email, device, why } = req.body || {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
    }
    const { addBetaTester } = require(path.join(__dirname, 'db', 'beta-testers'));
    const row = await addBetaTester({ name, email, device, why });
    if (!row) {
      // Already signed up — still show success so they're not blocked
      return res.json({ ok: true, already: true });
    }
    console.log(`[beta-signup] new tester: ${email}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[beta-signup] error:', err.message);
    return res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
});

// ─── Missing page routes ──────────────────────────────────────────────────────

app.get('/chronicle', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/chronicle');
  res.render('chronicle', { user });
});

app.get('/journal', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/journal');
  res.render('journal', { user });
});

app.get('/quiz', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('quiz', { user: user || null });
});

app.get('/referrals', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('referrals', { user: user || null });
});

app.get('/history', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/history');
  res.render('history', { user });
});

app.get('/spirals', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('spirals', { user: user || null });
});

app.get('/insights', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/insights');
  res.render('insights', { user });
});

app.get('/examples', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('examples', { user: user || null });
});

app.get('/prologue', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('prologue', { user: user || null });
});

app.get('/upgrade', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('upgrade', { user: user || null });
});

app.get('/account', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/account');
  res.render('account', { user });
});

app.get('/affiliates', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('affiliates', { user: user || null });
});

app.get('/cancel', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('cancel', { user: user || null });
});

app.get('/success', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('success', { user: user || null });
});

app.get('/community', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('community', { user: user || null });
});

app.get('/detox', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('detox', { user: user || null });
});

app.get('/download', async (req, res) => {
  const user = await getUserFromCookies(req);
  res.render('download', { user: user || null });
});

app.get('/thread', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/thread');
  res.render('thread', { user });
});

app.get('/compose', async (req, res) => {
  const user = await getUserFromCookies(req);
  if (!user) return res.redirect('/login?returnTo=/compose');
  res.render('compose', { user });
});

// Ensure tables exist
ensureCommunityTables().catch(e => console.warn('[startup] community tables:', e.message));

const { initializeTables: initMessagingTables } = require(path.join(__dirname, 'db', 'messages'));
initMessagingTables().catch(e => console.warn('[startup] messaging tables:', e.message));

const { runMigrations } = require(path.join(__dirname, 'db', 'migrations'));
runMigrations().catch(e => console.warn('[startup] migrations:', e.message));

const { ensureBetaTestersTable } = require(path.join(__dirname, 'db', 'beta-testers'));
ensureBetaTestersTable().catch(e => console.warn('[startup] beta_testers table:', e.message));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[unhandled error]', err);
  if (res.headersSent) return;
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599
    ? err.status
    : 500;
  res.status(status).json({
    error: status === 503 ? 'Service temporarily unavailable' : 'Internal server error',
    code: err.code === 'DATABASE_UNAVAILABLE' ? 'DATABASE_UNAVAILABLE' : undefined,
  });
});

// A rejection that still escapes must not take the process down mid-request.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

app.listen(port, () => console.log(`HoldOff running on port ${port}`));
