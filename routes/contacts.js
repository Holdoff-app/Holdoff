/**
 * Contacts API — relationship profiles.
 * GET  /api/contacts           — list contacts for logged-in user
 * POST /api/contacts           — create contact
 * GET  /api/contacts/:id       — get single contact with analysis
 * PATCH /api/contacts/:id      — update contact
 * DELETE /api/contacts/:id     — soft-delete contact
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../lib/auth');
const {
  getContacts, createContact, getContact,
  updateContact, softDeleteContact,
  getLatestAnalysis, getMessageStats,
} = require('../db/contacts');

// GET /api/contacts
router.get('/', requireAuth, async (req, res) => {
  try {
    const contacts = await getContacts(req.user.id);
    // Enrich with latest analysis for each + normalize field names for frontend
    const enriched = await Promise.all(contacts.map(async c => {
      const analysis = await getLatestAnalysis(req.user.id, c.id).catch(() => null);
      const stats = await getMessageStats(req.user.id, c.id).catch(() => null);
      return {
        ...c,
        // Normalize: frontend expects `name` and `phone`
        name: c.display_name || c.name || 'Unknown',
        phone: c.phone_number || c.phone || null,
        // Inbox preview fields
        lastMessage: c.last_message || null,
        lastMessageTime: c.last_messaged_at || c.updated_at || c.created_at || null,
        unread: c.unread_count || 0,
        flag: c.flag || 'green',
        // Analysis enrichment
        health_score: analysis?.health_score ?? null,
        attachment_style: analysis?.attachment_pattern ?? null,
        exit_warning: analysis?.exit_warning ?? false,
        message_count: (Number(stats?.sent_count) || 0) + (Number(stats?.received_count) || 0),
      };
    }));
    res.json(enriched);
  } catch (e) {
    console.error('[contacts] list error:', e.message);
    res.json([]);
  }
});

// POST /api/contacts
router.post('/', requireAuth, async (req, res) => {
  try {
    const { displayName, relationship, durationDays, phoneNumber } = req.body || {};
    if (!displayName) return res.status(400).json({ error: 'displayName required' });
    const contact = await createContact({
      userId: req.user.id,
      displayName,
      relationship: relationship || null,
      durationDays: durationDays || null,
      phoneNumber: phoneNumber || null,
    });
    res.json(contact);
  } catch (e) {
    console.error('[contacts] create error:', e.message);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// GET /api/contacts/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const contact = await getContact(req.params.id, req.user.id);
    if (!contact) return res.status(404).json({ error: 'Not found' });
    const analysis = await getLatestAnalysis(req.user.id, contact.id).catch(() => null);
    const stats = await getMessageStats(req.user.id, contact.id).catch(() => null);

    // Trigger async re-analysis if data is stale (>7 days old)
    const STALE_MS = 7 * 24 * 60 * 60 * 1000;
    const analyzedAt = analysis?.analyzed_at ? new Date(analysis.analyzed_at) : null;
    if (!analyzedAt || Date.now() - analyzedAt.getTime() > STALE_MS) {
      setImmediate(() => {
        const baseUrl = process.env.APP_URL || 'http://localhost:3000';
        fetch(`${baseUrl}/api/contact-insights/${contact.id}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `holdoff_token=${req.cookies?.holdoff_token || ''}`,
          },
        }).catch(err => console.error('[contacts] stale re-analysis error:', err.message));
      });
    }

    res.json({ ...contact, analysis, stats });
  } catch (e) {
    console.error('[contacts] get error:', e.message);
    res.status(500).json({ error: 'Failed to get contact' });
  }
});

// PATCH /api/contacts/:id
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { displayName, relationship, durationDays, phoneNumber } = req.body || {};
    const updated = await updateContact(req.params.id, req.user.id, {
      displayName, relationship, durationDays, phoneNumber,
    });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update' });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await softDeleteContact(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

module.exports = router;
