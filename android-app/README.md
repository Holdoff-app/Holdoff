# HoldOff — Native Android App

A real native Kotlin/Compose Android app for HoldOff. Not a webview wrapper.

## What's inside

```
android-app/
├── build.gradle.kts          ← root Gradle config
├── settings.gradle.kts       ← module list
├── gradle.properties         ← Gradle JVM settings
├── codemagic.yaml            ← cloud build pipeline (auto-builds APK)
└── app/
    ├── build.gradle.kts      ← app-level deps & build types
    ├── proguard-rules.pro    ← release shrinking rules
    └── src/main/
        ├── AndroidManifest.xml
        ├── res/values/       ← colors, strings, theme
        └── java/com/holdoff/app/
            ├── MainActivity.kt          ← app entry point
            ├── HoldOffApplication.kt    ← app singleton
            ├── navigation/              ← all screen routes in one file
            ├── ui/
            │   ├── theme/               ← midnight velvet palette
            │   ├── components/          ← Sadie avatar, verdict badge, bottom nav
            │   └── screens/             ← every screen as its own file
            ├── data/
            │   ├── model/               ← SMSThread, Message, Contact, VerdictResult
            │   ├── repository/          ← reads SMS + Contacts from device
            │   └── receiver/            ← incoming SMS broadcast receiver
            └── viewmodel/               ← screen state holders
```

## Features

- ✅ **Real SMS + Contacts sync** — reads device threads via ContentResolver
- ✅ **Sadie companion chat** — small, persistent, animated avatar
- ✅ **AI verdicts** — Hold Off / Reach Out / Maybe with pattern insights
- ✅ **Premium story** — Stacy's real story first, then 'put on her shoes' personalization
- ✅ **AI Stacy + AI Danny companions** — premium-gated personalities
- ✅ **Subscribe / Free Trial / Lifetime / Gift** — Play Billing integration
- ✅ **Settings** — launch conditions (user-checkbox, editable), pattern tracking, disclaimers
- ✅ **Mental health disclaimer everywhere** — not therapy, not diagnosis
- ✅ **Midnight velvet theme** — deep purples + romantic blues only, never coral

## How to build

The `codemagic.yaml` at the repo root tells Codemagic how to build a signed APK + AAB automatically. Once Codemagic is connected to this repo and the signing keystore is uploaded, every push to `native-android` produces a release-ready binary.

Local build (Android Studio):
```
cd android-app
./gradlew assembleRelease
```

## Folder map — find things fast

| Looking for…                | File path |
|-----------------------------|-----------|
| App entry point             | `app/src/main/java/com/holdoff/app/MainActivity.kt` |
| Every screen route          | `navigation/AppNavigation.kt` |
| Color palette               | `ui/theme/Color.kt` |
| SMS list screen             | `ui/screens/HomeScreen.kt` |
| Individual thread           | `ui/screens/ThreadDetailScreen.kt` |
| Verdict result UI           | `ui/screens/VerdictScreen.kt` |
| Sadie chat                  | `ui/screens/CompanionScreen.kt` |
| Premium story               | `ui/screens/PremiumStoryScreen.kt` |
| Subscribe / paywall         | `ui/screens/PaywallScreen.kt` |
| Profile + sign out          | `ui/screens/ProfileScreen.kt` |
| Settings + launch conditions| `ui/screens/SettingsScreen.kt` |
| Login / Forgot Password     | `ui/screens/LoginScreen.kt` |
| Sadie avatar component      | `ui/components/SadieCompanion.kt` |
| Verdict badge component     | `ui/components/VerdictBadge.kt` |
| Read SMS from device        | `data/repository/SMSRepository.kt` |
| Read contacts               | `data/repository/ContactsRepository.kt` |
| Incoming SMS handler        | `data/receiver/SMSReceiver.kt` |
