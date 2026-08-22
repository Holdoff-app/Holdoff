// Outreach email log - sent via company_email MCP (send_company_email tool)
// Tracking sent emails with message IDs

const emails = [
  {
    to: 'thais@personaldevelopmentschool.com',
    subject: 'Built something for the 11 PM text problem',
    body: `You named the moment HoldOff was built for — protest behaviors, reaching out from activation. Your audience knows exactly what they're doing wrong at 11 PM and do it anyway. That's not a knowledge problem. That's a friction problem.

HoldOff intercepts the text in the message field before you send it. Android auto-intercept just shipped. No copy-paste. Just a verdict overlay.

Free Pro for you + a comp link for your community to try. No affiliate ask on first touch.

→ https://shouldiholdoff.live

Stacy Martin
Founder, HoldOff`,
    sent: false,
    messageId: null
  },
  {
    to: 'julie@thesecurerelationship.com',
    subject: 'For the couples who keep texting through the rupture',
    body: `Your pursuer-softening work is the closest thing to what HoldOff does — but in the moment, not in reflection. The 3-second window between impulse and send is where the rupture happens. HoldOff lives in that window.

Android auto-intercept just shipped. Reads the draft as you type, in any app. No copy-paste. Just a verdict overlay before you hit send.

Free Pro for you + comp links for your community.

→ https://shouldiholdoff.live/download

Stacy`,
    sent: false,
    messageId: null
  }
];

module.exports = emails;