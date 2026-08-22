/**
 * HoldOff Service Worker — app-shell cache + push notifications + daily reminders.
 * Owns: static asset caching, offline fallback, push notification display, periodic alarms.
 * Does NOT own: VAPID key management, subscription storage (server-side), reminder copy rotation.
 */

const CACHE_NAME = 'holdoff-v6';

// Increment CACHE_VERSION every bump to force cache refresh
const CACHE_VERSION = 6;

const REMINDER_COPY = [
  "You haven't checked in today. How's your last draft sitting?",
  "Three seconds. That's the whole thing.",
  "Still thinking about that text? Paste it in.",
  "Your grounded voice is available.",
];

function pickReminderCopy() {
  return REMINDER_COPY[Math.floor(Math.random() * REMINDER_COPY.length)];
}

const SHELL_ASSETS = [
  '/',
  '/filter',
  '/quiz',
  '/journal',
  '/css/theme.css',
  '/css/filter.css',
  '/css/quiz.css',
  '/css/journal.css',
  '/css/pwa.css',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-120.png',
  '/icons/icon-152.png',
  '/icons/icon-167.png',
  '/icons/icon-180.png',
  '/icons/apple-touch-icon.png',
  '/manifest.webmanifest',
];

// ── IndexedDB helpers ────────────────────────────────────────────────────────
const DB_NAME = 'holdoff-offline';
const DB_VER = 1;
let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  _db = new Promise(function (resolve, reject) {
    var req = indexedDB.open(DB_NAME, DB_VER);
    req.onerror = function () { reject(req.error); };
    req.onsuccess = function () { resolve(req.result); };
    req.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('verdicts')) {
        db.createObjectStore('verdicts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('journal_entries')) {
        db.createObjectStore('journal_entries', { keyPath: 'id' });
      }
    };
  });
  return _db;
}

function idbGet(store, key) {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(store, 'readonly');
      var req = tx.objectStore(store).get(key);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  });
}

function idbPut(store, record) {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(store, 'readwrite');
      var req = tx.objectStore(store).put(record);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  });
}

function hashMessage(msg) {
  // Simple hash so we can key verdicts by message content
  var str = String(msg || '');
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash = hash & hash;
  }
  return 'msg_' + Math.abs(hash).toString(36);
}

// ── Install: cache the app shell ────────────────────────────────────────────
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// ── Activate: clean up old caches (including legacy naming) ──────────────────
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) {
          // Delete any holdoff-* cache that isn't the current version
          if (k === CACHE_NAME) return false;
          return /^holdoff-/.test(k);
        }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// ── Message handler — immediately claim clients when page requests it ─────────
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'skipWaiting') {
    self.skipWaiting().then(function () {
      return self.clients.claim();
    });
  }
});

// ── Push notification handler ────────────────────────────────────────────────
self.addEventListener('push', function (event) {
  if (!event.data) return;
  var data;
  try {
    data = event.data.json();
  } catch (_) {
    data = { body: event.data.text(), title: 'HoldOff' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'HoldOff', {
      body:    data.body    || '',
      icon:    data.icon    || '/icons/icon-192.png',
      badge:   data.badge   || '/icons/icon-192.png',
      tag:     data.tag     || 'holdoff-notification',
      requireInteraction: false,
      data:    data.data    || {},
    })
  );
});

