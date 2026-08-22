/**
 * Detox email templates — 5-day Anxious Texting Detox email course.
 * Owns: HTML/text content and subjects for Day 0–Day 4 drip emails.
 * Does NOT own: sending logic, subscriber management, scheduling.
 */

const crypto = require('crypto');
const BASE_URL = 'https://shouldiholdoff.live';

/** Stable referral token derived from email — same algorithm as routes/referral.js dashboard. */
function referralToken(email) {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 12);
}

function unsubLink(email) {
  return `${BASE_URL}/api/detox/unsubscribe?email=${encodeURIComponent(email)}`;
}

function utmLink(path, day) {
  return `${BASE_URL}${path}?utm_source=detox&utm_medium=email&utm_campaign=day${day}`;
}

const BODY_STYLE   = 'font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #2A2522; line-height: 1.75; padding: 0 1rem;';
const FOOTER_STYLE = 'font-size: 0.78rem; color: #8A7F79; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #E5DED4;';
const ACCENT       = '#C97B5D';
const QUOTE_STYLE  = `font-style: italic; background: #F2EDE5; border-left: 3px solid ${ACCENT}; padding: 0.75rem 1rem; margin: 1.25rem 0; color: #4A3F3A;`;

function footer(email, day) {
  return `<div style="${FOOTER_STYLE}">
    Day ${day} of 5 — Anxious Texting Detox by HoldOff.
    <a href="${unsubLink(email)}" style="color: #8A7F79;">Unsubscribe</a>.
  </div>`;
}

function footerText(email, day) {
  return `---\nDay ${day} of 5 — Anxious Texting Detox by HoldOff.\nUnsubscribe: ${unsubLink(email)}`;
}

/**
 * Day 0 — Pattern: Double-texting
 */
function day0({ email }) {
  const subject = 'Day 0: Why you double text (and what it actually costs you)';
  const filterUrl = utmLink('/filter?example=double-texting', 0);

  const html = `<div style="${BODY_STYLE}">
  <p style="font-size: 0.8rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: ${ACCENT}; margin-bottom: 0.5rem;">Day 0 of 5 — Anxious Texting Detox</p>
  <h2 style="font-size: 1.4rem; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 1.25rem;">The double text.</h2>

  <p style="margin-bottom: 1rem;">You sent the text. He didn't reply. Forty minutes pass. You send another one.</p>

  <blockquote style="${QUOTE_STYLE}">"Hey just wanted to make sure you got this 😅"</blockquote>

  <p style="margin-bottom: 1rem;"><strong>What's actually happening:</strong> Your attachment system read the silence as threat. Not inconvenience — threat. The double text is a protest behavior: a way of saying "I need proof you're still here" without being able to say that out loud.</p>

  <p style="margin-bottom: 1rem;">It's not a character flaw. It's a wiring pattern. Anxious attachment learns early that presence has to be earned with escalation. The nervous system is doing exactly what it was trained to do.</p>

  <p style="margin-bottom: 1rem;"><strong>The grounded version:</strong> He got the first text. The read receipt is irrelevant. The double text doesn't close the loop — it opens a new one, now with a desperate question mark hanging over it.</p>

  <p style="margin-bottom: 1.5rem;">One message, sent once, is the complete thing. The waiting is where you find out what's actually there.</p>

  <p style="margin-bottom: 1.25rem;">→ <a href="${filterUrl}" style="color: ${ACCENT}; font-weight: 600;">Paste your version into HoldOff →</a></p>

  <p style="font-style: italic; color: ${ACCENT}; margin-bottom: 0;">Don't send it yet. — HoldOff</p>

  ${footer(email, 0)}
</div>`;

  const text = `Day 0 of 5 — Anxious Texting Detox

The double text.

You sent the text. He didn't reply. Forty minutes pass. You send another one.

"Hey just wanted to make sure you got this 😅"

What's actually happening: Your attachment system read the silence as threat. Not inconvenience — threat. The double text is a protest behavior: a way of saying "I need proof you're still here" without being able to say that out loud.

It's not a character flaw. It's a wiring pattern. Anxious attachment learns early that presence has to be earned with escalation. The nervous system is doing exactly what it was trained to do.

The grounded version: He got the first text. The read receipt is irrelevant. The double text doesn't close the loop — it opens a new one, now with a desperate question mark hanging over it.

One message, sent once, is the complete thing. The waiting is where you find out what's actually there.

Paste your version into HoldOff: ${filterUrl}

Don't send it yet. — HoldOff

${footerText(email, 0)}`;

  return { subject, html, text };
}

