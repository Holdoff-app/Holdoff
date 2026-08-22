/**
 * Builds the render context passed to `views/layout.ejs`.
 *
 *   slug:             Site slug (from HOLDOFF_ANALYTICS_SLUG env). Use for
 *                     titles, canonical URLs.
 *   theme:            Theme tokens object. Reserved for future use.
 *   themeCSS:         HTML chunk that loads the site stylesheet(s).
 *                     Currently emits one `<link rel="stylesheet">` per
 *                     file under public/css/. Use in the layout via
 *                     `<%- themeCSS %>` — do not wrap in `<style>`.
 *   analyticsSnippet: HTML chunk with the analytics tracking `<script>`.
 *                     Use via `<%- analyticsSnippet %>` near `</body>` —
 *                     do not wrap in `<script>`.
 *
 * CSS files are read on each request. The directory is tiny (typically one
 * file) and the read is negligible compared to render time. Memoize at boot
 * if it ever becomes a hot path.
 */
const fs = require('fs');
const path = require('path');

const CSS_DIR = path.join(__dirname, '..', 'public', 'css');

function buildThemeCSS() {
  if (!fs.existsSync(CSS_DIR)) return '';
  const files = fs
    .readdirSync(CSS_DIR)
    .filter((f) => f.endsWith('.css'))
    .sort();
  if (files.length === 0) return '';
  return files.map((f) => `<link rel="stylesheet" href="/css/${f}">`).join('\n');
}

function buildAnalyticsSnippet(slug) {
  if (!slug) return '';
  const slugJson = JSON.stringify(slug);
  return `<!-- Analytics removed -->`;
}

function buildLandingContext({ user, ...extra } = {}) {
  const slug = process.env.HOLDOFF_ANALYTICS_SLUG || '';
  return {
    slug,
    theme: {},
    themeCSS: buildThemeCSS(),
    analyticsSnippet: buildAnalyticsSnippet(slug),
    user: user || null,
    // Convenience field for JS paywall checks — avoids complex EJS conditionals
    userTier: user?.membership_type || '',
    ...extra,
  };
}

module.exports = { buildLandingContext, buildThemeCSS, buildAnalyticsSnippet };
