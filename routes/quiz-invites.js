/**
 * Quiz Invite Route — /api/send-quiz-invites
 *
 * Handles viral referral invitations from the HoldOff quiz.
 * Generates referral codes and sends invite emails via Resend.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { createReferral } = require('../db/referrals');
const { sendEmail } = require('../services/email');

const APP_URL = process.env.APP_URL || 'https://shouldiholdoff.live';

/**
 * POST /api/send-quiz-invites
 *
 * Body:
 * {
 *   "referrerName": "Stacy",
 *   "referrerEmail": "stacy@example.com",
 *   "quizScore": 8,
 *   "quizResult": "THE Text Spiraler",
 *   "contacts": [
 *     { "name": "Alex", "email": "alex@example.com" },
 *     ...
 *   ]
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { referrerName, referrerEmail, quizScore, quizResult, contacts } = req.body;

    if (!referrerName || !referrerEmail || !Array.isArray(contacts)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: referrerName, referrerEmail, contacts (array)',
      });
    }

    if (contacts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one contact is required',
      });
    }

    // Cap at 20 per request to prevent spam
    const capped = contacts.slice(0, 20);

    // Filter valid contacts (must have email)
    const validContacts = capped.filter(c => c.email && /\S+@\S+\.\S+/.test(c.email.trim()));

    if (validContacts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid contacts with email addresses',
      });
    }

    // Queue invites for async delivery (store in DB or queue service)
    // For now, we'll queue them to be sent by a subagent
    const invites = validContacts.map((contact) => ({
      referralCode,
      referrerName,
      referrerEmail,
      referrerQuizResult: quizResult,
      recipientName: contact.name || 'Friend',
      recipientPhone: contact.phone,
      recipientEmail: contact.email,
      trackingUrl,
      sentAt: new Date().toISOString(),
      status: 'queued',
    }));

    // Store invites in the referrals table and return success
    let savedCount = 0;
    for (const invite of invites) {
      try {
        await createReferral({
          senderEmail: referrerEmail,
          senderDevice: null,
          recipientEmail: invite.recipientEmail || null,
          note: `Quiz invite — ${quizResult || 'quiz'} — ${invite.recipientPhone || invite.recipientEmail}`,
          utmToken: referralCode + '_' + savedCount,
        });
        savedCount++;
      } catch (dbErr) {
        // Non-fatal: log and continue
        console.warn(`[quiz-invites] DB store failed for invite ${savedCount}:`, dbErr.message);
      }
    }
    console.log(`[quiz-invites] Stored ${savedCount}/${invites.length} invites for referral code ${referralCode}`);
    // Generate unique referral code tied to sender email (stable)
    const referralCode = crypto.createHash('sha256')
      .update(referrerEmail.toLowerCase().trim())
      .digest('hex')
      .slice(0, 12);
    const trackingUrl = `${APP_URL}/quiz?ref=${referralCode}&source=quiz_invite`;

    let sent = 0;
    let failed = 0;

    for (const contact of validContacts) {
      const recipientName = contact.name || 'Friend';
      const recipientEmail = contact.email.trim().toLowerCase();

      const subject = `${referrerName} thought you'd want this`;

      const text = `${referrerName} just took HoldOff's attachment-style quiz and got: "${quizResult}".

They think you'd find it interesting.

HoldOff is an AI that reads the message you're about to send and tells you whether to send it, hold it, or rewrite it — based on your attachment style.

Take the quiz: ${trackingUrl}

---
This was sent by ${referrerName} via HoldOff. Reply STOP if you don't want to hear from us again.`;

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#FAF6F0;font-family:'Georgia',serif;color:#2A2522;}
  .wrap{max-width:520px;margin:0 auto;padding:40px 24px;}
  .sender{font-size:14px;color:#9A8F8A;margin-bottom:24px;}
  .result-badge{display:inline-block;background:#F5EDE0;border:1px solid #E8DACE;border-radius:6px;padding:6px 14px;font-size:13px;color:#6B5E55;margin-bottom:24px;}
  .desc{font-size:15px;line-height:1.6;color:#4A3F39;margin-bottom:32px;}
  .cta{display:block;width:fit-content;padding:14px 28px;background:#C97B5D;color:#FAF6F0;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;font-family:'DM Sans',Arial,sans-serif;margin-bottom:32px;}
  .brand{font-size:20px;color:#C97B5D;font-family:'Georgia',serif;margin-bottom:8px;}
  .footer{font-size:12px;color:#B0A9A3;line-height:1.5;border-top:1px solid #E8E0D8;padding-top:20px;margin-top:40px;}
</style>
</head>
<body>
<div class="wrap">
  <p class="sender">${escapeHtml(referrerName)} sent you this.</p>
  <div class="result-badge">Their result: &ldquo;${escapeHtml(quizResult || 'Attachment style quiz')}&rdquo;</div>
  <p class="desc">HoldOff is an AI that reads the message you&rsquo;re about to send and tells you whether to send it, hold it, or rewrite it &mdash; based on your attachment style.</p>
  <a class="cta" href="${escapeHtml(trackingUrl)}">Take the free quiz &rarr;</a>
  <div class="brand">HoldOff</div>
  <div class="footer">This was sent by ${escapeHtml(referrerName)} via HoldOff.<br>Reply STOP if you don&rsquo;t want to hear from us again.</div>
</div>
</body>
</html>`;

      try {
        await sendEmail({ to: recipientEmail, subject, text, html });
        sent++;
      } catch (err) {
        console.error('[quiz-invites] email failed for recipient:', err.message);
        failed++;
      }
    }

    console.log(`[quiz-invites] sent=${sent} failed=${failed} referral=${referralCode}`);

    res.status(200).json({
      success: true,
      referralCode,
      invitesSent: sent,
      invitesFailed: failed,
      trackingUrl,
      message: `${sent} invite${sent !== 1 ? 's' : ''} sent! Share your referral link to earn rewards.`,
    });

  } catch (error) {
    console.error('[quiz-invites] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to send invites. Please try again.',
    });
  }
});

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = router;
