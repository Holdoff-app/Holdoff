/**
 * Autonomous AI Agent — HoldOff.
 *
 * Implements a ReAct (Reasoning + Acting) loop.  The agent thinks, picks a
 * tool, executes it, observes the result, and repeats until it produces a
 * Final Answer — or exhausts MAX_STEPS.
 *
 * Available tools (injected via the tool registry):
 *   analyze_message        — run the verdict engine on a text snippet
 *   get_attachment_profile — fetch the user's quiz-derived attachment style
 *   get_journal_patterns   — top recurring patterns from the user's journal
 *   get_verdict_history    — recent verdict records for the user
 *   get_streak             — current hold-off streak for the user
 */

const { callAI } = require('../services/ai-provider');
const { getQuizResult } = require('../db/quiz');
const { getEntries: getJournalEntries } = require('../db/journal');
const { getVerdictHistory, getStreak } = require('../db/verdict-history');

const ANALYZE_SYSTEM_PROMPT = `You are the HoldOff verdict engine. Analyze the message below and respond with ONLY valid JSON — no markdown, no explanation. Schema:
{
  "verdict": "HOLD" | "SEND" | "REWRITE",
  "pattern": "<short attachment-style pattern name>",
  "reframe": "<one empathetic sentence reframing the impulse>",
  "confidence": 0.0-1.0
}`;

