/**
 * Request validation middleware for HoldOff API endpoints.
 */

/**
 * Validate POST /api/verdict request body.
 * Expects { message_text: string, user_id?: string }
 * Returns 400 if message_text is missing, empty, or not a string.
 */
function validateVerdictRequest(req, res, next) {
  const { message_text, user_id } = req.body || {};

  if (message_text === undefined || message_text === null) {
    return res.status(400).json({ error: 'message_text is required' });
  }

  if (typeof message_text !== 'string') {
    return res.status(400).json({ error: 'message_text must be a string' });
  }

  if (!message_text.trim()) {
    return res.status(400).json({ error: 'message_text cannot be empty' });
  }

  // user_id is optional — normalize to undefined if passed as empty string
  if (user_id !== undefined && (typeof user_id !== 'string' || !user_id.trim())) {
    req.body.user_id = undefined;
  }

  next();
}

/**
 * Validate GET /api/verdict/history query parameters.
 * Accepts: verdict_type (SEND|HOLD|REWRITE), cursor (string), limit (1–50)
 * Returns 400 for invalid verdict_type or cursor; normalizes limit to 1–50.
 */
function validateHistoryQuery(req, res, next) {
  const { verdict_type, cursor, limit } = req.query;
  const validTypes = ['SEND', 'HOLD', 'REWRITE'];

  if (verdict_type !== undefined) {
    const normalized = verdict_type.toUpperCase();
    if (!validTypes.includes(normalized)) {
      return res.status(400).json({
        error: `Invalid verdict_type. Must be one of: ${validTypes.join(', ')}`,
      });
    }
    req.query.verdict_type = normalized;
  }

  if (cursor !== undefined && typeof cursor !== 'string') {
    return res.status(400).json({ error: 'cursor must be a string' });
  }

  if (limit !== undefined) {
    const parsed = parseInt(limit, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 50) {
      return res.status(400).json({ error: 'limit must be between 1 and 50' });
    }
    req.query.limit = parsed;
  } else {
    req.query.limit = 50;
  }

  next();
}

module.exports = {
  validateVerdictRequest,
  validateHistoryQuery,
};
