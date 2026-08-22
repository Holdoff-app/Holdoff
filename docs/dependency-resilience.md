# HoldOff Dependency Resilience + Local Knowledge Fallback

This repository now supports a deterministic degraded mode for key third-party dependencies and a local backup knowledge base for AI-facing features.

## 1) Dependency categories and fallback behavior

Dependency policy is centralized in:

- `/home/runner/work/Holdoff/Holdoff/config/dependency-policy.js`

It reports whether the app is in:

- `full` mode (core dependencies configured)
- `degraded` mode (one or more capabilities unavailable)

Current categories tracked:

- AI providers: Anthropic, OpenAI
- Payments: Stripe
- Email: Postmark or HoldOff proxy
- Auth: Google auth + JWT
- Database: PostgreSQL
- Notifications: web-push (VAPID)
- Observability: Sentry
- Storage: S3 credentials/bucket presence

Health endpoint:

- `GET /api/health` now includes `mode` and dependency capability status.

## 2) Backup knowledge base

Local knowledge base location:

- `/home/runner/work/Holdoff/Holdoff/data/knowledge/backup-knowledge-base.json`

Service:

- `/home/runner/work/Holdoff/Holdoff/services/knowledge-base.js`

Behavior:

- Seeds from local repository sources:
  - `README.md`
  - `SADIE_KNOWLEDGE.md`
  - `WIKI.md`
  - `FEATURE_MAP.md`
  - `docs/render-exit-cutover.md`
- Includes durable seed entries for mission/safety/degraded behavior
- Provides deterministic keyword/topic retrieval (no vector DB, no hosted retrieval API)

## 3) Resilient AI wrapper behavior

Resilient AI fallback service:

- `/home/runner/work/Holdoff/Holdoff/services/resilient-ai.js`

When external AI providers fail or are unavailable:

- `/api/filter/analyze` returns knowledge-grounded HOLD fallback
- `/api/filter/interpret` returns knowledge-grounded interpret fallback
- `/api/interpreter` returns knowledge-grounded analysis payload
- `/api/verdict` returns safe fallback verdict object
- `/api/companion/chat` returns a local companion fallback message

Safety boundary remains explicit in fallback copy:

- HoldOff support is non-diagnostic and not a substitute for professional care.

## 4) Non-AI dependency resilience additions

- Email (`services/email.js`)
  - Postmark failure falls back to proxy
  - Proxy failure falls back to local degraded logging + queue file
  - Failed send work is persisted to:
    - `/home/runner/work/Holdoff/Holdoff/data/degraded/failed-work.ndjson`

- Payments (`routes/checkout.js`)
  - Stripe-dependent endpoints now return safe `503` when Stripe capability is unavailable:
    - `/api/checkout/portal`
    - `/api/checkout/verify-session`

- Google auth (`routes/auth.js`, `routes/google-auth.js`)
  - returns safe `503` with email-login guidance when unavailable

- Push notifications (`routes/push.js`)
  - push preference/subscribe/send endpoints explicitly gate on VAPID capability

- Observability (`server.js`)
  - Sentry init is skipped safely when DSN is missing

## 5) Operational expectations in degraded mode

- Public pages and non-dependent routes continue serving.
- Dependency-backed actions return explicit, user-safe responses.
- AI routes provide grounded local fallback output instead of hard failure.
- Failed external email sends are queued locally for later inspection/replay.

## 6) Extending/updating the local knowledge base

1. Update:
   - `/home/runner/work/Holdoff/Holdoff/data/knowledge/backup-knowledge-base.json`
2. Add/adjust `source_files` and/or `entries`.
3. Keep content grounded in repository-local docs and safety language.
4. Restart app process to reload module cache in long-running processes.

## 7) Env reference (optional vs required)

Required for full mode:

- `DATABASE_URL`
- `JWT_SECRET`
- At least one of: `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Email path: `POSTMARK_API_KEY` or `HOLDOFF_EMAIL_PROXY_URL` (+ token)

Optional but recommended:

- `SENTRY_DSN`
- `GOOGLE_CLIENT_ID`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET`
