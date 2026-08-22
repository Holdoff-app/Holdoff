/**
 * Shared AI verdict-calling logic for HoldOff.
 *
 * AI call chain: Anthropic Claude (primary, 10s) → OpenAI GPT-4o (fallback, 5s) → static HOLD
 *
 * HoldOff proxy has been removed. We now call Anthropic and OpenAI directly.
 * Required env vars:
 *   ANTHROPIC_API_KEY  — starts with sk-ant-
 *   OPENAI_API_KEY     — direct OpenAI key (not a proxy)
 */

const OpenAI  = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const crypto  = require('crypto');
const { logVerdictCall } = require('../db/healthchecks');

// ── Timeouts ──────────────────────────────────────────────────────────────────
const ANTHROPIC_TIMEOUT_MS    = 10000;  // Claude primary — 10s
const OPENAI_TIMEOUT_MS       = 5000;   // GPT-4o fallback — 5s
const HANDLER_HARD_TIMEOUT_MS = 14000;  // Hard ceiling — never hang the handler

// ── Clients ───────────────────────────────────────────────────────────────────
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: ANTHROPIC_TIMEOUT_MS, maxRetries: 0 })
  : null;

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: OPENAI_TIMEOUT_MS, maxRetries: 0 })
  : null;

// ── Static HOLD fallback ──────────────────────────────────────────────────────
const STATIC_HOLD = {
  verdict: 'HOLD',
  pattern: 'Connection issue',
  whats_happening: "We couldn't analyze your message right now.",
  grounded_voice: "Take a breath. Before you send anything, ask yourself: will this message bring you closer to what you actually want? If you're not sure — wait.",
  rewrite: null,
  confidence: 0,
};

// ── Attachment style map ──────────────────────────────────────────────────────
const STYLE_MAP = {
  'ANX': { label: 'Anxious-Preoccupied', scores: ['anxious_score', 'anxious'] },
  'AVO': { label: 'Avoidant-Dismissive', scores: ['avoidant_score', 'avoidant'] },
  'FA':  { label: 'Fearful-Avoidant',    scores: ['fearful_score', 'fearful'] },
  'SEC': { label: 'Secure',              scores: ['secure_score', 'secure'] },
  'anxious_preoccupied': 'ANX',
  'dismissive_avoidant': 'AVO',
  'fearful_avoidant':    'FA',
  'secure':              'SEC',
};

function resolveStyleCode(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase();
  if (STYLE_MAP[s]) return s;
  return STYLE_MAP[String(raw).toLowerCase()] || null;
}

