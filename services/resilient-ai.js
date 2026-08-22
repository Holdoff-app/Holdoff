const { buildGroundedSnippet } = require('./knowledge-base');

function buildAnalyzeFallback(message) {
  const { text, hits } = buildGroundedSnippet(
    `analyze outgoing message pause anxious rewrite ${message || ''}`,
    "AI providers are currently unavailable. Hold for now and revisit this message when you're calmer."
  );
  return {
    verdict: 'HOLD',
    pattern: 'Temporary AI outage — pause recommended',
    whats_happening: "We couldn't complete a live model analysis right now.",
    grounded_voice: text.slice(0, 500),
    rewrite: null,
    confidence: 0,
    verdict_source: 'local_kb_fallback',
    knowledge_hits: hits.map((h) => h.source),
  };
}

function buildInterpretFallback(message) {
  const { text, hits } = buildGroundedSnippet(
    `interpret incoming message attachment style safety ${message || ''}`,
    'Live interpretation is unavailable. Default to a slow read and avoid catastrophic assumptions.'
  );
  return {
    detected_style: 'Unclear',
    what_it_means: 'The intent is ambiguous without live analysis.',
    how_you_misread_it: 'In uncertainty, anxiety can turn gaps into threat. Pause before reacting.',
    what_they_need: 'A calm follow-up later, not immediate escalation.',
    attachment_style_reasoning: text.slice(0, 500),
    red_flags: null,
    grounded_response: 'Ask one clear, low-pressure clarifying question later.',
    source: 'local_kb_fallback',
    knowledge_hits: hits.map((h) => h.source),
  };
}

function buildCompanionFallback({ soul, style, message }) {
  const { text, hits } = buildGroundedSnippet(
    `companion ${soul || 'Sadie'} ${style || ''} support non diagnostic boundary ${message || ''}`,
    "I'm here with you. I can't run full live analysis right now, but we can still slow this moment down together."
  );
  return {
    reply: `${text}\n\nReminder: HoldOff is support, not therapy or diagnosis.`,
    source: 'local_kb_fallback',
    knowledge_hits: hits.map((h) => h.source),
  };
}

function buildOutgoingVerdictFallback(outgoingMessage) {
  const { text, hits } = buildGroundedSnippet(
    `outgoing verdict safety pause rewrite ${outgoingMessage || ''}`,
    'Live verdict analysis is unavailable. Use a cautious default and avoid sending under high activation.'
  );
  return {
    recipientRead: 'Likely high-risk to send immediately without review.',
    userAnxiety: 'When systems are uncertain, your anxious brain may push for urgent reassurance.',
    safetyLevel: 'yellow',
    attachmentPattern: 'SEC',
    emotionalState: null,
    reasoning: text.slice(0, 500),
    spiralLockout: 0,
    source: 'local_kb_fallback',
    knowledge_hits: hits.map((h) => h.source),
  };
}

module.exports = {
  buildAnalyzeFallback,
  buildInterpretFallback,
  buildCompanionFallback,
  buildOutgoingVerdictFallback,
};
