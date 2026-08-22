/**
 * HoldOff Relationship Analysis Engine — client-side urgency scoring.
 * Pure local scoring. No modal, no backend calls, no DOM manipulation.
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function wordCount(text) {
  return text.trim().split(/\b/).filter(Boolean).length;
}

// ─── 1. Threat Score (Urgency) ──────────────────────────────────────────────

/**
 * Returns urgency score 0–100.
 * Formula:
 *   Punctuation_Stacking × 0.35
 *   Message_Velocity     × 0.40
 *   Caps_Ratio           × 0.25
 */
function calculateUrgency(text) {
  const words = text.trim().split(/\b/).filter(Boolean);
  const wordCount = words.length;
  const charCount = text.length;
  const letters   = text.replace(/[^a-zA-Z]/g, '');
  const upperCount = (text.match(/[A-Z]/g) || []).length;
  const lowerCount = letters.length - upperCount;

  // Punctuation_Stacking: count runs of 2+ identical punct chars
  // e.g. "!!!" → 1 stack, "???" → 1 stack, "!!!??" → 1 stack
  let stackCount = 0;
  let lastChar   = '';
  let runLen     = 0;
  for (const ch of text) {
    if (/[!?.]/.test(ch)) {
      if (ch === lastChar) {
        runLen++;
      } else {
        if (runLen >= 2) stackCount++;
        lastChar = ch;
        runLen   = 1;
      }
    } else {
      if (runLen >= 2) stackCount++;
      lastChar = '';
      runLen   = 0;
    }
  }
  if (runLen >= 2) stackCount++;

  // Message_Velocity: rough words-per-second estimate.
  // User types ~40 wpm normally. Heavily over-worded = elevated urgency.
  // Score peaks at ~150 wpm equivalent volume (rough heuristic).
  // Normalize: 1 word/sec → 100%, cap at 200%.
  const avgWordLen    = wordCount > 0 ? charCount / wordCount : 0;
  const estimatedWPS  = wordCount / Math.max(avgWordLen / 5, 1); // chars/5s-per-word → wps
  const velocityScore = Math.min((estimatedWPS / 2) * 100, 100); // cap at 100

  // Caps_Ratio: uppercase / total letters
  const capsRatio = letters.length > 0 ? upperCount / letters.length : 0;

  const urgency = (
    (stackCount * 10)   * 0.35 +
    velocityScore       * 0.40 +
    capsRatio  * 100    * 0.25
  );

  return Math.min(Math.round(urgency), 100);
}

// ─── 2. Volumetric Asymmetry ────────────────────────────────────────────────

/**
 * Returns word count ratio.
 * Returns 'High Asymmetry' if ratio > 3.0 (one side dominates 3×+ the other).
 */
function calculateVolumetricRatio(userText, partnerText) {
  const u = wordCount(userText);
  const p = wordCount(partnerText);

  if (u === 0 && p === 0) return 0;
  if (p === 0) return u > 0 ? u : 0;
  if (u === 0) return p > 0 ? p : 0;

  const ratio = u / p;
  return ratio > 3.0 ? 'High Asymmetry' : Math.round(ratio * 100) / 100;
}

// ─── 3. Validation Loop Detection ───────────────────────────────────────────

const VALIDATION_PATTERNS = [
  /are we good/i,
  /did i do something wrong/i,
  /answer me/i,
  /you okay\/?/i,
  /please talk to me/i,
  /are you mad/i,
  /tell me/i,
  /what'?s wrong\/?/i,
  /why won'?t you respond/i,
  /are you still there/i,
];

/**
 * Scans text for reassurance-seeking patterns.
 * Returns count of unique pattern matches (one per pattern, not per occurrence).
 */
function detectValidationLoop(text) {
  let count = 0;
  for (const pattern of VALIDATION_PATTERNS) {
    if (pattern.test(text)) count++;
  }
  return count;
}

// ─── 4. Intercept Lock Trigger ─────────────────────────────────────────────

const INTERCEPT_THRESHOLD = 70;

/**
 * Fires intercept lock if urgency score >= 70.
 * Dispatches a custom DOM event on document so other scripts can listen.
 * No-op if score is below threshold.
 */
function triggerInterceptLock(urgencyScore) {
  if (urgencyScore < INTERCEPT_THRESHOLD) return;

  document.dispatchEvent(new CustomEvent('holdoff:intercept-lock', {
    detail: { urgencyScore, timestamp: Date.now() },
    bubbles: true,
  }));
}

// ─── 5. Main Entry ──────────────────────────────────────────────────────────

/**
 * Runs all metrics on a single text input.
 * @param {string} text - the message being composed
 * @param {string} [partnerText] - optional partner message for volumetric ratio
 * @returns {{ urgencyScore, volumetricRatio, validationLoops, interceptTriggered }}
 */
function analyzeText(text, partnerText) {
  const urgencyScore   = calculateUrgency(text);
  const volumetricRatio = partnerText !== undefined
    ? calculateVolumetricRatio(text, partnerText)
    : null;
  const validationLoops = detectValidationLoop(text);
  const interceptTriggered = urgencyScore >= INTERCEPT_THRESHOLD;

  return {
    urgencyScore,
    volumetricRatio,
    validationLoops,
    interceptTriggered,
  };
}

// ─── Auto-wire to filter page textarea ──────────────────────────────────────
// Listens on `messageInput` (the real textarea id in filter.ejs).
// On every keystroke, runs analyzeText and fires intercept lock if triggered.

(function () {
  const textarea = document.getElementById('messageInput');
  if (!textarea) return;

  // Only wire if not already managed by sandbox.js (filter page has its own input logic)
  // Listen to the native input event
  textarea.addEventListener('input', function () {
    const result = analyzeText(this.value);
    if (result.interceptTriggered) {
      triggerInterceptLock(result.urgencyScore);
    }
  });
})();

// Export for external consumers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calculateUrgency, calculateVolumetricRatio, detectValidationLoop, triggerInterceptLock, analyzeText };
}