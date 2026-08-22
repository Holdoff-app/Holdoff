/**
 * Message Interpreter Route for HoldOff
 * Analyzes INCOMING messages:
 * 1. How they MEANT it (sender's actual intent)
 * 2. How YOUR conditions distort it (your misread despite intent)
 * 3. Truth check (what's actually happening)
 * 4. Red/Yellow/Green flags (behavior pattern analysis)
 * 5. Relationship & compatibility analysis
 * 6. 3 safe response options (grounded in their intent)
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../lib/auth');
const OpenAI = require('openai');
const db = require('../db/messages');
const { buildInterpretFallback } = require('../services/resilient-ai');
const { isCapabilityAvailable } = require('../config/dependency-policy');

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * POST /api/interpreter
 * Analyze incoming message through Interpreter lens
 * Body: { message, senderName, userConditions?, threadHistory?, userId? }
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { message, senderName, userConditions = [], threadHistory = [], userId } = req.body;

    if (!message || !senderName) {
      return res.status(400).json({ error: 'Message and senderName required' });
    }

    // Auto-fetch user conditions from DB if not provided
    let conditionList = Array.isArray(userConditions) ? userConditions : [];
    if (conditionList.length === 0 && userId) {
      try {
        conditionList = await db.getUserConditions(userId);
      } catch (err) {
        console.error('Error fetching user conditions:', err);
        conditionList = [];
      }
    }

    // Build context from thread history
    const recentHistory = threadHistory.slice(-10).map(m => ({
      sender: m.senderType === 'user' ? 'You' : senderName,
      body: m.body,
    }));

    const historyContext = recentHistory.length > 0
      ? `\n\nRecent conversation history:\n${recentHistory.map(m => `${m.sender}: ${m.body}`).join('\n')}`
      : '';

    const userConditionsText = conditionList.length > 0
      ? `User's diagnosed conditions: ${conditionList.join(', ')}`
      : 'User has not disclosed specific conditions yet.';

    const prompt = `You are a relationship intelligence assistant for HoldOff, a mental health companion app for mindful messaging.

${userConditionsText}

Analyze this INCOMING message from "${senderName}":
"${message}"${historyContext}

Provide a DEEP relationship & compatibility analysis with the following structure:

**1. THEIR INTENT (How they meant it)**
- What the sender likely intended to communicate
- Their emotional state when sending it
- What they probably wanted to express

**2. YOUR CONDITION LENS (How you might distort it)**
- Specific ways your conditions (${conditionList.join(', ') || 'if any'}) could cause misinterpretation
- Catastrophizing patterns to watch for
- Attachment wounds this might trigger

**3. TRUTH CHECK (What's actually happening)**
- Grounded, realistic interpretation
- What they probably meant vs. worst-case spiral
- Evidence from message tone/content

**4. RED FLAGS (Behavior patterns indicating harm)**
- Manipulation, gaslighting, dismissal
- Boundary violations
- Patterns of hurt or inconsistency
- Love-bombing followed by withdrawal

**5. YELLOW FLAGS (Caution signs)**
- Mixed signals or inconsistency
- Avoidant patterns
- Unmet expectations
- Communication style mismatches

**6. GREEN FLAGS (Positive patterns)**
- Genuine care and consistency
- Healthy boundaries
- Emotional availability
- Reliable follow-through

**7. RELATIONSHIP ANALYSIS**
- Attachment style compatibility (if knowable from history)
- Communication style fit
- Values alignment
- Long-term compatibility assessment

**8. VERDICT (Overall assessment)**
- Is this person safe/healthy for you right now?
- Risk level: Low/Medium/High
- Trust level: Growing/Stable/Declining

Then provide:

**3 SAFE RESPONSE OPTIONS** (grounded in what they actually meant):
- Option 1: [Authentic response]
- Option 2: [Boundary-setting response]
- Option 3: [Vulnerable/opening response]

Format as JSON with these keys:
{
  "theirIntent": "...",
  "yourDistortion": "...",
  "truthCheck": "...",
  "redFlags": ["flag1", "flag2"],
  "yellowFlags": ["flag1", "flag2"],
  "greenFlags": ["flag1", "flag2"],
  "relationshipAnalysis": "...",
  "verdict": { "isSafe": true/false, "riskLevel": "Low/Medium/High", "trustLevel": "Growing/Stable/Declining" },
  "responseOptions": [
    { "label": "Option 1", "text": "..." },
    { "label": "Option 2", "text": "..." },
    { "label": "Option 3", "text": "..." }
  ]
}`;

    const aiResult = await callAI({
      systemPrompt: prompt,
      userContent: 'Analyze the message above and return the JSON response.',
      maxTokens: 2000
    });

    if (!aiResult) {
      return res.json({
        message,
        senderName,
        analysis: buildInterpretFallback(message),
      });
    }

    const aiContent = aiResult.content;

    // Parse JSON from response
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Claude response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    res.json({
      message,
      senderName,
      analysis,
    });
  } catch (err) {
    console.error('[API /interpreter] Error:', err.message);
    res.status(200).json({
      message: req.body?.message || '',
      senderName: req.body?.senderName || '',
      analysis: buildInterpretFallback(req.body?.message || ''),
    });
  }
});

module.exports = router;

