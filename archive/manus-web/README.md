# HoldOff — Manus Web App (React + tRPC + Drizzle)

This is the Manus-built rebuild of the HoldOff web app.

## Stack
- React 19 + Tailwind 4 + Vite
- tRPC 11 + Express 4
- Drizzle ORM + MySQL/TiDB
- Manus OAuth

## Run locally
```bash
pnpm install
pnpm dev
```

## Key features
- Marketing landing page with embedded live Filter demo
- HoldOff Filter (SEND/WAIT/DO NOT SEND verdict)
- AI Message Interpreter
- Animated companion chat (Sadie, Stacy, Danny, Dan) with expression-swapping avatars
- Spiral Lock (cooldown after 3 consecutive DO NOT SEND verdicts)
- Journal, Community feed, Chronicle insights
- Attachment style quiz, contact management