/**
 * Day 1 — Pattern: The 11 PM spiral
 */
function day1({ email }) {
  const subject = 'Day 1: The 11 PM spiral — why it always happens at night';
  const filterUrl = utmLink('/filter?example=late-night-spiral', 1);

  const html = `<div style="${BODY_STYLE}">
  <p style="font-size: 0.8rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: ${ACCENT}; margin-bottom: 0.5rem;">Day 1 of 5 — Anxious Texting Detox</p>
  <h2 style="font-size: 1.4rem; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 1.25rem;">The 11 PM spiral.</h2>

  <p style="margin-bottom: 1rem;">It's late. The day's distraction has worn off. A small thing happens — he didn't text back, he left you on read three hours ago, there's a detail from your last conversation you're suddenly certain meant something bad. And now you're in it.</p>

  <blockquote style="${QUOTE_STYLE}">"I know it's late but I just needed to say something because I've been thinking about this all day and I don't want to go to bed feeling like this…"</blockquote>

  <p style="margin-bottom: 1rem;"><strong>What's actually happening:</strong> The prefrontal cortex — the part that does risk assessment and impulse braking — runs on glucose and rest. At 11 PM, after a full day, it's depleted. Your attachment system is running unchecked. Every ambiguous signal is being interpreted as abandonment because there's nothing left to push back against it.</p>

  <p style="margin-bottom: 1rem;">The feeling is real. The urgency is manufactured.</p>

  <p style="margin-bottom: 1rem;"><strong>The grounded version:</strong> This text will say exactly what exhaustion and anxiety wrote together. You will read it tomorrow and cringe. Not because the feeling wasn't real — it was — but because this wasn't the moment to send it.</p>

  <p style="margin-bottom: 1.5rem;">The rule: nothing after 10 PM gets sent before 9 AM. If it still needs to be said in the morning, it's real.</p>

  <p style="margin-bottom: 1.25rem;">→ <a href="${filterUrl}" style="color: ${ACCENT}; font-weight: 600;">Paste your version into HoldOff →</a></p>

  <p style="font-style: italic; color: ${ACCENT}; margin-bottom: 0;">Don't send it yet. — HoldOff</p>

  ${footer(email, 1)}
</div>`;

  const text = `Day 1 of 5 — Anxious Texting Detox

The 11 PM spiral.

It's late. The day's distraction has worn off. A small thing happens — he didn't text back, he left you on read three hours ago, there's a detail from your last conversation you're suddenly certain meant something bad. And now you're in it.

"I know it's late but I just needed to say something because I've been thinking about this all day and I don't want to go to bed feeling like this…"

What's actually happening: The prefrontal cortex — the part that does risk assessment and impulse braking — runs on glucose and rest. At 11 PM, after a full day, it's depleted. Your attachment system is running unchecked. Every ambiguous signal is being interpreted as abandonment because there's nothing left to push back against it.

The feeling is real. The urgency is manufactured.

The grounded version: This text will say exactly what exhaustion and anxiety wrote together. You will read it tomorrow and cringe. Not because the feeling wasn't real — it was — but because this wasn't the moment to send it.

The rule: nothing after 10 PM gets sent before 9 AM. If it still needs to be said in the morning, it's real.

Paste your version into HoldOff: ${filterUrl}

Don't send it yet. — HoldOff

${footerText(email, 1)}`;

  return { subject, html, text };
}

/**
 * Day 2 — Pattern: "Are you mad at me?" probe
 */
