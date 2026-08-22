/**
 * Verification script — tests verdict diversity across 12 canonical messages.
 * Run: node verify-diversity.js
 */
const TEST_MESSAGES = [
  { msg: "hey, did you get my last text?", context: "", label: "late-night double-text" },
  { msg: "why were you with her last night", context: "", label: "jealous accusation" },
  { msg: "hey just checking in, hope you're having a good day", context: "", label: "calm midday check-in" },
  { msg: "we need to talk. if you can't commit to being there for me I think we should break up", context: "", label: "breakup ultimatum" },
  { msg: "are we okay? things felt weird earlier", context: "", label: "are-we-okay after disagreement" },
  { msg: "what time should I pick you up tomorrow?", context: "", label: "pure logistics" },
  { msg: "I'm so sorry, I'm always doing this, I know I'm too much", context: "", label: "apology spiral" },
  { msg: "hey it's been a few days, how have you been?", context: "", label: "re-engagement after silence" },
  { msg: "do you still love me? sometimes I feel like you don't", context: "", label: "reassurance-seeking" },
  { msg: "you don't fucking listen to me ever, I'm done", context: "", label: "angry rant draft" },
  { msg: "I need some space but I still want to hear from you", context: "", label: "boundary statement" },
  { msg: "should I send this message?", context: "I'm drafting this to send to my boyfriend at 11pm", label: "meta-question" },
];

async function analyze(message, context = "") {
  const resp = await fetch('https://shouldiholdoff.live/api/filter/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context }),
  });
  return resp.json();
}

async function run() {
  console.log('Testing verdict diversity across 12 canonical messages...\n');
  console.log('=' .repeat(80));

  const results = [];
  for (const { msg, context, label } of TEST_MESSAGES) {
    try {
      const result = await analyze(msg, context);
      results.push({ label, msg, result });
      console.log(`\n[${label}]`);
      console.log(`  Input: "${msg.slice(0, 60)}${msg.length > 60 ? '...' : ''}"`);
      console.log(`  verdict:        ${result.verdict}`);
      console.log(`  pattern:        ${result.pattern}`);
      console.log(`  whats_happening:${(result.whats_happening || '').slice(0, 80)}`);
      console.log(`  grounded_voice: ${(result.grounded_voice || '').slice(0, 80)}`);
      console.log(`  rewrite:       ${(result.rewrite || '').slice(0, 80)}`);
      console.log(`  verdict_source: ${result.verdict_source}`);
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      results.push({ label, msg, error: err.message });
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\nDIVERSITY SUMMARY:');
  const verdicts = results.filter(r => r.result).map(r => r.result.verdict);
  const patterns = results.filter(r => r.result).map(r => r.result.pattern);
  const sources = results.filter(r => r.result).map(r => r.result.verdict_source);

  console.log(`  Verdicts:   ${[...new Set(verdicts)].join(', ')}`);
  console.log(`  Patterns:  ${[...new Set(patterns)].join(' | ')}`);
  console.log(`  Sources:   ${[...new Set(sources)].join(', ')}`);
  console.log(`  Unique patterns: ${new Set(patterns).size}/12`);

  if (new Set(patterns).size <= 3) {
    console.log('\n  ⚠️  WARNING: Pattern diversity is LOW — likely templated output!');
  } else {
    console.log('\n  ✓ Pattern diversity looks healthy');
  }
}

run().catch(console.error);