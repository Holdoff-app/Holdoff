# HoldOff App TODO

## Fixes & Improvements

- [x] Fix web app project structure (manus-web files moved to root)
- [x] Fix LLM response parsing bug - routers.ts was using `choices[0].message.content` (OpenAI format) correctly
- [x] Upload Stacy's real photo and update AnimatedAvatar component
- [x] Add `dan` companion persona to server router (companion.chat)
- [x] Add `dan` companion to CompanionsPage listing
- [x] Add `dan` companion to CompanionChatPage with metadata
- [x] Add `expression` return field to companion.chat procedure
- [x] Write Vitest tests for core tRPC procedures (filter, interpret, companion, journal, spiral, auth)
- [x] Create vitest.config.ts pointing to server test files
- [x] All 15 tests passing (2 test files)
- [x] TypeScript: 0 errors

## Pending Features

- [x] Push latest fixes to GitHub
- [ ] Google Play Store APK build via Capacitor

## Merge old app into new app
- [x] Merge full verdict SYSTEM_PROMPT (4 attachment styles) into routers.ts
- [x] Merge full INTERPRET_SYSTEM_PROMPT into routers.ts
- [x] Merge Sadie + Dan souls with attachment style overlays
- [x] Merge spiral lock logic (5 attempts / 5 min window)
- [x] Merge contact insights analysis
- [x] Merge 12 example messages (filter.examples)
- [x] Merge Stripe pricing tiers (pricing.plans + getCheckoutUrl)
- [x] Update FilterPage for SEND/HOLD/REWRITE verdicts
- [x] Update InterpretPage for new field names
- [x] Rewrite PricingPage with Stripe checkout
- [x] Update CompanionChatPage (4 personas)
- [x] Add /api/health endpoint
- [x] Update + pass all vitest tests (18 passing)

## Backend usage logging
- [x] Add feature_usage table to schema + migration
- [x] Add logFeatureUsage db helper
- [x] Log usage on filter, interpret, companion, quiz, contacts, spiral
- [x] Add admin router: summary, featureStats, recentActivity (role-gated)
- [ ] Add admin stats page in UI

## Admin dashboard app (role-gated)
- [x] admin_audit_log table created
- [ ] Admin DB helpers: users overview, role update, community moderation, audit writer
- [ ] Admin dashboard UI (/admin) gated by role
- [ ] Admin: usage analytics + users + activity feed
- [ ] Admin: community moderation (hide/restore/flag)
- [ ] Sadie admin AI assistant w/ function-calling tools (stats, moderation, roles)
- [ ] Every Sadie/admin action audit-logged; NO crisis/private content access

## Mandatory emergency contact + crisis safety
- [x] safety_flags table created (re-scoped: aggregate metrics only, not admin-readable content)
- [ ] emergency_contacts schema (mandatory >=1 per user)
- [ ] Onboarding gate: must add emergency contact before core features
- [ ] Settings page to manage emergency contact(s)
- [ ] Crisis-signal detection helper (self-harm / harm-to-others / risk)
- [ ] Crisis resources UI (988, Crisis Text Line 741741, 911) shown immediately
- [ ] On crisis signal: email emergency contact a check-in alert (no raw content)
- [ ] Companions break character on crisis and surface resources
- [ ] In-app + policy disclaimers: best-effort, not emergency monitoring

## Security hardening (mental-health sensitive data)
- [ ] AES-256-GCM encryption helper for sensitive fields
- [ ] Encrypt journal content at rest
- [ ] Encrypt contact name/phone at rest
- [ ] Encrypt verdict/interpret message content at rest
- [ ] Secure HTTP headers (HSTS, CSP, X-Frame-Options, etc.)
- [ ] Enable DB SSL in connection
- [ ] Ensure no sensitive data written to usage logs
- [ ] Rate limiting on AI endpoints
- [ ] Privacy note in-app

## Compliance deliverables
- [ ] Privacy Policy (mental-health specific)
- [ ] Terms of Service
- [ ] Data Safety section answers
- [ ] Health Apps Declaration answers
- [ ] Crisis/safety disclosures

## Deployment + discovery
- [x] Fix render.yaml / Dockerfile to build Manus app
- [ ] End-to-end functional verification of every feature
- [ ] Update + pass vitest suite for new procedures
- [ ] Save checkpoint
- [ ] Push to GitHub
- [ ] Produce full printable discovery document (PDF) with launch checklist