function day2({ email }) {
  const subject = 'Day 2: "Are you mad at me?" — the anxiety probe';
  const filterUrl = utmLink('/filter?example=are-you-mad', 2);

  const html = `<div style="${BODY_STYLE}">
  <p style="font-size: 0.8rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: ${ACCENT}; margin-bottom: 0.5rem;">Day 2 of 5 — Anxious Texting Detox</p>
  <h2 style="font-size: 1.4rem; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 1.25rem;">The "are you mad at me?" probe.</h2>

  <p style="margin-bottom: 1rem;">Something felt off in his last few texts. Shorter than usual. Less warmth. Could be nothing — he might just be busy. But anxiety doesn't do "could be nothing." It runs scenarios until it finds the worst-case one and then asks you to disprove it.</p>

  <blockquote style="${QUOTE_STYLE}">"Hey, are you okay? You seem kind of distant. Did I do something?"</blockquote>

  <p style="margin-bottom: 1rem;"><strong>What's actually happening:</strong> This is an anxiety-reduction move disguised as concern. You're not actually asking how he is — you're asking for reassurance that you haven't been abandoned. The question hands your emotional state over to him: his answer will determine whether you feel okay for the next few hours.</p>

  <p style="margin-bottom: 1rem;">Anxious attachment does this because it was built in environments where other people's moods were the primary threat signal. Reading the room was survival. You got very good at it. The problem is you're still doing threat-detection in a relationship, where his short text is probably just a short text.</p>

  <p style="margin-bottom: 1rem;"><strong>The grounded version:</strong> "He seems quiet" is data. It doesn't require a probe. If something is actually wrong, it will surface. If it doesn't surface, it probably wasn't what you thought it was.</p>

  <p style="margin-bottom: 1.5rem;">Let the silence be silence. You don't need to resolve it tonight.</p>

  <p style="margin-bottom: 1.25rem;">→ <a href="${filterUrl}" style="color: ${ACCENT}; font-weight: 600;">Paste your version into HoldOff →</a></p>

  <p style="font-style: italic; color: ${ACCENT}; margin-bottom: 0;">Don't send it yet. — HoldOff</p>

  ${footer(email, 2)}
</div>`;

  const text = `Day 2 of 5 — Anxious Texting Detox

The "are you mad at me?" probe.

Something felt off in his last few texts. Shorter than usual. Less warmth. Could be nothing — he might just be busy. But anxiety doesn't do "could be nothing." It runs scenarios until it finds the worst-case one and then asks you to disprove it.

"Hey, are you okay? You seem kind of distant. Did I do something?"

What's actually happening: This is an anxiety-reduction move disguised as concern. You're not actually asking how he is — you're asking for reassurance that you haven't been abandoned. The question hands your emotional state over to him: his answer will determine whether you feel okay for the next few hours.

Anxious attachment does this because it was built in environments where other people's moods were the primary threat signal. Reading the room was survival. You got very good at it. The problem is you're still doing threat-detection in a relationship, where his short text is probably just a short text.

The grounded version: "He seems quiet" is data. It doesn't require a probe. If something is actually wrong, it will surface. If it doesn't surface, it probably wasn't what you thought it was.

Let the silence be silence. You don't need to resolve it tonight.

Paste your version into HoldOff: ${filterUrl}

Don't send it yet. — HoldOff

${footerText(email, 2)}`;

  return { subject, html, text };
}

/**
 * Day 3 — Pattern: The reassurance bid
 */
