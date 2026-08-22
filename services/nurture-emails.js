/**
 * Nurture email templates for the auto_intercept waitlist sequence.
 * Owns: HTML/text content and subjects for emails 1–3.
 * Does NOT own: sending logic, queue management, scheduling.
 */

const BASE_URL = 'https://shouldiholdoff.live';

function unsubLink(email) {
  return `${BASE_URL}/api/waitlist/unsubscribe?email=${encodeURIComponent(email)}`;
}

function utmLink(path, content) {
  return `${BASE_URL}${path}?utm_source=email&utm_campaign=auto_intercept_nurture&utm_content=${content}`;
}

const FOOTER_STYLE = 'font-size: 0.78rem; color: #8A7F79; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #E5DED4;';
const BODY_STYLE   = 'font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #2A2522; line-height: 1.75; padding: 0 1rem;';
const ACCENT       = '#C97B5D';

/**
 * Email 1 — immediate on signup.
 * Subject: "You're on the list for auto-intercept."
 */
function email1({ email }) {
  const subject = "You're on the list for auto-intercept.";

  const html = `
<div style="${BODY_STYLE}">
  <h2 style="font-size: 1.4rem; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 1.25rem;">You're in.</h2>

  <p style="margin-bottom: 1rem;">Auto-intercept isn't live yet. When it ships, you'll get one email — the day it goes live.</p>

  <p style="margin-bottom: 1rem;">Here's what it actually does: HoldOff watches your draft in the message field using Android's Accessibility Service. No copy-paste, no leaving the app. You type, you pause, the verdict slides up — HOLD, SEND, or REWRITE — before your thumb hits send.</p>

  <p style="margin-bottom: 1rem;">Next update in 3 days: how it actually reads the text before you send it.</p>

  <p style="margin-bottom: 1.5rem;">Until then — <a href="${utmLink('/filter', 'email_1_cta')}" style="color: ${ACCENT};">try HoldOff on the web</a>. Same verdicts, no install required.</p>

  <p style="font-style: italic; color: ${ACCENT}; margin-bottom: 0;">Don't send it yet. — HoldOff</p>

  <div style="${FOOTER_STYLE}">
    You're receiving this because you joined the HoldOff auto-intercept waitlist.
    <a href="${unsubLink(email)}" style="color: #8A7F79;">Unsubscribe</a>.
  </div>
</div>`.trim();

  const text = `You're in.

Auto-intercept isn't live yet. When it ships, you'll get one email — the day it goes live.

Here's what it actually does: HoldOff watches your draft in the message field using Android's Accessibility Service. No copy-paste, no leaving the app. You type, you pause, the verdict slides up — HOLD, SEND, or REWRITE — before your thumb hits send.

Next update in 3 days: how it actually reads the text before you send it.

Until then — try HoldOff on the web: ${utmLink('/filter', 'email_1_cta')}

Don't send it yet. — HoldOff

---
You're receiving this because you joined the HoldOff auto-intercept waitlist.
Unsubscribe: ${unsubLink(email)}`;

  return { subject, html, text };
}

/**
 * Email 2 — 72hr after signup.
 * Subject: "How HoldOff actually reads the text before you send it."
 */