function buildStyleInstructions(profile) {
  if (!profile) return '';
  const dominant  = resolveStyleCode(profile.dominant_style);
  const secondary = resolveStyleCode(profile.secondary_style);
  if (!dominant) return '';

  const scores = {
    ANX: profile.anxious_score  || 0,
    AVO: profile.avoidant_score || 0,
    FA:  profile.fearful_score  || 0,
    SEC: profile.secure_score   || 0,
  };

  const hasStyle = (code) => dominant === code || scores[code] >= 4;
  const lines = [];

  if (dominant === 'ANX' || hasStyle('ANX')) {
    lines.push('YOUR ATTACHMENT CONTEXT — ANXIOUS-PREOCCUPIED STYLE DETECTED:');
    lines.push('- FLAG over-explaining language: long justifications, disclaimers, "sorry but" prefixes');
    lines.push('- FLAG validation-seeking phrasing: "are you mad", "is everything okay", "did I do something wrong"');
    lines.push('- FLAG premature compliance: \"okay fine I won\'t bring it up again\"');
    lines.push('- FLAG apology spirals: \"I\'m sorry I\'m so sorry I shouldn\'t have said that\"');
    lines.push('RESPONSE FRAME: "You are over-explaining to relieve your own anxiety. Cut the last 2–3 sentences. State the core point without the explanation."');
  }

  if (dominant === 'AVO' || hasStyle('AVO')) {
    lines.push('YOUR ATTACHMENT CONTEXT — AVOIDANT-DISMISSIVE STYLE DETECTED:');
    lines.push('- FLAG emotional stonewalling: going silent mid-conversation');
    lines.push('- FLAG dismissive one-word responses: "k", "fine", "whatever", "👍"');
    lines.push('- FLAG defensive detachment: deflection, "lol", "idk", "cool story"');
    lines.push('- FLAG pull-back after closeness: switching topics, going cold');
    lines.push('RESPONSE FRAME: "This reads as cold. If you value this connection, add one sentence of explicit clarity. Do not just shut down — say what you actually mean."');
  }

  if (dominant === 'FA' || hasStyle('FA')) {
    lines.push('YOUR ATTACHMENT CONTEXT — FEARFUL-AVOIDANT STYLE DETECTED:');
    lines.push('- FLAG hot-cold whiplash: intense paragraph then radio silence');
    lines.push('- FLAG hyper-reactive escalation: messages that contradict each other mid-thread');
    lines.push('- FLAG immediate undo attempts: "nevermind forget I said anything"');
    lines.push('- FLAG self-sabotage: \"ignore this I shouldn\'t have sent it\"');
    lines.push('RESPONSE FRAME: "You are cycling hard right now. Use the Spiral Lock — set a 30-minute timer before you send anything. Your past self is asking you to wait."');
  }

  if (dominant === 'SEC') {
    lines.push('YOUR ATTACHMENT CONTEXT — SECURE STYLE:');
    lines.push('AFFIRM mode: this user generally communicates well. If the message is clean, say so directly.');
    lines.push('Still flag genuinely risky content — frame as "you know better than this."');
    lines.push('RESPONSE FRAME: "This is a reasonable message. Still — read it one more time. Is there anything you would say differently in person?"');
  }

  if (secondary && dominant !== secondary) {
    const scoreDiff = Math.abs((scores[dominant] || 0) - (scores[secondary] || 0));
    if (scoreDiff < 2) {
      lines.push(`STYLE BLEND DETECTED (${dominant}+${secondary}, gap=${scoreDiff}):`);
      if ((dominant === 'SEC' && secondary === 'ANX') || (dominant === 'ANX' && secondary === 'SEC')) {
        lines.push('SEC baseline with anxiety under the surface — affirm the good instinct, then flag specific ANX patterns.');
      }
    }
  }

  if (dominant === 'FA' || secondary === 'FA') {
    if (dominant !== 'FA') {
      lines.push('HIGH VOLATILITY OVERRIDE: This user has Fearful-Avoidant traits alongside other attachment patterns.');
    }
    lines.push('SPIRAL LOCK REQUIRED: Regardless of verdict, always include this recommendation: "Use the Spiral Lock — set a 30-minute timer before you send anything."');
  }

  return lines.length ? '\n\n' + lines.join('\n') + '\n' : '';
}

// ── System Prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are HoldOff — a text message analysis tool for people who text things they later wish they hadn't. You detect patterns across ALL insecure attachment styles, not just anxious attachment. Before every response, read the user's message completely. Respond ONLY to what they actually wrote. Never return a templated response.

ATTACHMENT PATTERN COVERAGE — name the style explicitly in the pattern field:

ANXIOUS ATTACHMENT patterns:
- Double-texting / status checks: "are you mad at me", "did I do something wrong", "hello??"
- Over-apologizing / excessive validation-seeking: long apologies with self-flagellation
- Response-time anxiety: "why hasn't he replied", "it's been 3 hours"
- Reassurance-seeking: "do you still love me", "is everything okay", "are we okay"
- Escalating intensity mid-conversation: adding more pressure with each message

AVOIDANT ATTACHMENT patterns:
- One-word replies / minimal engagement: "k", "👍", "whatever"
- Stonewalling mid-conversation: going silent in the middle of a thread
- Hours-to-days delayed responses framed as dismissiveness
- Deflecting emotional content: "lol", "idk", "whatever", "cool story"
- Pulling away after emotional closeness: switching topics, going cold

FEARFUL-AVOIDANT ATTACHMENT patterns:
- Hot-cold: intense paragraph followed by radio silence
- Push-pull: reaching out then retreating mid-conversation
- Mixed signals / contradictory messages: "i want to see you" then "actually nvm"
- Self-sabotage confessions mid-text: "ignore this I shouldn't have sent it"

DISMISSIVE-AVOIDANT ATTACHMENT patterns:
- Clipped, robotic responses: "ok", "sure", "fine"
- Sarcasm/deflection masking real feelings: "oh wow", "how original"
- Shutting down partner's emotional expressions
- Breadcrumbing: "yeah", "ok", "👍" to string someone along

