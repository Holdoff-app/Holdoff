# Emergency Live Recovery Status

This commit intentionally triggers the connected Render deployment after verifying both supported startup paths locally:

- Node path: `npm ci --omit=dev`, `npm run build`, `npm start`, `/health`
- Python fallback path: `pip install -r requirements.txt`, `python app.py`, `/health`

Goal: get HoldOff public pages live immediately while the full hosting migration continues.
