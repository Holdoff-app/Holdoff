# HoldOff — CLAUDE.md

## What this app does
AI-powered message filter for all insecure attachment styles. Users compose texts late at night; the app intercepts and encourages delay before sending. Landing page converts visitors to sign up for the product.

## Stack
Express.js + EJS + PostgreSQL (Neon)

## Directory map
- `server.js` — Express entry point, route mounting, middleware, auth-aware page rendering
- `db/index.js` — PostgreSQL pool (only file allowed to `new Pool()`)
- `db/users.js` — User account queries (create, find, update, delete, email verification, membership_type)
- `db/journal.js` — Pattern journal CRUD + insights (top patterns, time heatmap, streak tracking)
- `db/waitlist.js` — Waitlist table queries
- `db/nurture-queue.js` — Nurture queue table queries (enqueue, fetch due rows, mark sent/failed)
- `db/subscriptions.js` — Subscription + magic_token table queries (membership entitlement, membership_type field)
- `db/dunning.js` — Dunning attempts table queries (create, status transitions, metrics)
- `db/healthchecks.js` — Healthcheck probe log writes + reads
- `db/verdict-logs.js` — Enriched verdict log writes with user_id/message_length/attachment_style_snapshot for pattern journal
- `db/contacts.js` — Relationship anatomy (contacts + message history + analysis)
- `routes/` — API route groups: meta, stripe-webhook, auth (sign-up/login/logout/account), filter (AI + verdict enforcement), waitlist, checkout (Stripe checkout + magic link restore), share (share card create + OG image), admin (internal trigger endpoints), detox (5-day email course signup + unsubscribe), affiliates (therapist partner signup), referral (peer-to-peer send + tiered reward dashboard), journal (pattern journal API + streak), abandoned-checkout (unsubscribe endpoint for recovery emails)
- `lib/` — Shared helpers: auth.js (JWT utilities), landing-context.js (EJS render context)
- `services/` — Email service (Resend API wrapper); nurture-emails.js (3-email auto_intercept sequence templates); detox-emails.js (5-day Anxious Texting Detox drip templates); referral-email.js (peer referral + reward-unlocked emails); welcome-email.js (post-signup welcome email template); dunning-email.js (d0/d3 payment failure recovery templates)
- `views/` — EJS templates (layout.ejs + partials/, filter.ejs, detox.ejs, download.ejs, spirals.ejs, seo-page.ejs, seo/*.ejs for SEO landing pages)
- `android/` — Capacitor Android project (WebView wrapper); CI builds APK via GitHub Actions and commits to public/holdoff.apk; includes Accessibility Service for real-time SMS text interception + verdict overlay UI
- `public/css/` — Stylesheets (theme.css for landing, filter.css for /filter page, pwa.css for safe-area + install prompt, referrals.css for /referrals dashboard)
- `public/demos/` — Animated SVG demo assets: intercept-demo.svg (landing page), intercept-demo-square.svg (1080x1080 social), intercept-demo-vertical.svg (1080x1920 TikTok/IG)
- `public/icons/` — PWA icons (192/512 standard, 120/152/167/180 apple-touch, 512 maskable, iOS splash screens)
- `public/sw.js` — Service worker: app-shell cache, offline fallback, push notification display, periodic sync + background sync for daily reminder scheduling (quiet hours respected, 12h throttle, copy rotation)
- `public/manifest.webmanifest` — Web app manifest (start_url: /filter, display: standalone)
- `data/` — Static JSON data files (examples.json: 12 curated verdict examples for /examples gallery)
- `migrate.js` — Migration runner (core `users` table + folder migrations)
- `migrations/` — SQL/JS migration files, applied once and tracked in `_migrations`
- `jobs/verdict-monitor.js` — Cron job: probes POST /api/filter/analyze every minute, emails alert on failure, logs to healthchecks table
- `jobs/nurture-email.js` — Cron job: every 15 min, sends email-2 to auto_intercept signups whose 72hr window has passed
- `jobs/detox-email.js` — Cron job: every hour, sends next drip email to due detox_subscribers rows
- `jobs/abandoned-checkout.js` — Cron job: every 15 min, sweeps abandoned_checkouts pending >60 min and fires one recovery email per address
- `jobs/dunning-email.js` — Cron job: every 30 min, sends d0 email to new payment failures and d3 follow-up if still unpaid after 3 days
- `polsia.toml` — Blaxel cron declarations (verdict-api-monitor: every 5 min; auto-intercept-nurture: every 15 min; detox-drip-sender: every hour; abandoned-checkout-recovery: every 15 min; dunning-email-sender: every 30 min)

## Database
- `exit_intent_events` — event_type (modal_shown/modal_submitted/modal_dismissed), email, device_id, created_at (exit-intent modal conversion funnel)
- `users` — email, name, password_hash, subscription fields; email_verified, email_verification_token, email_verification_expires_at, welcome_sent_at, paywall_hit_at, winback_sent_at, current_streak, last_active_at (HoldOff account system + pattern journal streak)
- `waitlist` — email, source, created_at (pre-launch signups; source='landing'|'hero'|'auto_intercept' etc.)
- `subscriptions` — email, stripe_customer_id, stripe_subscription_id, status, current_period_end, membership_type, grace_until (HoldOff Pro; membership_type: online/app/lifetime)
- `magic_tokens` — email, token, expires_at, used_at (passwordless restore access links)
- `healthchecks` — checked_at, status (ok/down), response_time_ms, http_status, body_snippet, error_message (verdict API probe log)
- `verdict_logs` — logged_at, verdict_source (proxy/direct_anthropic/direct_openai/fallback), verdict, latency_ms, error_message, user_id, message_length, attachment_style_snapshot (per-request AI call log + pattern journal analytics)
- `share_cards` — token (nanoid 10), streak_count, verdict_type, pattern_name, created_at, view_count (anonymous viral share cards; no user identifier, no message content)
- `nurture_queue` — email, email_step (2 or 3), scheduled_at, sent_at, failed_at (auto_intercept email sequence scheduler)
- `detox_subscribers` — email, subscribed_at, next_step (0-4, 5=complete), next_send_at, unsubscribed (5-day Anxious Texting Detox drip)
- `referrals` — sender_email/device, recipient_email, note, utm_token, converted_at (peer referral tracking)
- `user_referral_stats` — sender_email, daily_send_count, daily_reset_at, total_referrals, total_converted, reward_credits, trial_days_granted, lifetime_unlocked (tiered reward state)
- `referral_rewards` — sender_email, tier, reward_type, reward_value, referral_count, unlocked_at (reward unlock history)
- `journal_entries` — user_id, trigger_text, message_text, outcome, pattern_name, reframe, verdict, hour_of_day, source, verdict_log_id (pattern journal — triggers, pattern history tied to verdict engine)
- `journal_streaks` — user_id, current_streak, longest_streak, last_entry_date, total_entries (journal engagement streak tracking)
- `notification_preferences` — user_id, subscription (JSONB VAPID PushSubscription), reminder_time (9am/8pm/10pm), enabled, quiet_hours (JSONB {start, end}), created_at, updated_at (push notification preferences)
- `abandoned_checkouts` — session_id, email, tier, amount, currency, payment_link, status (pending/converted/emailed/suppressed), unsub_token, created_at, emailed_at, converted_at (abandoned Stripe session recovery)
- `dunning_attempts` — subscription_id, customer_id, email, status (pending/sent_d0/sent_d3/recovered/lost), attempt_count, last_sent_at, failure_detected_at, recovered_at, lost_at (payment failure recovery state per subscription)
- `_migrations` — tracks applied migration names
- `contacts` — id, user_id, display_name, relationship, duration_days, deleted_at (relationship anatomy for message interception)
- `message_history` — id, user_id, contact_id, direction (sent/received), pattern_name, verdict, hour_of_day, day_of_week, metadata (JSONB), sent_at (per-contact message metadata for relationship analysis)
- `relationship_analysis` — id, user_id, contact_id, analysis_text, health_score, attachment_pattern, exit_warning, analyzed_at (per-contact periodic digest)

## External integrations
- Stripe — 7-tier pricing: online weekly ($4.99/wk), app weekly ($7.49/wk), online monthly ($9.99/mo), app monthly ($14.99/mo), online annual ($99/yr), app annual ($149/yr), lifetime ($299 once); CashApp Pay enabled; checkout via Polsia Stripe MCP (buy.stripe.com payment links); routes/checkout.js serves tier-specific URLs; webhook handles checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.deleted; membership_type stored in subscriptions table
- Meta Pixel (ID: 878230961304067) — PageView on every page load; Lead on signup/waitlist; Purchase on confirmed Stripe payment
- OpenAI — gpt-4o-mini via routes/filter.js for message analysis (verdict, pattern, reframe, rewrite); direct fallback via OPENAI_DIRECT_API_KEY
- Anthropic — claude-3-5-haiku-20241022 via routes/filter.js; preferred direct fallback when Polsia proxy is blocked; requires ANTHROPIC_API_KEY
- Resend — transactional and outreach email via `hello@shouldiholdoff.live`; domain `shouldiholdoff.live` must be verified in Resend dashboard (DKIM/SPF DNS records) before sending

## Recent changes
- 2026-06-08 — Fix blank white screen bug: SW navigation fetch changed from cache-first to network-first (holdoff-v4). Navigation requests now always fetch fresh pages from the server to prevent stale cached HTML after deploys. Added message handler for immediate SW activation. CACHE_NAME bumped to holdoff-v4.
- 2026-06-07 — Pattern journal streak engine: added current_streak + last_active_at to users table (migration 1781310000000); verdict_logs enriched with user_id/message_length/attachment_style_snapshot; POST /api/verdict updates user streak after every verdict; GET /api/users/profile returns streak data + verdict_count from verdict_logs; streak logic: next-day window increments (+1), 48h+ gap resets to 1, same-day check-in unchanged
- 2026-06-06 — 7-day paywall win-back email: stamps paywall_hit_at on users table at 5th verdict hit (first only); jobs/winback-email.js (every 6h) finds logged-in free users at 7–8 day mark, creates single-use Stripe coupon (20% off, expires 72hr, max_redemptions=1), fires Resend email with Monthly ($9.99→$7.99) and Annual ($99→$79.20) CTAs; stamps winback_sent_at dedup; winback_converted logged via checkout.session.completed if coupon campaign=winback_d7; GET /api/admin/metrics includes winback block; polsia.toml declares winback-email-d7 cron (every 6h); migration 1780990000000_add_winback_fields.sql
- 2026-06-06 — Stripe dunning recovery email: invoice.payment_failed creates dunning_attempts row (skips Lifetime); jobs/dunning-email.js sends d0 email (T+0) via Stripe Customer Portal payment_method_update flow, d3 follow-up after 3 days if still unpaid; invoice.paid marks recovered; customer.subscription.deleted marks lost; max 2 emails per window; GET /api/admin/metrics includes dunning block; polsia.toml declares dunning-email-sender cron (every 30 min); migration 1780723602698_add_dunning_attempts.sql
- 2026-06-06 — Post-signup welcome email: fires async within 60s of account creation via setImmediate in routes/auth.js; deduped by welcome_sent_at column (CAS update in db/users.markWelcomeSent); template in services/welcome-email.js (subject: "Your hold-off starts now."); logs welcome_sent + welcome_to_first_verdict (when user submits a verdict within 24h) to exit_intent_events; GET /api/admin/metrics returns welcome field with welcome_sent/opened/clicked/welcome_to_first_verdict counts; migration 1780970000000_add_welcome_sent_at.sql
- 2026-06-06 — Abandoned-checkout recovery email: webhook listens for checkout.session.created (stores pending row in abandoned_checkouts) + checkout.session.expired (triggers job) + checkout.session.completed (marks converted); cron job every 15 min sweeps pending >60 min, fires one Resend recovery email per address (subject: "You almost held off — your spot's still open."), suppresses if converted in last 30 days or already emailed; token-based unsubscribe at GET /api/abandoned-checkout/unsub; metrics in GET /api/admin/metrics as abandoned_checkout field; polsia.toml declares abandoned-checkout-recovery cron
- 2026-06-06 — Day 4 detox email referral viral loop: added referral CTA block to final drip email (day4); referral code generated server-side from subscriber email (SHA-256 hash, 12 chars); button links to /referrals?ref={code}&source=detox_day5; /referrals page fires POST /api/detox/referral-click on load when source=detox_day5; click count tracked in exit_intent_events as referral_click_detox_day5; GET /api/admin/metrics now includes detox_day5_referral_click field


