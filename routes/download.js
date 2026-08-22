/**
 * Download route — APK file download for Android app.
 * Owns: GET /api/download/android
 * Points to latest GitHub Release APK.
 */
const express = require('express');
const router = express.Router();

const GITHUB_RELEASES_URL = 'https://github.com/stacyfoster30-design/Holdoff/releases/latest/download/HoldOff-release.apk';

router.get('/android', async (_req, res) => {
  try {
    // Check if a release APK exists by hitting the GitHub API
    const https = require('https');
    const checkUrl = 'https://api.github.com/repos/stacyfoster30-design/Holdoff/releases/latest';
    
    const options = {
      hostname: 'api.github.com',
      path: '/repos/stacyfoster30-design/Holdoff/releases/latest',
      headers: { 'User-Agent': 'HoldOff-App/1.0' }
    };

    https.get(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        try {
          const release = JSON.parse(data);
          const apkAsset = (release.assets || []).find(a => a.name.endsWith('.apk'));
          if (apkAsset) {
            res.redirect(301, apkAsset.browser_download_url);
          } else {
            // No APK yet — redirect to download page with building notice
            res.redirect(302, '/download?building=1');
          }
        } catch (e) {
          res.redirect(302, '/download?building=1');
        }
      });
    }).on('error', () => {
      res.redirect(302, '/download?building=1');
    });
  } catch (err) {
    res.redirect(302, '/download?building=1');
  }
});

module.exports = router;
