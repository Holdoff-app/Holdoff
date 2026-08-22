# HoldOff Native App — Feature Map

This file lists every feature included in the native Android app and where
to find it in the source. It's the easy-to-navigate index.

## Companions (alter egos)
- `domain/companion/Companion.kt` — Sadie (Stacy's alter ego) and Dan (Danny's alter ego)
- `domain/companion/CompanionDisclosure.kt` — the first-launch alert text explaining who they are and what they are NOT
- `ui/screens/CompanionIntroScreen.kt` — the in-app alert screen the user must acknowledge before using Sadie/Dan
- `ui/screens/CompanionScreen.kt` — the live chat with the chosen companion
- `domain/companion/EmpathyInsights.kt` — Sadie + Dan empathic reflections, mirrors, and permissions per mood

## Verdict Engine
- `domain/verdict/VerdictInterpreter.kt` — HOLD_OFF / REACH_OUT / WAIT_AND_SEE with confidence + reasoning
- `ui/screens/VerdictScreen.kt` — the verdict UI with Sadie + Dan dual readout

## Spiral Lock
- `domain/spiral/SpiralLock.kt` — blocks Send during spirals with cool-down + calm-sentence release

## Message Analysis
- `domain/analysis/MessageAnalyzer.kt` — per-message mood, attachment signal, urgency, charge, risk flags

## Relationship Analysis
- `domain/analysis/RelationshipAnalyzer.kt` — thread-level read: dominant styles, balance, trend, Sadie+Dan insights

## Attachment Quiz
- `domain/quiz/AttachmentQuiz.kt` — 16 questions, 4 scales (anxious / avoidant / secure / disorganized)
- `ui/screens/QuizScreen.kt` — the interactive quiz UI

## Mood Color Engine
- `ui/theme/MoodColorEngine.kt` — dynamic midnight-velvet + romantic-deep-blue palette that shifts with inferred mood (never peach/coral)

## SMS / Contacts / Threads
- `data/repository/SMSRepository.kt` — real SMS read + contact resolution + thread list
- `ui/screens/HomeScreen.kt` — threads-first home
- `ui/screens/ThreadDetailScreen.kt` — full thread view

## Premium Story
- `ui/screens/PremiumStoryScreen.kt` — Stacy's real story first, then "put on my shoes" personalization
- `ui/screens/PaywallScreen.kt` — Play Billing subscription gate

## Account
- `ui/screens/ProfileScreen.kt` — Google Sign-In, user ID, sign out
- `ui/screens/SettingsScreen.kt` — launch conditions (multi-checkbox, editable), pattern tracking, quiz result, mood-color sensitivity, disclaimers

## Disclaimers
Mental health disclaimers appear in:
- `CompanionDisclosure.kt` (first launch)
- `SettingsScreen.kt` (always visible)
- `PremiumStoryScreen.kt` (footer)

HoldOff is a tool, not therapy, not diagnosis, not a substitute for professional care.