function day3({ email }) {
  const subject = 'Day 3: The reassurance bid — asking the question you already know the answer to';
  const filterUrl = utmLink('/filter?example=reassurance-bid', 3);

  const html = `<div style="${BODY_STYLE}">
  <p style="font-size: 0.8rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: ${ACCENT}; margin-bottom: 0.5rem;">Day 3 of 5 — Anxious Texting Detox</p>
  <h2 style="font-size: 1.4rem; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 1.25rem;">The reassurance bid.</h2>

  <p style="margin-bottom: 1rem;">You know he likes you. The evidence is there. But you ask anyway.</p>

  <blockquote style="${QUOTE_STYLE}">"Do you actually want to hang out, or are you just being nice? I can't tell sometimes."</blockquote>

  <p style="margin-bottom: 1rem;"><strong>What's actually happening:</strong> Reassurance bids feel like seeking clarity. They're not. Clarity is something you build from behavior over time. Reassurance bids are requests for verbal confirmation that will satisfy the anxious system for a few hours, maybe a few days, and then need to be renewed.</p>

  <p style="margin-bottom: 1rem;">It's like drinking saltwater for thirst. The mechanism of the bid actually trains the anxious system to need more reassurance, more often. Each "yes, I like you" feels good in the moment and slightly less satisfying the next time you need to hear it.</p>

  <p style="margin-bottom: 1rem;"><strong>The grounded version:</strong> You have data. He shows up when he says he will. He texts back. He made plans. The anxious system wants verbal proof on top of behavioral proof because verbal proof is faster — but it's also cheaper, and your nervous system knows it.</p>

  <p style="margin-bottom: 1.5rem;">Trust what he does, not what you can get him to say.</p>

  <p style="margin-bottom: 1.25rem;">→ <a href="${filterUrl}" style="color: ${ACCENT}; font-weight: 600;">Paste your version into HoldOff →</a></p>

  <p style="font-style: italic; color: ${ACCENT}; margin-bottom: 0;">Don't send it yet. — HoldOff</p>

  ${footer(email, 3)}
</div>`;

  const text = `Day 3 of 5 — Anxious Texting Detox

The reassurance bid.

You know he likes you. The evidence is there. But you ask anyway.

"Do you actually want to hang out, or are you just being nice? I can't tell sometimes."

What's actually happening: Reassurance bids feel like seeking clarity. They're not. Clarity is something you build from behavior over time. Reassurance bids are requests for verbal confirmation that will satisfy the anxious system for a few hours, maybe a few days, and then need to be renewed.

It's like drinking saltwater for thirst. The mechanism of the bid actually trains the anxious system to need more reassurance, more often. Each "yes, I like you" feels good in the moment and slightly less satisfying the next time you need to hear it.

The grounded version: You have data. He shows up when he says he will. He texts back. He made plans. The anxious system wants verbal proof on top of behavioral proof because verbal proof is faster — but it's also cheaper, and your nervous system knows it.

Trust what he does, not what you can get him to say.

Paste your version into HoldOff: ${filterUrl}

Don't send it yet. — HoldOff

${footerText(email, 3)}`;

  return { subject, html, text };
}

/**
 * Day 4 — Pattern: The apology loop. Final email; includes referral CTA.
 */
