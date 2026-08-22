const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const KB_FILE = path.join(REPO_ROOT, 'data', 'knowledge', 'backup-knowledge-base.json');

let cache = null;

function safeReadText(absPath) {
  try {
    return fs.readFileSync(absPath, 'utf8');
  } catch {
    return '';
  }
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  const tokens = normalize(text).split(' ').filter(Boolean);
  return new Set(tokens);
}

function scoreEntry(entry, queryTokens) {
  let score = 0;
  for (const token of queryTokens) {
    if (entry.tokens.has(token)) score += 2;
    if (entry.titleTokens.has(token)) score += 3;
    if (entry.topicTokens.has(token)) score += 2;
  }
  return score;
}

function loadKnowledgeBase() {
  if (cache) return cache;

  const raw = safeReadText(KB_FILE);
  const parsed = raw ? JSON.parse(raw) : { entries: [], source_files: [] };

  const staticEntries = (parsed.entries || []).map((entry) => ({
    id: entry.id,
    title: entry.title || 'Knowledge entry',
    topic: entry.topic || 'general',
    text: entry.text || '',
    source: 'seed',
  }));

  const fileEntries = [];
  for (const relPath of parsed.source_files || []) {
    const abs = path.join(REPO_ROOT, relPath);
    const text = safeReadText(abs);
    if (!text) continue;
    fileEntries.push({
      id: `file:${relPath}`,
      title: relPath,
      topic: 'docs',
      text,
      source: relPath,
    });
  }

  const entries = [...staticEntries, ...fileEntries].map((entry) => ({
    ...entry,
    tokens: tokenize(entry.text),
    titleTokens: tokenize(entry.title),
    topicTokens: tokenize(entry.topic),
  }));

  cache = {
    version: parsed.version || 1,
    updatedAt: parsed.updated_at || null,
    entries,
  };
  return cache;
}

function searchKnowledge(query, limit = 3) {
  const kb = loadKnowledgeBase();
  const queryTokens = tokenize(query);
  const ranked = kb.entries
    .map((entry) => ({ entry, score: scoreEntry(entry, queryTokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry }) => ({
      id: entry.id,
      title: entry.title,
      topic: entry.topic,
      source: entry.source,
      snippet: entry.text.slice(0, 400),
    }));
  return ranked;
}

function buildGroundedSnippet(query, fallbackText) {
  const hits = searchKnowledge(query, 2);
  const grounded = hits.map((h) => `${h.title}: ${h.snippet}`).join('\n\n');
  return {
    text: grounded ? `${fallbackText}\n\n${grounded}` : fallbackText,
    hits,
  };
}

module.exports = {
  loadKnowledgeBase,
  searchKnowledge,
  buildGroundedSnippet,
};
