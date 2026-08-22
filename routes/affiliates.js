/**
 * Affiliates route group.
 * Owns: POST /api/affiliates/signup — stores application, sends emails.
 * Does NOT own: Stripe Connect payouts, user auth, general waitlist.
 */
const express = require('express');
const router = express.Router();
const { addAffiliate } = require('../db/affiliates');
const { sendEmail } = require('../services/email');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'holdoff@shouldiholdoff.live';
const APP_URL = process.env.APP_URL || 'https://shouldiholdoff.live';

/** Send admin notification when a new affiliate applies. */
async function sendAdminNotification({ name, practiceHandle, email, audienceSize, affCode }) {
  const subject = 'New affiliate application: ' + name;
  const html = `
<div style="font-family: Georgia, serif; max-width: 520px; color: #2A2522; line-height: 1.7;">
  <h2 style="font-size: 1.4rem; font-weight: 600; margin-bottom: 1rem;">New affiliate application</h2>
  <table style="border-collapse: collapse; width: 100%; font-size: 0.95rem;">
    <tr><td style="padding: 0.4rem 0.75rem 0.4rem 0; color: #8A7F79; width: 140px;">Name</td><td>${name}</td></tr>
    <tr><td style="padding: 0.4rem 0.75rem 0.4rem 0; color: #8A7F79;">Practice / Handle</td><td>${practiceHandle || '—'}</td></tr>
    <tr><td style="padding: 0.4rem 0.75rem 0.4rem 0; color: #8A7F79;">Email</td><td>${email}</td></tr>
    <tr><td style="padding: 0.4rem 0.75rem 0.4rem 0; color: #8A7F79;">Audience size</td><td>${audienceSize || '—'}</td></tr>
    <tr><td style="padding: 0.4rem 0.75rem 0.4rem 0; color: #8A7F79;">Aff code</td><td><code>${affCode}</code></td></tr>
    <tr><td style="padding: 0.4rem 0.75rem 0.4rem 0; color: #8A7F79;">Link</td><td>${APP_URL}/?aff=${affCode}</td></tr>
  </table>
  <p style="margin-top: 1.5rem; font-size: 0.85rem; color: #8A7F79;">Status is <strong>pending</strong> — review and approve manually.</p>
</div>`.trim();

  const text = 'New affiliate application\nName: ' + name + '\nPractice: ' + (practiceHandle || '—') + '\nEmail: ' + email + '\nAudience: ' + (audienceSize || '—') + '\nCode: ' + affCode + '\nLink: ' + APP_URL + '/?aff=' + affCode;

  try {
    await sendEmail({ to: ADMIN_EMAIL, subject, html, text });
  } catch (err) {
    console.error('[affiliates] admin notification failed:', err.message);
  }
}

/** Send confirmation email to the applicant. */
async function sendApplicantConfirmation({ name, email, affCode }) {
  const subject = 'Your HoldOff affiliate application is in.';
  const firstName = name.split(' ')[0];
  const html = `
<div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #2A2522; line-height: 1.7;">
  <h2 style="font-size: 1.4rem; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 1rem;">We got your application, ${firstName}.</h2>
  <p style="margin-bottom: 1rem;">Thanks for applying to the HoldOff affiliate program. We'll review your application and be in touch within a few business days.</p>
  <p style="margin-bottom: 1rem;">Your referral link (once approved) will be:</p>
  <p style="background: #FAF6F0; border-left: 3px solid #C97B5D; padding: 0.75rem 1rem; border-radius: 0 8px 8px 0; font-size: 0.95rem; margin-bottom: 1.5rem;">
    <strong>${APP_URL}/?aff=${affCode}</strong>
  </p>
  <p style="margin-bottom: 1rem;">Every subscriber who signs up through your link earns you <strong>30% recurring commission</strong> for the life of their subscription, paid monthly once we activate payouts.</p>
  <p style="font-style: italic; color: #C97B5D; margin-bottom: 1.5rem;">Don't send it yet. — HoldOff</p>
  <hr style="border: none; border-top: 1px solid #E5DED4; margin: 1.5rem 0;" />
  <p style="font-size: 0.8rem; color: #8A7F79;">Questions? Reply to this email. We're a small team and we actually respond.</p>
</div>`.trim();

  const text = 'We got your application, ' + firstName + '.\n\nThanks for applying to the HoldOff affiliate program. We will review and be in touch within a few business days.\n\nYour referral link (once approved): ' + APP_URL + '/?aff=' + affCode + '\n\n30% recurring commission for the life of every subscriber you refer. Paid monthly.\n\n— HoldOff';

  try {
    await sendEmail({ to: email, subject, html, text, replyTo: 'holdoff@shouldiholdoff.live' });
  } catch (err) {
    console.error('[affiliates] applicant confirmation failed:', err.message);
  }
}

// POST /api/affiliates/signup
router.post('/signup', async (req, res) => {
  const { name, practiceHandle, email, audienceSize } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    const row = await addAffiliate({ name, practiceHandle, email, audienceSize });
    if (!row) {
      // Duplicate email — still return 200, do not expose internals
      return res.json({ ok: true, already: true });
    }

    // Fire emails async — do not block response
    (async () => {
      await sendAdminNotification({
        name: row.name,
        practiceHandle: row.practice_handle,
        email: row.email,
        audienceSize: row.audience_size,
        affCode: row.aff_code,
      });
      await sendApplicantConfirmation({
        name: row.name,
        email: row.email,
        affCode: row.aff_code,
      });
    })();

    return res.json({ ok: true });
  } catch (err) {
    console.error('[affiliates] signup error:', err.message);
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
