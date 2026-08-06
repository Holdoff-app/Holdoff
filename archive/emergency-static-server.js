'use strict';
const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
if (STRIPE_WEBHOOK_SECRET && !STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
  throw new Error('[startup] Invalid STRIPE_WEBHOOK_SECRET. Expected a Stripe webhook signing secret beginning with whsec_.');
}
const PRICE_ID = 'price_1Tggwx3OofPcGPa3yT6kamMQ';
const BASE_URL = process.env.BASE_URL || 'https://shouldiholdoff.live';

function send(res, status, html, ct) {
  res.writeHead(status, { 'Content-Type': ct || 'text/html; charset=utf-8' });
  res.end(html);
}

function sendJSON(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readRequestBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        if ((req.headers['content-type'] || '').includes('application/json')) {
          return resolve(JSON.parse(body || '{}'));
        }
      } catch (_) {}
      const params = new URLSearchParams(body || '');
      resolve(Object.fromEntries(params.entries()));
    });
    req.on('error', () => resolve({}));
  });
}

// ── Stripe helper ──────────────────────────────────────────────────────────
function stripePost(path, params) {
  return new Promise((resolve, reject) => {
    const body = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const opts = {
      hostname: 'api.stripe.com',
      path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(opts, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Pages ──────────────────────────────────────────────────────────────────
const home = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HoldOff — Don't send it yet</title><meta name="description" content="HoldOff helps you pause before sending emotionally charged texts."><style>:root{--bg:#0c0b10;--ink:#fff8f1;--muted:#b9adc9;--purple:#a78bfa;--line:#2a2435;--yellow:#fde68a}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% 10%,#2b164c 0,#0c0b10 38%,#09080c 100%);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.5}.wrap{max-width:1100px;margin:0 auto;padding:28px}nav{display:flex;justify-content:space-between}.brand{font-weight:900;letter-spacing:-.05em;font-size:26px}.nav a{color:var(--muted);margin-left:16px;text-decoration:none;font-weight:800}.hero{padding:86px 0 54px;display:grid;grid-template-columns:1.1fr .9fr;gap:30px;align-items:center}.badge{display:inline-block;border:1px solid #453663;background:#171120;color:#d8c7ff;padding:8px 13px;border-radius:999px;font-size:13px;font-weight:800;margin-bottom:22px}h1{font-size:clamp(46px,8vw,92px);letter-spacing:-.075em;line-height:.9;margin:0 0 22px}h1 span{color:var(--purple)}.sub{font-size:clamp(19px,3vw,28px);color:#eadfff;margin:0 0 18px;max-width:760px}.copy{color:var(--muted);font-size:17px;max-width:690px}.cta{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}.btn{display:inline-block;border-radius:14px;padding:15px 19px;text-decoration:none;font-weight:900}.primary{background:var(--purple);color:#13091f}.secondary{border:1px solid #4a405e;color:#fff;background:#14111b}.panel,.card{background:rgba(21,19,28,.84);border:1px solid var(--line);border-radius:24px;padding:22px}.bubble{background:#26202f;border-radius:18px 18px 4px 18px;padding:13px;margin:10px 0}.verdict{margin-top:18px;background:#21163a;border:1px solid #5b3faf;border-radius:20px;padding:18px}.verdict b{color:var(--yellow);display:block;margin-bottom:7px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:24px 0}.card p{color:var(--muted)}@media(max-width:820px){.hero,.grid{grid-template-columns:1fr}nav{display:block}.nav a{display:inline-block;margin:12px 12px 0 0}}</style></head><body><div class="wrap"><nav><div class="brand">HoldOff</div><div class="nav"><a href="/filter">Filter</a><a href="/pricing">Pricing</a></div></nav><main class="hero"><section><div class="badge">AI-powered pause before regret texting</div><h1>Don't send it <span>yet.</span></h1><p class="sub">HoldOff helps you catch the fear-text, double-text, apology spiral, and 2am message before it turns into regret.</p><p class="copy">Paste a message and get a simple gut-check: SEND, HOLD, or REWRITE. Built for anxious attachment, post-breakup spirals, and moments when your nervous system grabs the keyboard.</p><div class="cta"><a class="btn primary" href="/filter">Try the message filter</a><a class="btn secondary" href="/pricing">See pricing</a></div></section><section class="panel"><div class="bubble">I know you're busy but I feel stupid waiting for you to text back.</div><div class="verdict"><b>HOLD</b><p>This is an anxiety-text. Wait 20 minutes, then rewrite from clarity instead of panic.</p></div></section></main><section class="grid"><div class="card"><h3>Verdicts</h3><p>SEND, HOLD, or REWRITE — clear enough to use mid-spiral.</p></div><div class="card"><h3>Attachment-aware</h3><p>Built for anxious texting patterns without shaming you.</p></div><div class="card"><h3>Spiral Lock</h3><p>A stronger pause for high-risk moments in the full app.</p></div></section></div></body></html>`;

const checkoutPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HoldOff — Start your plan</title><style>body{margin:0;background:#0c0b10;color:#fff8f1;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}.box{background:#15131c;border:1px solid #2a2435;border-radius:24px;padding:40px;max-width:440px;text-align:center}.brand{font-weight:900;font-size:22px;letter-spacing:-.05em;margin-bottom:8px}h2{margin:0 0 8px;font-size:28px}p{color:#b9adc9;margin:0 0 28px}.price{font-size:38px;font-weight:900;color:#a78bfa;margin:0 0 6px}.period{color:#b9adc9;font-size:14px;margin:0 0 28px}.btn{display:block;width:100%;padding:16px;background:#a78bfa;color:#13091f;font-weight:900;font-size:17px;border:none;border-radius:14px;cursor:pointer;text-decoration:none}.loading{opacity:.6;pointer-events:none}</style></head><body><div class="box"><div class="brand">HoldOff</div><h2>Start your plan</h2><p>Pause before regret. Cancel anytime.</p><div class="price">$9</div><div class="period">per month</div><button class="btn" id="pay" onclick="startCheckout()">Subscribe — $9/mo</button></div><script>async function startCheckout(){const btn=document.getElementById('pay');const email=(localStorage.getItem('holdoff_checkout_email')||prompt('What email should HoldOff use to activate your subscription?')||'').trim().toLowerCase();if(!email){alert('Enter your email to continue to checkout.');return;}localStorage.setItem('holdoff_checkout_email',email);btn.textContent='Loading…';btn.classList.add('loading');try{const r=await fetch('/api/checkout/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tier:'pro',email})});const d=await r.json();if(d.url){window.location.href=d.url;}else{btn.textContent=d.error||'Something went wrong — try again';btn.classList.remove('loading');}}catch(e){btn.textContent='Error — please refresh';btn.classList.remove('loading');}}</script></body></html>`;

const pricingPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HoldOff Pricing</title><style>body{margin:0;background:#0c0b10;color:#fff8f1;font-family:Inter,system-ui,sans-serif}.wrap{max-width:860px;margin:0 auto;padding:34px}nav{margin-bottom:40px}a{color:#c4b5fd;text-decoration:none}.card{background:#15131c;border:2px solid #a78bfa;border-radius:24px;padding:32px;max-width:400px;margin:0 auto;text-align:center}.price{font-size:52px;font-weight:900;color:#a78bfa;margin:16px 0 4px}.period{color:#b9adc9;margin-bottom:24px}.features{list-style:none;padding:0;margin:0 0 28px;text-align:left}.features li{padding:8px 0;border-bottom:1px solid #2a2435;color:#e2d9f3}.features li:before{content:"✓ ";color:#a78bfa;font-weight:900}.btn{display:block;padding:16px;background:#a78bfa;color:#13091f;font-weight:900;font-size:17px;border-radius:14px;text-decoration:none}</style></head><body><div class="wrap"><nav><a href="/">← HoldOff</a></nav><h1>Simple pricing</h1><div class="card"><h2>Pro</h2><div class="price">$9</div><div class="period">per month · cancel anytime</div><ul class="features"><li>Unlimited message verdicts</li><li>Spiral Lock protection</li><li>Attachment style insights</li><li>Detox mode</li><li>Journal history</li></ul><a href="/checkout" class="btn">Get started — $9/mo</a></div></div></body></html>`;

const filterPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HoldOff Message Filter</title><style>body{margin:0;background:#0c0b10;color:#fff8f1;font-family:Inter,system-ui,sans-serif}.wrap{max-width:760px;margin:0 auto;padding:34px}nav{margin-bottom:32px}a{color:#c4b5fd;text-decoration:none}textarea{width:100%;background:#15131c;border:1px solid #2a2435;border-radius:16px;color:#fff8f1;padding:18px;font-size:16px;font-family:inherit;resize:vertical;min-height:120px;margin:16px 0}.btn{background:#a78bfa;color:#13091f;font-weight:900;border:none;border-radius:12px;padding:14px 28px;font-size:16px;cursor:pointer}.result{margin-top:24px;background:#15131c;border:1px solid #2a2435;border-radius:20px;padding:24px;display:none}.verdict-label{font-size:28px;font-weight:900;margin-bottom:12px}.HOLD{color:#fde68a}.SEND{color:#86efac}.REWRITE{color:#f9a8d4}.explanation{color:#b9adc9;line-height:1.6}.upgrade{margin-top:20px;padding:16px;background:#21163a;border:1px solid #5b3faf;border-radius:14px;text-align:center}</style></head><body><div class="wrap"><nav><a href="/">← HoldOff</a></nav><h1>Message Filter</h1><p style="color:#b9adc9">Paste your message. Get a verdict.</p><textarea id="msg" placeholder="I know you said you needed space but I just wanted to check in…"></textarea><button class="btn" onclick="check()">Get verdict</button><div class="result" id="result"><div class="verdict-label" id="vl"></div><div class="explanation" id="ex"></div><div class="upgrade"><strong>Want unlimited verdicts + Spiral Lock?</strong><br><a href="/pricing" style="color:#a78bfa;font-weight:800">See plans →</a></div></div></div><script>
const rules=[
  {p:/\b(i know you said|i just wanted to check|i get that you're busy|not trying to bother|i'll leave you alone|sorry for texting|sorry to bother)\b/i,v:'HOLD',e:'This reads as an apology for existing. Hold for 30 min — your feelings are valid but this version comes from anxiety.'},
  {p:/\b(why (haven\'t|haven't|didn't|did you|are you)|did i do something|are you mad|do you hate|you always|you never)\b/i,v:'HOLD',e:'Accusatory or fear-based framing. This will start a fight, not a conversation. Rewrite from curiosity.'},
  {p:/(.)\\1{3,}|!{2,}|[?]{2,}/,v:'HOLD',e:'The punctuation shows intensity. Let the message breathe — you can say the same thing with less urgency.'},
  {p:/^.{1,12}$/,v:'SEND',e:'Short, low-stakes. Looks fine to send.'},
];
async function check(){
  const msg=document.getElementById('msg').value.trim();
  if(!msg)return;
  const res=document.getElementById('result');
  const vl=document.getElementById('vl');
  const ex=document.getElementById('ex');
  let verdict='SEND', explanation='This message looks grounded and clear. Go ahead.';
  for(const r of rules){if(r.p.test(msg)){verdict=r.v;explanation=r.e;break;}}
  if(verdict==='SEND'&&msg.length>280){verdict='REWRITE';explanation='This is long. Long messages in emotional contexts often overwhelm. Try cutting it in half.';}
  vl.textContent=verdict;
  vl.className='verdict-label '+verdict;
  ex.textContent=explanation;
  res.style.display='block';
}
</script></body></html>`;

// ── Request handler ────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname.replace(/\/$/, '') || '/';

  // Health
  if (path === '/health') return send(res, 200, 'OK', 'text/plain');
  if (path === '/api/spiral-lock/status') {
    return sendJSON(res, 200, {
      enabled: true,
      mode: 'recovery_static',
      trigger: '5 rapid send/draft attempts within 10 minutes',
      release: 'pause, breathe, then journal before sending',
      updated_at: new Date().toISOString()
    });
  }

  // Stripe checkout session creation — must run before /checkout page rendering.
  // /checkout POST is kept as a no-JS fallback so paid traffic can always reach Stripe.
  if ((path === '/api/checkout/start' || path === '/checkout') && req.method === 'POST') {
    try {
      const body = await readRequestBody(req);
      const customerEmail = String(body.email || body.customer_email || '').trim().toLowerCase();
      const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail);
      if (!emailLooksValid) {
        return sendJSON(res, 400, { error: 'Enter your email before checkout so we can activate HoldOff after payment.', code: 'EMAIL_REQUIRED' });
      }
      const session = await stripePost('/v1/checkout/sessions', {
        'payment_method_types[]': 'card',
        'mode': 'subscription',
        'line_items[0][price]': PRICE_ID,
        'line_items[0][quantity]': '1',
        'success_url': `${BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        'cancel_url': `${BASE_URL}/pricing`,
        'allow_promotion_codes': 'true',
        'customer_email': customerEmail,
        'client_reference_id': customerEmail
      });
      if (session.url) {
        if (path === '/checkout') {
          res.writeHead(303, { Location: session.url });
          return res.end();
        }
        return sendJSON(res, 200, { url: session.url });
      } else {
        console.error('[checkout] No session URL:', session);
        return sendJSON(res, 500, { error: 'Failed to create session' });
      }
    } catch (err) {
      console.error('[checkout] Stripe error:', err.message);
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // Pages
  if (path === '/' || path === '') return send(res, 200, home);
  if (path === '/filter') return send(res, 200, filterPage);
  if (path === '/pricing') return send(res, 200, pricingPage);
  if (path === '/checkout') return send(res, 200, checkoutPage);

  // Checkout success
  if (path === '/checkout/success') {
    return send(res, 200, `<!doctype html><html><head><meta charset="utf-8"><title>Welcome to HoldOff</title><style>body{margin:0;background:#0c0b10;color:#fff8f1;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}.box{max-width:480px;padding:40px}.brand{font-weight:900;font-size:24px;color:#a78bfa;margin-bottom:20px}h1{font-size:42px;margin:0 0 16px}p{color:#b9adc9;font-size:18px;margin:0 0 28px}a{display:inline-block;background:#a78bfa;color:#13091f;font-weight:900;padding:14px 28px;border-radius:12px;text-decoration:none}</style></head><body><div class="box"><div class="brand">HoldOff</div><h1>You're in. 🎉</h1><p>Your subscription is active. Time to break the spiral.</p><a href="/filter">Start using HoldOff →</a></div></body></html>`);
  }

  // Stripe webhook
  if (path === '/stripe-webhook' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      console.log('[webhook] received event, body length:', body.length);
      // Acknowledge Stripe immediately
      sendJSON(res, 200, { received: true });
    });
    return;
  }

  // 404
  send(res, 404, `<html><body style="background:#0c0b10;color:#fff8f1;font-family:sans-serif;padding:40px;text-align:center"><h2>Page not found</h2><a href="/" style="color:#a78bfa">← Back to HoldOff</a></body></html>`);
});

server.listen(PORT, () => {
  console.log(`[HoldOff] Live on port ${PORT} — payments enabled`);
});