const MAX_STEPS = 6;

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = {
  analyze_message: {
    description: 'Analyze a text message with the HoldOff verdict engine. Returns verdict (HOLD/SEND/REWRITE), pattern name, and a reframe suggestion.',
    params: '{ "message": "<text to analyze>" }',
    async run({ message }, _userId) {
      if (!message) return { error: 'message is required' };
      try {
        const aiResult = await callAI({
          systemPrompt: ANALYZE_SYSTEM_PROMPT,
          userContent: `Message: ${message}`,
          maxTokens: 256,
        });
        if (!aiResult) return { error: 'AI provider unavailable' };
        let parsed;
        try { parsed = JSON.parse(aiResult.content); } catch (_) { parsed = { raw: aiResult.content }; }
        return parsed;
      } catch (err) {
        return { error: err.message };
      }
    },
  },

  get_attachment_profile: {
    description: "Fetch the user's attachment style quiz result (primary + secondary style and scores). Requires the user to be logged in.",
    params: '{}',
    async run(_params, userId) {
      if (!userId) return { error: 'Not authenticated' };
      try {
        const result = await getQuizResult(userId);
        if (!result) return { profile: null, note: 'No quiz result on file.' };
        return {
          primaryStyle: result.primary_style,
          secondaryStyle: result.secondary_style,
          scores: result.scores,
          completedAt: result.completed_at,
        };
      } catch (err) {
        return { error: err.message };
      }
    },
  },

  get_journal_patterns: {
    description: "Retrieve the user's 10 most recent journal entries — trigger text, pattern name, and verdict. Requires login.",
    params: '{}',
    async run(_params, userId) {
      if (!userId) return { error: 'Not authenticated' };
      try {
        const entries = await getJournalEntries(userId, 10, 0);
        return entries.map(e => ({
          pattern: e.pattern_name,
          verdict: e.verdict,
          trigger: e.trigger_text,
          createdAt: e.created_at,
        }));
      } catch (err) {
        return { error: err.message };
      }
    },
  },

  get_verdict_history: {
    description: "Retrieve the user's 10 most recent verdict records (verdict type, pattern, attachment style). Requires login.",
    params: '{}',
    async run(_params, userId) {
      if (!userId) return { error: 'Not authenticated' };
      try {
        const { entries } = await getVerdictHistory(userId, { limit: 10 });
        return entries.map(e => ({
          verdict: e.verdict,
          pattern: e.pattern_name,
          attachmentStyle: e.attachment_style,
          createdAt: e.created_at,
        }));
      } catch (err) {
        return { error: err.message };
      }
    },
  },

  get_streak: {
    description: "Return the user's current hold-off streak (days held off in a row) and lifetime stats. Requires login.",
    params: '{}',
    async run(_params, userId) {
      if (!userId) return { error: 'Not authenticated' };
      try {
        return await getStreak(userId);
      } catch (err) {
        return { error: err.message };
      }
    },
  },
};

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt() {
  const toolList = Object.entries(TOOLS)
    .map(([name, t]) => `- ${name}(${t.params}): ${t.description}`)
    .join('\n');

  return `You are an autonomous AI agent embedded in HoldOff — an app that helps people with insecure attachment styles pause before sending regrettable texts.

Your job: reason step-by-step, use the available tools to gather information, and then produce a clear, empathetic Final Answer that genuinely helps the user.

## Available tools
${toolList}

## Output format (STRICT)
Each step must be ONE of:

Thought: <your internal reasoning — what you know and what you need next>
Action: <tool_name>
Action Input: <valid JSON matching the tool's params>

…after receiving the Observation, continue with the next Thought/Action pair.

When you have enough information:

Thought: I now have everything I need.
Final Answer: <your complete, empathetic, actionable response to the user>

Rules:
- Never skip the "Thought:" prefix before "Action:" or "Final Answer:".
- Action Input must be valid JSON.
- Max ${MAX_STEPS} action steps. If you hit the limit, give your best Final Answer with the information you have.
- Be warm, non-judgmental, and attachment-aware in the Final Answer.`;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse the LLM's raw text to extract:
 *   { type: 'action', tool, input }  — the agent wants to call a tool
 *   { type: 'final', answer }        — the agent has a final answer
 *   { type: 'unknown' }              — couldn't parse (treat as final with raw text)
 */
function parseAgentOutput(text) {
  // Check for Final Answer first
  const finalMatch = text.match(/Final Answer:\s*([\s\S]+?)(?:\n\nThought:|$)/i);
  if (finalMatch) {
    return { type: 'final', answer: finalMatch[1].trim() };
  }

  // Check for Action
  const actionMatch = text.match(/Action:\s*(\w+)/i);
  const inputMatch = text.match(/Action Input:\s*(\{[\s\S]*?\})/i);

  if (actionMatch) {
    const tool = actionMatch[1].trim();
    let input = {};
    if (inputMatch) {
      try { input = JSON.parse(inputMatch[1]); } catch (_) { input = {}; }
    }
    return { type: 'action', tool, input };
  }

  // Fall back — treat the whole response as a Final Answer
  return { type: 'final', answer: text.trim() };
}

// ─── Agent runner ─────────────────────────────────────────────────────────────

/**
 * Run the autonomous agent.
 *
 * @param {string}      task      — the user's request / task description
 * @param {number|null} userId    — authenticated user ID (null for anonymous)
 * @param {string[]}    [context] — optional extra context lines
 * @returns {Promise<{ answer: string, steps: object[], stepsUsed: number }>}
 */
async function runAgent(task, userId = null, context = []) {
  const systemPrompt = buildSystemPrompt();
  const steps = [];

  // Seed the conversation with the user's task
  const conversationHistory = [
    { role: 'user', content: `Task: ${task}${context.length ? '\n\nContext:\n' + context.join('\n') : ''}` },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    // Ask the LLM for the next step
    const aiResult = await callAI({
      systemPrompt,
      userContent: conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`).join('\n\n'),
      maxTokens: 1000,
    });

    if (!aiResult) {
      steps.push({ step, type: 'error', message: 'AI provider unavailable' });
      break;
    }

    const raw = aiResult.content;
    const parsed = parseAgentOutput(raw);

    steps.push({ step, raw, ...parsed });

    if (parsed.type === 'final') {
      return { answer: parsed.answer, steps, stepsUsed: step + 1 };
    }

    if (parsed.type === 'action') {
      const toolDef = TOOLS[parsed.tool];
      let observation;

      if (!toolDef) {
        observation = { error: `Unknown tool: ${parsed.tool}. Available tools: ${Object.keys(TOOLS).join(', ')}` };
      } else {
        try {
          observation = await toolDef.run(parsed.input, userId);
        } catch (err) {
          observation = { error: err.message };
        }
      }

      steps[steps.length - 1].observation = observation;

      // Feed the observation back into the conversation
      conversationHistory.push({ role: 'assistant', content: raw });
      conversationHistory.push({
        role: 'user',
        content: `Observation: ${JSON.stringify(observation, null, 2)}`,
      });
    }
  }

  // Exhausted steps — produce a best-effort answer from the last raw output
  const lastStep = steps[steps.length - 1];
  const fallbackAnswer = lastStep?.answer || lastStep?.raw || 'I was unable to complete the task within the allowed steps.';

  return { answer: fallbackAnswer, steps, stepsUsed: MAX_STEPS };
}

module.exports = { runAgent, TOOLS, MAX_STEPS };