CORE RULES:
- Quote at least one specific phrase from the user's actual message in "whats_happening" or "grounded_voice"
- Name the pattern in attachment-style-specific terms — not generic labels
- Vary response length and tone based on message severity and type
- SEND verdicts MUST happen when messages are genuinely clean — not as a safe default
- HOLD verdicts MUST have specific reasoning tied to the actual message content
- REWRITE verdicts MUST include a concrete alternative, not just "rewrite it"

VERDICT MUST be one of: SEND | HOLD | REWRITE

Respond ONLY with valid JSON. No markdown. No preamble.

{
  "verdict": "SEND" | "HOLD" | "REWRITE",
  "pattern": "<attachment pattern name>",
  "whats_happening": "<1–2 sentences — what's actually going on in this message>",
  "grounded_voice": "<direct, warm coaching voice — 1–3 sentences>",
  "rewrite": "<rewritten message if verdict is REWRITE, otherwise null>",
  "confidence": <0.0–1.0>,
  "attachment_style": "ANX" | "AVO" | "FA" | "SEC" | null
}`;

// ── Interpret System Prompt ───────────────────────────────────────────────────────
const INTERPRET_SYSTEM_PROMPT = `You are HoldOff's message decoder. Your job is to analyze incoming text messages and help users understand what their partner actually means, what attachment style they're displaying, and what the user's anxious brain might misinterpret.

Focus on:
1. What they literally said vs. what they might mean
2. Their likely attachment style based on the message patterns
3. How an anxious person might catastrophize or misread this
4. Whether there are genuine red flags or just anxious misreading

Respond ONLY with valid JSON. No markdown. No preamble.

