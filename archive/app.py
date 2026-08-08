"""
Emergency Render compatibility shim for HoldOff.
If the Render service is accidentally configured as Python/Gunicorn, this serves
critical public HoldOff pages instead of leaving the domain on the default
"Hello from Render" placeholder.

The primary app remains the Node/Express service in server.js.
"""
from flask import Flask, send_from_directory, Response, request, redirect
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
VIEWS = ROOT / "views"

app = Flask(__name__, static_folder=str(PUBLIC), static_url_path="")


def html_response(path: Path):
    if path.exists():
        return Response(path.read_text(encoding="utf-8", errors="ignore"), mimetype="text/html")
    return None


@app.get("/health")
def health():
    return {"status": "healthy", "mode": "python-compat", "service": "holdoff"}


@app.get("/")
def home():
    for candidate in [VIEWS / "index.ejs", PUBLIC / "index.html", ROOT / "index.html"]:
        resp = html_response(candidate)
        if resp:
            return resp
    return Response("""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HoldOff — Don’t send it yet</title>
<meta name="description" content="HoldOff helps you pause before sending emotionally charged texts.">
<style>
body{margin:0;background:#0d0d0d;color:#f5f2ff;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px}.wrap{max-width:860px}.badge{display:inline-block;border:1px solid #33245f;background:#181127;color:#c4b5fd;padding:7px 12px;border-radius:999px;font-size:13px;margin-bottom:22px}h1{font-size:clamp(42px,8vw,82px);line-height:.95;margin:0 0 18px;letter-spacing:-.06em}h1 span{color:#a78bfa}.sub{font-size:clamp(18px,3vw,26px);color:#d8d0ff;line-height:1.35;max-width:740px;margin:0 0 26px}.copy{color:#a8a1b8;line-height:1.7;font-size:16px;max-width:690px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:30px 0}.card{background:#141414;border:1px solid #24202e;border-radius:16px;padding:18px}.card b{display:block;color:#fff;margin-bottom:7px}.card p{margin:0;color:#aaa;font-size:14px;line-height:1.5}.cta{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.btn{border-radius:12px;padding:14px 18px;text-decoration:none;font-weight:700}.primary{background:#a78bfa;color:#12091f}.secondary{border:1px solid #3a334d;color:#e9ddff}.note{margin-top:24px;color:#777;font-size:13px}
</style></head><body><main class="wrap">
<div class="badge">AI-powered texting pause tool</div>
<h1>Don’t send it <span>yet.</span></h1>
<p class="sub">HoldOff helps you catch the fear-text, the double-text, the apology spiral, and the 2am message before it becomes regret.</p>
<p class="copy">Paste a message and get a simple verdict: SEND, HOLD, or REWRITE. Built for anxious attachment, post-breakup spirals, and the moments when your nervous system grabs the keyboard.</p>
<section class="cards"><div class="card"><b>HOLD / SEND / REWRITE</b><p>Clear verdicts before you hit send.</p></div><div class="card"><b>Psychology-backed</b><p>Attachment-aware explanations without shame.</p></div><div class="card"><b>Spiral Lock</b><p>A stronger pause for high-risk moments.</p></div></section>
<div class="cta"><a class="btn primary" href="/filter">Try the message filter</a><a class="btn secondary" href="/pricing">See pricing</a></div>
<p class="note">HoldOff is currently completing a production deployment recovery. Core public pages are being restored first.</p>
</main></body></html>""", mimetype="text/html")


@app.get("/pricing")
def pricing():
    for candidate in [VIEWS / "pricing.ejs", PUBLIC / "pricing.html", VIEWS / "checkout.ejs"]:
        resp = html_response(candidate)
        if resp:
            return resp
    return redirect("/#pricing", code=302)


@app.get("/checkout")
def checkout():
    # If Stripe links are configured as env vars, redirect there. Otherwise keep a safe placeholder.
    stripe_url = os.getenv("STRIPE_CHECKOUT_URL") or os.getenv("HOLD_OFF_CHECKOUT_URL")
    if stripe_url:
        return redirect(stripe_url, code=302)
    return Response(
        "<h1>HoldOff Checkout</h1><p>Checkout is being restored. Please come back shortly.</p>",
        mimetype="text/html",
        status=503,
    )


@app.get("/filter")
def filter_page():
    for candidate in [VIEWS / "filter.ejs", PUBLIC / "filter.html"]:
        resp = html_response(candidate)
        if resp:
            return resp
    return redirect("/", code=302)


@app.get("/manifest.webmanifest")
def manifest():
    return send_from_directory(PUBLIC, "manifest.webmanifest")


@app.get("/robots.txt")
def robots():
    return send_from_directory(PUBLIC, "robots.txt")


@app.get("/sitemap.xml")
def sitemap():
    return send_from_directory(PUBLIC, "sitemap.xml")


@app.get("/<path:path>")
def catch_all(path):
    # Static assets and SEO pages
    static_file = PUBLIC / path
    if static_file.exists() and static_file.is_file():
        return send_from_directory(PUBLIC, path)

    seo_file = PUBLIC / "seo" / f"{path}.html"
    if seo_file.exists():
        return send_from_directory(PUBLIC / "seo", f"{path}.html")

    # Avoid hard 404 for public launch while Render settings are being repaired.
    return home()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "3000")))