// ── Notification click — open /filter with textarea focused ──────────────────
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var targetUrl = (event.notification.data && event.notification.data.url) || '/filter?focus=1';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
      for (var i = 0; i < clients.length; i++) {
        var c = clients[i];
        if (c.url.includes('/filter') && 'focus' in c) {
          c.navigate(targetUrl);
          return c.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ── Periodic Sync — daily reminder check (Chrome/Edge only) ──────────────────
self.addEventListener('periodicsync', function (event) {
  if (event.tag === 'holdoff-daily-reminder') {
    event.waitUntil(sendScheduledReminder());
  }
});

// ── Background Sync fallback (Safari/Firefox) ────────────────────────────────
self.addEventListener('sync', function (event) {
  if (event.tag === 'holdoff-daily-reminder-sync') {
    event.waitUntil(sendScheduledReminder());
  }
});

/**
 * Check if current time is within quiet hours.
 * quietHours: { start: "HH:MM", end: "HH:MM" } in 24h time.
 */
function isQuietHours(quietHours) {
  if (!quietHours) return false;
  var now = new Date();
  var currentMins = now.getHours() * 60 + now.getMinutes();
  var startParts = quietHours.start.split(':');
  var endParts   = quietHours.end.split(':');
  var startMins  = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
  var endMins    = parseInt(endParts[0],   10) * 60 + parseInt(endParts[1],   10);

  if (startMins <= endMins) {
    return currentMins >= startMins && currentMins < endMins;
  } else {
    // Quiet hours span midnight (e.g. 23:00 – 08:00)
    return currentMins >= startMins || currentMins < endMins;
  }
}

/**
 * Fetch user preferences from the server and send a reminder if due.
 * Triggered by: periodic sync (Chrome/Edge), background sync, or SW alarm.
 */
async function sendScheduledReminder() {
  try {
    var resp = await fetch('/api/push/my-preferences', { credentials: 'include' });
    if (!resp.ok) return;
    var prefs = await resp.json();
    if (!prefs.enabled) return;
    if (!prefs.has_subscription) return;

    // Respect quiet hours
    var qh = prefs.quiet_hours || { start: '23:00', end: '08:00' };
    if (isQuietHours(qh)) return;

    // Throttle: only send once per 12 hours
    var lastSentRaw = await getLastReminderSent();
    var now = Date.now();
    var twelveHours = 12 * 60 * 60 * 1000;
    if (lastSentRaw && (now - parseInt(lastSentRaw, 10)) < twelveHours) return;

    // Only fire within ±1 hour of the user's chosen reminder time
    var prefTime  = prefs.reminder_time || '9am';
    var targetH   = { '9am': 9, '8pm': 20, '10pm': 22 }[prefTime] || 9;
    var currentH  = new Date().getHours();
    if (Math.abs(currentH - targetH) > 1) return;

    await self.registration.showNotification('HoldOff', {
      body:    pickReminderCopy(),
      icon:    '/icons/icon-192.png',
      badge:   '/icons/icon-192.png',
      tag:     'holdoff-reminder',
      requireInteraction: false,
      data:    { url: '/filter?focus=1' },
    });

    await setLastReminderSent(String(now));
  } catch (err) {
    console.warn('[sw] sendScheduledReminder failed:', err);
  }
}

// SW registration script storage helpers
function getLastReminderSent() {
  return self.registration.active
    .then(function (reg) { return reg.get('last_reminder_sent'); })
    .catch(function () { return null; });
}

function setLastReminderSent(val) {
  return self.registration.active
    .then(function (reg) { return reg.set('last_reminder_sent', val); })
    .catch(function () {});
}

// ── Message handler — receive verdict data from page for offline caching ──────
self.addEventListener('message', function (event) {
  if (!event.data) return;
  var type = event.data.type || '';
  var payload = event.data.payload || {};

  if (type === 'hf:verdict') {
    // Store verdict in IndexedDB keyed by hashed message
    var id = hashMessage(payload.message);
    idbPut('verdicts', {
      id: id,
      message: payload.message || '',
      verdict: payload.verdict || 'HOLD',
      pattern: payload.pattern || '',
      whats_happening: payload.whats_happening || '',
      grounded_voice: payload.grounded_voice || '',
      rewrite: payload.rewrite || '',
      created_at: Date.now(),
    }).catch(function (err) {
      console.warn('[sw] verdict store failed:', err);
    });
    return;
  }

  if (type === 'hf:journal_entries') {
    // Store journal entries in IndexedDB for offline access
    if (Array.isArray(payload.entries)) {
      Promise.all(payload.entries.map(function (entry) {
        return idbPut('journal_entries', entry);
      })).catch(function (err) {
        console.warn('[sw] journal_entries store failed:', err);
      });
    }
    return;
  }

  if (type === 'hf:clear_verdicts') {
    openDB().then(function (db) {
      var tx = db.transaction('verdicts', 'readwrite');
      tx.objectStore('verdicts').clear();
    }).catch(function () {});
    return;
  }
});

// ── Fetch strategy ────────────────────────────────────────────────────────────
self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);

  // API calls — network-first, fall back to offline cached data
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(function () {
        // Network failed — try offline data
        if (url.pathname === '/api/filter/analyze') {
          // Read last cached verdict from IndexedDB
          return idbGet('verdicts', '__latest__').then(function (cached) {
            // Try to find by message hash, or fall back to latest
            var id = hashMessage('');
            return idbGet('verdicts', id).then(function (byMsg) {
              var record = byMsg || cached;
              if (record) {
                return new Response(
                  JSON.stringify({
                    verdict: record.verdict || 'HOLD',
                    pattern: record.pattern || '',
                    whats_happening: record.whats_happening || '',
                    grounded_voice: record.grounded_voice || '',
                    rewrite: record.rewrite || '',
                    cached: true,
                  }),
                  { status: 200, headers: { 'Content-Type': 'application/json' } }
                );
              }
              // No cached verdict — return branded offline response
              return new Response(
                JSON.stringify({
                  error: 'offline',
                  message: "You're offline. Take three breaths. The text can wait.",
                }),
                { status: 503, headers: { 'Content-Type': 'application/json' } }
              );
            });
          }).catch(function () {
            return new Response(
              JSON.stringify({
                error: 'offline',
                message: "You're offline. Take three breaths. The text can wait.",
              }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        }
        return new Response(
          JSON.stringify({ error: 'offline' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Navigation requests — always get fresh pages from network
  // WHY network-first: cache-first for pages was causing stale renders after deploys
  // (users who'd visited before a push saw the old cached page for minutes/hours).
  if (event.request.method === 'GET' && event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function () {
        // Offline: try the cached landing page first, then /filter as fallback
        return caches.match('/').catch(function () { return caches.match('/filter'); });
      })
    );
    return;
  }

  // Static assets + other GETs — cache-first, then network, then offline fallback
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        if (cached) return cached;
        return fetch(event.request).then(function (response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
          }
          return response;
        }).catch(function () {
          return new Response('', { status: 503 });
        });
      })
    );
    return;
  }

  // Default: let request pass through
});
