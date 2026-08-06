# Archive

Code that is not part of the running product. Nothing here is built, deployed,
or required by `server.js`. It is kept for reference and can be restored with
`git mv archive/<name> .`.

| Path | What it was | Why it is not in use |
|---|---|---|
| `server/`, `shared/`, `drizzle/`, `drizzle.config.ts` | tRPC + Drizzle API server | Exposes tRPC procedures; the Android app and web pages both speak REST to `routes/`. Never deployed. |
| `client/`, `vite.config.ts*`, `tsconfig.json`, `vitest.config.ts` | React/Vite SPA | The served frontend is EJS in `views/`. Its Vite plugin peer conflict also blocked `npm install` for the real app. |
| `manus-web/` | Second copy of the tRPC app | Duplicate of `server/` from a separate merge. |
| `app/` | Android app, `com.stacymartin.holdoff` | Not in `settings.gradle.kts`, applies an undeclared KSP plugin, and none of its classes appear in the shipped APK. The built module is `android-app/app`. |
| `holdoff-android-new/` | — | Contained only `BUILD_TRIGGER.md`. |
| `index.js`, `app.js`, `app.py`, `emergency-static-server.js` | Render start-command shims | No Render service exists; every deploy path now starts `server.js`. |
| `pnpm-lock.yaml` | pnpm lockfile | The app installs with npm and `package-lock.json`. |
| `workspace/`, `.manus-logs/` | Scratch output and build-tool logs | Development leftovers. |
| `outreach-emails.js`, `verify-diversity.js`, `BUILD_TRIGGER.txt`, `redeploy.txt` | One-off scripts and CI triggers | Referenced by nothing. |
