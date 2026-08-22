/**
 * Referral email templates.
 * Owns: building and sending peer referral + reward notification emails via Resend.
 * Does NOT own: DB writes, token generation, rate-limiting.
 */
const { sendEmail } = require('./email');

const APP_URL = process.env.APP_URL || 'https://shouldiholdoff.live';

/**
 * Send a referral email from one user to a friend.
 * @param {Object} opts
 * @param {string} opts.senderName    — first name or "a friend" if anonymous
 * @param {string} opts.recipientEmail
 * @param {string} opts.note          — optional 1-line personal note
 * @param {string} opts.utmToken      — ref= token for attribution
 * @param {number} opts.streakCount   — sender's HOLD/REWRITE streak count (0 if unknown)
 */
async function sendReferralEmail({ senderName, recipientEmail, note, utmToken, streakCount }) {
  const refUrl = `${APP_URL}/filter?utm_source=referral&utm_medium=email&utm_campaign=friend&ref=${utmToken}`;
  const displayName = senderName || 'a friend';
  const streakLine = streakCount > 0
    ? `They're on a ${streakCount}-text streak of not sending.`
    : 'They just held off on a text.';

  const defaultNote = "This pasted my last 4 texts back at me and made me put my phone down. Try it.";
  const userNote = note && note.trim() ? note.trim() : defaultNote;

  const subject = 'saw this and thought of you';

  const text = `${displayName} sent you this.

"${userNote}"

${streakLine}

HoldOff is an AI that reads the message you're about to send and tells you whether to send it, hold it, or rewrite it. No judgment. Just a clear read.

Try it: ${refUrl}

---
Reply STOP and we won't email you again about HoldOff.`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin: 0; padding: 0; background: #FAF6F0; font-family: 'Georgia', serif; color: #2A2522; }
  .wrap { max-width: 520px; margin: 0 auto; padding: 40px 24px; }
  .sender { font-size: 14px; color: #9A8F8A; margin-bottom: 24px; }
  .note { font-size: 17px; line-height: 1.6; color: #2A2522; border-left: 3px solid #C97B5D; padding-left: 16px; margin: 0 0 28px; font-style: italic; }
  .streak { font-size: 14px; color: #9A8F8A; margin-bottom: 28px; }
  .desc { font-size: 15px; line-height: 1.6; color: #4A3F39; margin-bottom: 32px; }
  .cta { display: block; width: fit-content; padding: 14px 28px; background: #C97B5D; color: #FAF6F0; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600; font-family: 'DM Sans', Arial, sans-serif; margin-bottom: 32px; }
  .brand { font-size: 20px; color: #C97B5D; font-family: 'Georgia', serif; margin-bottom: 8px; }
  .footer { font-size: 12px; color: #B0A9A3; line-height: 1.5; border-top: 1px solid #E8E0D8; padding-top: 20px; margin-top: 40px; }
</style>
</head>
<body>
<div class="wrap">
  <p class="sender">${escapeHtml(displayName)} sent you this.</p>
  <p class="note">&ldquo;${escapeHtml(userNote)}&rdquo;</p>
  <p class="streak">${escapeHtml(streakLine)}</p>
  <p class="desc">HoldOff is an AI that reads the message you&rsquo;re about to send and tells you whether to send it, hold it, or rewrite it. No judgment. Just a clear read.</p>
  <a class="cta" href="${refUrl}">Try it &rarr;</a>
  <div class="brand">HoldOff</div>
  <div class="footer">Reply STOP and we won&rsquo;t email you again about HoldOff.</div>
</div>
</body>
</html>`;

  return sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
    replyTo: `${displayName} via HoldOff <hello@shouldiholdoff.live>`,
  });
}

/**
 * Send reward-unlocked notification email to the sender.
 * @param {Object} opts
 * @param {string} opts.senderEmail
 * @param {string} opts.tierId      — 'tier1'|'tier2'|'tier3'|'tier4'
 * @param {number} opts.rewardCredits
 * @param {number} opts.trialDays
 * @param {boolean} opts.lifetime
 */
async function sendRewardUnlockedEmail({ senderEmail, tierId, rewardCredits, trialDays, lifetime }) {
  const tierMessages = {
    tier1: 'You hit your first referral. The streak continues.',
    tier2: "Five friends in — you're making a difference.",
    tier3: 'Double digits. You unlocked serious power.',
    tier4: "Twenty-five referrals. Lifetime status. You've made it.",
  };
  const headline = tierMessages[tierId] || 'You unlocked a new reward.';

  const rewardLines = [];
  if (lifetime) rewardLines.push('Lifetime HoldOff Pro — yours forever.');
  if (trialDays > 0) rewardLines.push(`${trialDays}-day Pro trial unlocked.`);
  if (rewardCredits > 0) rewardLines.push(`${rewardCredits} free message verdicts added to your account.`);
  const rewardText = rewardLines.join(' ');

  const subject = 'You unlocked a HoldOff reward';
  const userToken = senderEmail.toLowerCase().trim().replace(/@.*$/, '').slice(0, 12);

  const text = `You unlocked a reward!

${headline}

${rewardText}

Keep sharing your link — every converted signup brings you closer to the next reward.

Your link: ${APP_URL}/filter?ref=${userToken}

— HoldOff`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin: 0; padding: 0; background: #FAF6F0; font-family: 'Georgia', serif; color: #2A2522; }
  .wrap { max-width: 520px; margin: 0 auto; padding: 40px 24px; }
  .headline { font-size: 22px; font-weight: 600; color: #2A2522; margin-bottom: 20px; line-height: 1.4; }
  .reward { font-size: 16px; color: #C97B5D; font-weight: 600; margin-bottom: 24px; line-height: 1.5; }
  .link { font-size: 14px; color: #9A8F8A; margin-bottom: 28px; }
  .cta { display: block; width: fit-content; padding: 14px 28px; background: #C97B5D; color: #FAF6F0; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600; font-family: 'DM Sans', Arial, sans-serif; margin-bottom: 32px; }
  .brand { font-size: 20px; color: #C97B5D; font-family: 'Georgia', serif; margin-bottom: 8px; }
  .footer { font-size: 12px; color: #B0A9A3; line-height: 1.5; border-top: 1px solid #E8E0D8; padding-top: 20px; margin-top: 40px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="headline">${escapeHtml(headline)}</div>
  <div class="reward">${escapeHtml(rewardText)}</div>
  <div class="link">Keep sharing your link — every converted signup brings you closer to the next reward.</div>
  <a class="cta" href="${APP_URL}/filter">Open HoldOff &rarr;</a>
  <div class="brand">HoldOff</div>
  <div class="footer">You're receiving this because you referred a friend to HoldOff.</div>
</div>
</body>
</html>`;

  return sendEmail({ to: senderEmail, subject, text, html });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { sendReferralEmail, sendRewardUnlockedEmail };