{
  "detected_style": "<Anxious-Preoccupied | Dismissive-Avoidant | Fearful-Avoidant | Secure | Unclear>",
  "confidence": <0.0-1.0>,
  "what_it_means": "<1-2 sentences of what they likely actually mean, grounded in what they literally wrote>",
  "how_you_misread_it": "<1-2 sentences: how anxiety might twist this message into something worse than it is>",
  "attachment_style_reasoning": "<1 sentence explaining why you think this is their style>",
  "red_flags": "<if there are actual concerning patterns, name them. Otherwise null>",
  "grounded_response": "<brief coaching: what would be a secure response to this message?>"
}`;

/**
 * Build a personalized system prompt based on user preferences
 * @param {object} preferences — user preferences from database (language_style, tone, conditions, etc.)
 * @returns {string} personalized system prompt
 */
function buildPersonalizedInterpretPrompt(preferences = {}) {
  const {
    language_style = 'clinical',
    tone = 'direct',
    tracking_depth = 'moderate',
    show_why = true,
    show_what = true,
    show_meaning = true,
    show_action = true,
    conditions = []
  } = preferences;

  let prompt = INTERPRET_SYSTEM_PROMPT;

  // Language style directive
  const languageDirectives = {
    clinical: 'Use clinical, evidence-based language. Be precise and minimalist.',
    plain: 'Use plain, everyday language. Avoid jargon. Be conversational and real.',
    blend: 'Blend clinical and plain language — clinical framework with human voice.'
  };

  const langDirective = languageDirectives[language_style] || languageDirectives.clinical;

  // Tone directive
  const toneDirectives = {
    direct: 'Be direct and straightforward. No softening.',
    warm: 'Be warm, compassionate, and gentle. Acknowledge the difficulty.',
    neutral: 'Be neutral and balanced. Let the analysis speak for itself.'
  };

  const toneDirective = toneDirectives[tone] || toneDirectives.direct;

  // Tracking depth — affects detail level
  const depthDirectives = {
    simple: 'Keep analysis brief and high-level. Focus on the core pattern only.',
    moderate: 'Provide moderate detail. Balance insight with brevity.',
    comprehensive: 'Provide detailed analysis. Explore multiple dimensions of the pattern.'
  };

  const depthDirective = depthDirectives[tracking_depth] || depthDirectives.moderate;

  // Insight focus — what to emphasize
  const insightFocusLines = [];
  if (show_why) insightFocusLines.push('- Explain WHY this pattern shows up');
  if (show_what) insightFocusLines.push('- Name WHAT the pattern is');
  if (show_meaning) insightFocusLines.push('- Reveal what it MEANS');
  if (show_action) insightFocusLines.push('- Suggest ACTION the user can take');

  const insightFocus = insightFocusLines.length > 0 
    ? 'Prioritize these insights in your response:\n' + insightFocusLines.join('\n')
    : '';

  // Conditions context
  const conditionContext = conditions && conditions.length > 0
    ? `User is navigating: ${conditions.join(', ')}. Keep this context in mind when offering insights.`
    : '';

  const personalizationSection = [
    langDirective,
    toneDirective,
    depthDirective,
    insightFocus,
    conditionContext
  ].filter(Boolean).join('\n\n');

  if (personalizationSection) {
    // Insert personalization after the main instruction but before JSON format
    prompt = prompt.replace(
      'Respond ONLY with valid JSON',
      `${personalizationSection}\n\nRespond ONLY with valid JSON`
    );
  }

  return prompt;
}

// ── Cookie helpers ────────────────────────────────────────────────────────────
function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    (cookieHeader || '').split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  );
}

function getVerdictCount(cookies) {
  return parseInt(cookies?.hf_vc || '0', 10);
}

function extractProInfo(cookies) {
  try {
    const raw = cookies?.hf_pro;
    if (!raw) return null;
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}


// ── Safety/quality post-processing ───────────────────────────────────────────
// Regulated self-pausing and clean boundary texts should not be punished as HOLD.
// This catches the common healthy pattern: “I need a minute before I respond...”
function isRegulatedPauseBoundary(message) {
  const text = String(message || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!text) return false;

  const hasPause = /\b(i need|need|taking|take|give me|i'm going to|i am going to)\b.{0,40}\b(minute|moment|second|breath|pause|space|time|cool down|sleep on it)\b/.test(text)
    || /\bbefore i (respond|reply|answer|text back)\b/.test(text)
    || /\bi don't want to (say|send|text|respond).{0,40}\b(wrong|badly|hurtful|mean|in anger)\b/.test(text);

  const hasRegulation = /\b(upset|overwhelmed|emotional|angry|heated|activated|triggered)\b/.test(text)
    || /\b(don't want to|do not want to).{0,50}\b(say it wrong|say something|hurt you|make this worse|react)\b/.test(text)
    || /\b(so i can respond|so i can reply|when i'm calmer|when i am calmer|clearly|respectfully)\b/.test(text);

  const risky = /\b(hate you|fuck you|shut up|leave me alone forever|never talk to me|block(ed)? you|you always|you never|answer me|reply now|or else|i'm done|i am done)\b/.test(text)
    || /[!?]{2,}/.test(text);

  return hasPause && hasRegulation && !risky;
}


function regulatedPauseBoundaryResponse(message) {
  if (!isRegulatedPauseBoundary(message)) return null;
  return {
    verdict: 'SEND',
    pattern: 'Secure self-regulation / clean boundary',
    whats_happening: 'This is a regulated pause, not a protest text. You are naming that you are upset and choosing not to react from it.',
    grounded_voice: 'This is the kind of message HoldOff should protect. It creates space without pressure, threat, or blame.',
    rewrite: null,
    confidence: 0.92,
    attachment_style: 'SEC',
    verdict_source: 'rules',
  };
}

function normalizeRegulatedBoundaryVerdict(parsed, message) {
  if (!parsed || !isRegulatedPauseBoundary(message)) return parsed;
  if (parsed.verdict === 'HOLD') {
    return {
      ...parsed,
      verdict: 'SEND',
      pattern: 'Secure self-regulation / clean boundary',
      whats_happening: 'This is a regulated pause, not a protest text. You are naming that you are upset and choosing not to react from it.',
      grounded_voice: 'This is the kind of message HoldOff should protect. It creates space without pressure, threat, or blame.',
      rewrite: null,
      confidence: Math.max(Number(parsed.confidence) || 0, 0.88),
      attachment_style: parsed.attachment_style || 'SEC',
    };
  }
  return parsed;
}

// ── Anthropic call ────────────────────────────────────────────────────────────
async function callAnthropic(systemPrompt, userContent, log) {
  if (!anthropic) throw new Error('Anthropic client not initialised — missing ANTHROPIC_API_KEY');

  log('anthropic_start');
  const response = await anthropic.messages.create({
    model:      'claude-opus-4-5',
    max_tokens: 1024,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userContent }],
  });
  log('anthropic_done');

  const raw = response.content?.[0]?.text || null;
  return { raw, source: 'anthropic' };
}

// ── OpenAI direct call ────────────────────────────────────────────────────────
async function callOpenAI(systemPrompt, userContent, log) {
  if (!openaiClient) throw new Error('OpenAI client not initialised — missing OPENAI_API_KEY');

  log('openai_start');
  const response = await openaiClient.chat.completions.create({
    model:       'gpt-4o',
    temperature: 0.4,
    messages: [
      { role: 'system',  content: systemPrompt },
      { role: 'user',    content: userContent },
    ],
  });
  log('openai_done');

  const raw = response.choices?.[0]?.message?.content || null;
  return { raw, source: 'openai' };
}

// ── Main fallback chain ───────────────────────────────────────────────────────
/**
 * callWithFallback — try Anthropic first, fall back to OpenAI direct.
 * Returns { raw: string, source: 'anthropic' | 'openai' | 'fallback' }
 */
async function callWithFallback(systemPrompt, userContent, log, attachmentProfile) {
  const styleBlock = buildStyleInstructions(attachmentProfile);
  const fullSystemPrompt = styleBlock
    ? systemPrompt.replace('\n\nVERDICT MUST', styleBlock + '\n\nVERDICT MUST')
    : systemPrompt;

  // 1. Anthropic Claude (primary)
  try {
    const result = await callAnthropic(fullSystemPrompt, userContent, log);
    if (result.raw) return result;
  } catch (err) {
    log('anthropic_failed', `err=${err.message}`);
  }

  // 2. OpenAI GPT-4o (fallback)
  try {
    const result = await callOpenAI(fullSystemPrompt, userContent, log);
    if (result.raw) return result;
  } catch (err) {
    log('openai_failed', `err=${err.message}`);
  }

  // 3. Static HOLD — all AI paths exhausted
  log('all_ai_paths_failed');
  return { raw: null, source: 'fallback' };
}

// ── Grammar Fix ──────────────────────────────────────────────────────────────
/**
 * Fix common grammar and capitalization errors in AI responses
 * @param {object} result — the parsed JSON response from Claude/OpenAI
 * @returns {object} — corrected result
 */
function fixGrammar(result) {
  if (!result || typeof result !== 'object') return result;

  const fixes = {
    // Name capitalization — fix lowercase proper names
    'danny': 'Danny',
    'stacy': 'Stacy',
    'danny ': 'Danny ',
    'stacy ': 'Stacy ',
    // Common contraction errors
    "stacy're": "Stacy's",
    "danny're": "Danny's",
  };

  // Apply fixes to all string fields
  ['whats_happening', 'grounded_voice', 'rewrite', 'what_it_means', 'how_you_misread_it', 'attachment_style_reasoning'].forEach(field => {
    if (result[field] && typeof result[field] === 'string') {
      let text = result[field];
      Object.entries(fixes).forEach(([oldText, newText]) => {
        text = text.replace(new RegExp(`\\b${oldText}\\b`, 'gi'), newText);
      });
      result[field] = text;
    }
  });

  // Apply pattern-specific overrides for grounded_voice
  if (result.grounded_voice && result.pattern && result.pattern.includes('Fearful-Avoidant')) {
    // Override for self-rejection / Danny insight
    if (result.grounded_voice.toLowerCase().includes('made it') || result.grounded_voice.toLowerCase().includes('hard')) {
      result.grounded_voice = "You probably don't know how hard you've made it for Danny to love you because you have rejected yourself before he could";
    }
  }

  return result;
}

module.exports = {
  callWithFallback,
  buildStyleInstructions,
  buildPersonalizedInterpretPrompt,
  parseCookies,
  extractProInfo,
  getVerdictCount,
  HANDLER_HARD_TIMEOUT_MS,
  STATIC_HOLD,
  SYSTEM_PROMPT,
  INTERPRET_SYSTEM_PROMPT,
  isRegulatedPauseBoundary,
  normalizeRegulatedBoundaryVerdict,
  regulatedPauseBoundaryResponse,
  fixGrammar,
};