function email2({ email }) {
  const subject = 'How HoldOff actually reads the text before you send it.';

  const html = `
<div style="${BODY_STYLE}">
  <h2 style="font-size: 1.4rem; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 1.25rem;">Here's the mechanic.</h2>

  <p style="margin-bottom: 1rem;">Android's Accessibility Service lets apps observe what you type in other apps — it's the same API screen readers use. HoldOff registers a listener on the message field. Once you stop typing for 800ms, it sends the draft to the AI. The verdict overlays the screen before you can lift your thumb to the send button.</p>

  <p style="margin-bottom: 1rem;"><strong>HOLD</strong> means don't send. <strong>REWRITE</strong> means here's a version that says what you mean without the desperation. <strong>SEND</strong> means it's fine.</p>

  <p style="margin-bottom: 1rem;">No screenshots, no clipboard, no switching apps. The text never leaves the message field until you decide what to do with it.</p>

  <p style="margin-bottom: 1rem;">Want to see what the verdicts look like? <a href="${utmLink('/examples', 'email_2_examples')}" style="color: ${ACCENT};">Browse the examples gallery →</a></p>

  <!-- Demo animation from landing page -->
  <div style="margin: 1.5rem 0; text-align: center;">
    <a href="${utmLink('/download', 'email_2_demo_link')}">
      <img src="${BASE_URL}/demos/intercept-demo.svg"
           alt="HoldOff auto-intercept demo"
           style="max-width: 100%; border-radius: 8px; border: 1px solid #E5DED4;" />
    </a>
  </div>

  <p style="margin-bottom: 1rem;">Want it sooner? The current APK is at <a href="${utmLink('/download', 'email_2_sideload')}" style="color: ${ACCENT};">/download</a> — the auto-intercept toggle is live in beta. Sideload it, enable the Accessibility Service in Android settings, and you're running.</p>

  <p style="font-style: italic; color: ${ACCENT}; margin-bottom: 0;">Don't send it yet. — HoldOff</p>

  <div style="${FOOTER_STYLE}">
    You're receiving this because you joined the HoldOff auto-intercept waitlist.
    <a href="${unsubLink(email)}" style="color: #8A7F79;">Unsubscribe</a>.
  </div>
</div>`.trim();

  const text = `Here's the mechanic.

Android's Accessibility Service lets apps observe what you type in other apps — it's the same API screen readers use. HoldOff registers a listener on the message field. Once you stop typing for 800ms, it sends the draft to the AI. The verdict overlays the screen before you can lift your thumb to the send button.

HOLD means don't send. REWRITE means here's a version that says what you mean without the desperation. SEND means it's fine.

No screenshots, no clipboard, no switching apps. The text never leaves the message field until you decide what to do with it.

Browse the examples gallery: ${utmLink('/examples', 'email_2_examples')}

Want it sooner? The current APK is at /download — the auto-intercept toggle is live in beta.
Download: ${utmLink('/download', 'email_2_sideload')}

Don't send it yet. — HoldOff

---
You're receiving this because you joined the HoldOff auto-intercept waitlist.
Unsubscribe: ${unsubLink(email)}`;

  return { subject, html, text };
}

/**
 * Email 3 — manual trigger on APK release.
 * Subject: "Auto-intercept is shipping. APK + setup in 90 seconds."
 */
function email3({ email }) {
  const subject = 'Auto-intercept is shipping. APK + setup in 90 seconds.';

  const html = `
<div style="${BODY_STYLE}">
  <h2 style="font-size: 1.4rem; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 1.25rem;">It's live.</h2>

  <p style="margin-bottom: 1rem;">Auto-intercept is out. Here's how to install it in 90 seconds:</p>

  <ol style="margin-bottom: 1.25rem; padding-left: 1.5rem; line-height: 2;">
    <li><a href="${utmLink('/download', 'email_3_apk')}" style="color: ${ACCENT};">Download the APK</a> and install it on your Android device.</li>
    <li>Open Android <strong>Settings → Accessibility → Installed apps → HoldOff</strong> and enable the service.</li>
    <li>Open any messaging app. Start typing. HoldOff intercepts before you send.</li>
  </ol>

  <p style="margin-bottom: 1rem;">What to expect the first time: a setup card walks you through the Accessibility Service prompt. Takes 20 seconds. After that it's invisible until you need it.</p>

  <p style="margin-bottom: 1rem;">Running into something? <a href="${utmLink('/download', 'email_3_feedback')}" style="color: ${ACCENT};">Known issues and feedback →</a></p>

  <p style="font-style: italic; color: ${ACCENT}; margin-bottom: 0;">Don't send it yet. — HoldOff</p>

  <div style="${FOOTER_STYLE}">
    You're receiving this because you joined the HoldOff auto-intercept waitlist.
    <a href="${unsubLink(email)}" style="color: #8A7F79;">Unsubscribe</a>.
  </div>
</div>`.trim();

  const text = `It's live.

Auto-intercept is out. Here's how to install it in 90 seconds:

1. Download the APK and install it: ${utmLink('/download', 'email_3_apk')}
2. Open Android Settings → Accessibility → Installed apps → HoldOff and enable the service.
3. Open any messaging app. Start typing. HoldOff intercepts before you send.

What to expect the first time: a setup card walks you through the Accessibility Service prompt. Takes 20 seconds. After that it's invisible until you need it.

Running into something? ${utmLink('/download', 'email_3_feedback')}

Don't send it yet. — HoldOff

---
You're receiving this because you joined the HoldOff auto-intercept waitlist.
Unsubscribe: ${unsubLink(email)}`;

  return { subject, html, text };
}

module.exports = { email1, email2, email3 };
