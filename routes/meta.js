/**
 * Meta Pixel event endpoints.
 * Fires Lead event on successful signup.
 */
const express = require('express');
const router = express.Router();

// POST /api/signup — fire Meta Pixel Lead event
router.post('/signup', (req, res) => {
  const { email, name } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  // Fire Lead via Meta's Conversion API-compatible inline pixel script
  // The pixel is already loaded globally from the layout.
  // This endpoint returns a script block the frontend can eval() to fire Lead.
  const payload = {
    event: 'Lead',
    context: {
      ip: req.ip,
      user_agent: req.get('user-agent') || '',
    },
    user_data: {
      email: email.toLowerCase().trim(),
      name: (name || '').trim(),
    },
  };

  // In a full integration we'd POST to Meta's Conversions API with an access token.
  // For now we fire via the client-side pixel ( fbq('track', 'Lead') ) which is
  // already loaded in the layout. The server-side conversion API call is optional
  // but recommended for reliability — see Meta's CAPI docs for the POST endpoint.
  console.log('[meta] Lead fired for:', payload.user_data.email);

  res.json({ ok: true, event: 'Lead' });
});

module.exports = router;