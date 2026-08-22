/**
 * Shared AI provider with automatic fallback
 * Chain: OpenAI → Anthropic → null
 * 
 * When OpenAI returns 429 (quota exceeded), automatically tries Anthropic.
 */

const OpenAI = require('openai');

let Anthropic;
try { Anthropic = require('@anthropic-ai/sdk'); } catch (_) { Anthropic = null; }

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 10000, maxRetries: 0 })
  : null;

const anthropicClient = (Anthropic && process.env.ANTHROPIC_API_KEY)
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 12000, maxRetries: 0 })
  : null;

/**
 * callAI — unified chat completion with automatic provider fallback
 * @param {Object} opts
 * @param {string} opts.systemPrompt - System message content
 * @param {string} opts.userContent  - User message content
 * @param {string} [opts.model]      - Preferred OpenAI model (default: gpt-4o-mini)
 * @param {number} [opts.maxTokens]  - Max tokens (default: 800)
 * @returns {Promise<{content: string, source: string}|null>}
 */
async function callAI({ systemPrompt, userContent, model = 'gpt-4o-mini', maxTokens = 800 }) {
  // 1. Try OpenAI
  if (openaiClient) {
    try {
      const response = await openaiClient.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      });
      const content = response.choices[0]?.message?.content || '';
      return { content, source: 'openai' };
    } catch (err) {
      const status = err?.status || err?.response?.status;
      console.error(`[ai-provider] OpenAI failed (${status || err.message})`);
      // Only fall through on quota/rate/server errors
      if (![429, 500, 502, 503].includes(status) && !err.message?.includes('quota')) {
        // For other errors (bad request, auth), don't retry with Anthropic
        if (status === 401 || status === 403) {
          console.error('[ai-provider] OpenAI auth error — falling through to Anthropic');
        } else if (status === 400) {
          return null; // Bad request, won't help to retry
        }
      }
    }
  }

  // 2. Try Anthropic
  if (anthropicClient) {
    try {
      const response = await anthropicClient.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userContent },
        ],
      });
      const content = response.content?.[0]?.text || '';
      return { content, source: 'anthropic' };
    } catch (err) {
      console.error(`[ai-provider] Anthropic failed: ${err.message}`);
    }
  }

  // 3. Both failed
  console.error('[ai-provider] All providers failed');
  return null;
}

module.exports = { callAI };
