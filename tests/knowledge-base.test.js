const assert = require('assert');
const { loadKnowledgeBase, searchKnowledge, buildGroundedSnippet } = require('../services/knowledge-base');

function run() {
  const kb = loadKnowledgeBase();
  assert(kb.entries.length > 0, 'knowledge base should have entries');

  const hits = searchKnowledge('mental health boundary and diagnosis', 3);
  assert(hits.length > 0, 'search should return at least one hit');

  const grounded = buildGroundedSnippet('pause before sending anxious text', 'fallback');
  assert(typeof grounded.text === 'string' && grounded.text.length > 0, 'grounded snippet should include text');
  assert(Array.isArray(grounded.hits), 'grounded snippet should include hits array');

  console.log('knowledge-base tests passed');
}

run();