function day4({ email }) {
  const subject = 'Day 4: The apology loop — and how to actually break it';
  const filterUrl = utmLink('/filter?example=apology-loop', 4);
  const proUrl = `${BASE_URL}/filter?utm_source=detox&utm_medium=email&utm_campaign=day4_pro`;
  const refCode = referralToken(email);
  const referralUrl = `${BASE_URL}/referrals?ref=${refCode}&source=detox_day5`;

  const html = `<div style="${BODY_STYLE}">
  <p style="font-size: 0.8rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: ${ACCENT}; margin-bottom: 0.5rem;">Day 4 of 5 — Anxious Texting Detox</p>
  <h2 style="font-size: 1.4rem; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 1.25rem;">The apology loop.</h2>

  <p style="margin-bottom: 1rem;">Something happened — a misread tone, a cancelled plan, a silence that felt like punishment. You apologized. He said it was fine. You apologized again, different angle, same underlying question.</p>

  <blockquote style="${QUOTE_STYLE}">"I'm sorry for being weird about it. I know I'm probably overthinking this. I just don't want you to think I'm like this all the time."</blockquote>

  <p style="margin-bottom: 1rem;"><strong>What's actually happening:</strong> The apology loop is a preemptive rejection. You're apologizing for yourself — for your attachment style, your anxiety, your need — before he has a chance to reject you for it. The logic is: if I say it first and hate it first, his rejection can't hurt me as much.</p>

  <p style="margin-bottom: 1rem;">It doesn't work. What it does instead: it keeps the wound open. Each additional apology re-activates the shame, and the person on the other end starts to feel the weight of managing your self-image for you.</p>

  <p style="margin-bottom: 1rem;"><strong>The grounded version:</strong> One apology, for the specific thing, sent once. Then let it land. What comes back tells you what you need to know. The loop doesn't protect you — it exhausts both of you.</p>

  <p style="margin-bottom: 1.5rem;">You made it to Day 4. You've named five patterns you'll recognize before you send. That's the whole thing.</p>

  <p style="margin-bottom: 1.25rem;">→ <a href="${filterUrl}" style="color: ${ACCENT}; font-weight: 600;">Paste your version into HoldOff →</a></p>

  <hr style="border: none; border-top: 1px solid #E5DED4; margin: 1.5rem 0;" />

  <p style="margin-bottom: 0.75rem; font-weight: 600;">Want to keep going?</p>
  <p style="margin-bottom: 1rem;">HoldOff Pro is $9/mo — unlimited intercepts, streak tracking, pattern history. The same thing you just did over 5 days, on demand, for every text.</p>
  <p style="margin-bottom: 0.5rem;"><a href="${proUrl}" style="color: ${ACCENT}; font-weight: 600;">Open HoldOff and upgrade →</a></p>

  <hr style="border: none; border-top: 1px solid #E5DED4; margin: 1.5rem 0;" />

  <p style="margin-bottom: 0.5rem; font-weight: 600;">Know someone whose 11 PM texts run their life?</p>
  <p style="margin-bottom: 1rem;">Send them HoldOff. 5 referrals = 30 free verdicts. 10 = a 30-day Pro trial.</p>
  <a href="${referralUrl}" style="display: inline-block; padding: 12px 24px; background: ${ACCENT}; color: #FAF6F0; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: 'DM Sans', Arial, sans-serif; font-size: 0.95rem;">Share my link →</a>

  <p style="font-style: italic; color: ${ACCENT}; margin-top: 1.5rem; margin-bottom: 0;">Don't send it yet. — HoldOff</p>

  ${footer(email, 4)}
</div>`;

  const text = `Day 4 of 5 — Anxious Texting Detox

The apology loop.

Something happened — a misread tone, a cancelled plan, a silence that felt like punishment. You apologized. He said it was fine. You apologized again, different angle, same underlying question.

"I'm sorry for being weird about it. I know I'm probably overthinking this. I just don't want you to think I'm like this all the time."

What's actually happening: The apology loop is a preemptive rejection. You're apologizing for yourself — for your attachment style, your anxiety, your need — before he has a chance to reject you for it. The logic is: if I say it first and hate it first, his rejection can't hurt me as much.

It doesn't work. What it does instead: it keeps the wound open. Each additional apology re-activates the shame, and the person on the other end starts to feel the weight of managing your self-image for you.

The grounded version: One apology, for the specific thing, sent once. Then let it land. What comes back tells you what you need to know. The loop doesn't protect you — it exhausts both of you.

You made it to Day 4. You've named five patterns you'll recognize before you send. That's the whole thing.

Paste your version into HoldOff: ${filterUrl}

---

Want to keep going?
HoldOff Pro is $9/mo — unlimited intercepts, streak tracking, pattern history.
Open HoldOff and upgrade: ${proUrl}

---

Know someone whose 11 PM texts run their life?
Send them HoldOff. 5 referrals = 30 free verdicts. 10 = a 30-day Pro trial.

Share my link: ${referralUrl}

Don't send it yet. — HoldOff

${footerText(email, 4)}`;

  return { subject, html, text };
}

const DAYS = [day0, day1, day2, day3, day4];

/**
 * Get the email template function for a given step (0-4).
 */
function getDetoxEmail(step) {
  if (step < 0 || step >= DAYS.length) throw new Error(`Invalid detox step: ${step}`);
  return DAYS[step];
}

module.exports = { day0, day1, day2, day3, day4, getDetoxEmail };
