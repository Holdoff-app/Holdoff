/**
 * HoldOff Sandbox — client-side intercept trial for unauthenticated landing page visitors.
 * Zero backend calls. Zero auth required. Fully self-contained.
 */
(function () {
  'use strict';

  const SESSION_KEY = 'holdoff_sandbox_trial';

  // ─── Urgency flag detectors ────────────────────────────────────────────────

  function wordCount(text) {
    return text.trim().split(/\n|\r|\n\r|\r\n/).join(' ').split(/\b/).filter(Boolean).length;
  }

  function flagWordCount(text) {
    return wordCount(text) > 20;
  }

  function flagUppercase(text) {
    const letters = text.replace(/[^a-zA-Z]/g, '');
    if (letters.length < 4) return false;
    const upper = letters.replace(/[A-Z]/g, '').length;
    return (letters.length - upper) / letters.length > 0.30;
  }

  function flagRepeatedQuestions(text) {
    return (text.match(/\u003F/g) || []).length >= 2;
  }

  function flagApology(text) {
    const lower = text.toLowerCase();
    return lower.includes("i'm sorry") || lower.includes("im sorry") || lower.includes("sorry");
  }

  function flagSpiral(text) {
    const lower = text.toLowerCase();
    return lower.includes("i can't stop") || lower.includes("i cant stop") || lower.includes("i miss you");
  }

  function flagAnxiety(text) {
    const lower = text.toLowerCase();
    return lower.includes("are you mad") || lower.includes("do you hate") || lower.includes("did i do something wrong") || lower.includes("what did i do");
  }

  function getFlags(text) {
    return {
      wordCount: flagWordCount(text),
      uppercase: flagUppercase(text),
      repeatedQuestions: flagRepeatedQuestions(text),
      apology: flagApology(text),
      spiral: flagSpiral(text),
      anxiety: flagAnxiety(text),
    };
  }

  function countFlags(flags) {
    return Object.values(flags).filter(Boolean).length;
  }

  // ─── DOM elements ───────────────────────────────────────────────────────────

  const container   = document.getElementById('sandbox-container');
  const textarea    = document.getElementById('sandbox-textarea');
  const testBtn     = document.getElementById('sandbox-test-btn');
  const verdictZone = document.getElementById('sandbox-verdict');
  const modal       = document.getElementById('sandbox-modal');
  const modalBody   = document.getElementById('sandbox-modal-body');
  const modalCta    = document.getElementById('sandbox-modal-cta');
  const paywallCta  = document.getElementById('sandbox-paywall');

  if (!container || !textarea || !testBtn || !verdictZone || !modal || !modalBody || !modalCta || !paywallCta) {
    return; // not on this page
  }

  // ─── Countdown ─────────────────────────────────────────────────────────────

  function runCountdown(callback) {
    let remaining = 5;
    modalBody.dataset.countdown = '5';
    modalBody.classList.add('sandbox-modal__body--counting');

    const tick = setInterval(function () {
      remaining--;
      modalBody.dataset.countdown = String(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        modalBody.classList.remove('sandbox-modal__body--counting');
        callback();
      }
    }, 1000);
  }

  // ─── Intercept trigger ─────────────────────────────────────────────────────

  function triggerIntercept(text) {
    textarea.disabled = true;
    testBtn.disabled = true;

    // Stamp session
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ts: Date.now(), intercepted: true })); } catch (e) {}

    modal.classList.add('is-open');

    runCountdown(function () {
      // Show behavioral profile
      var profile = document.createElement('div');
      profile.className = 'sandbox-modal__profile';
      var badge = document.createElement('div');
      badge.className = 'sandbox-modal__badge';
      badge.textContent = 'Anxious-Preoccupied pattern detected';
      var profileText = document.createElement('p');
      profileText.className = 'sandbox-modal__profile-text';
      profileText.appendChild(document.createTextNode('Your texting spikes at night.'));
      profileText.appendChild(document.createElement('br'));
      profileText.appendChild(document.createTextNode('You overexplain. You send when you should wait.'));
      profile.appendChild(badge);
      profile.appendChild(profileText);
      var finalP = document.createElement('p');
      finalP.className = 'sandbox-modal__final';
      finalP.textContent = 'Send it? Or wait until morning?';
      modalBody.textContent = '';
      modalBody.appendChild(profile);
      modalBody.appendChild(finalP);
      modalCta.textContent = 'Wait until morning';
      modalCta.style.display = 'inline-block';

      // Show paywall
      paywallCta.style.display = 'block';
    });
  }

  // ─── Input handler ─────────────────────────────────────────────────────────

  testBtn.addEventListener('click', function () {
    const text = textarea.value.trim();
    if (!text) return;

    const flags = getFlags(text);
    const flagCount = countFlags(flags);

    if (flagCount >= 2) {
      triggerIntercept(text);
    } else {
      // Safe message — green verdict
      textarea.disabled = true;
      testBtn.disabled = true;
      verdictZone.style.display = 'block';
      var verdict = document.createElement('div');
      verdict.className = 'sandbox-verdict sandbox-verdict--safe';
      var icon = document.createElement('div');
      icon.className = 'sandbox-verdict__icon';
      icon.textContent = '\u2713';
      var label = document.createElement('p');
      label.className = 'sandbox-verdict__label';
      label.textContent = 'Low urgency \u2014 you\u2019re good to send.';
      var note = document.createElement('p');
      note.className = 'sandbox-verdict__note';
      note.textContent = 'Want to see what high-urgency looks like? Try: \u201cHey, are you mad at me? I\u2019m sorry, I can\u2019t stop thinking about this. Please tell me something. What did I do??\u201d';
      verdict.appendChild(icon);
      verdict.appendChild(label);
      verdict.appendChild(note);
      verdictZone.appendChild(verdict);
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ts: Date.now(), intercepted: false })); } catch (e) {}
    }
  });

  // Allow Ctrl/Cmd + Enter to submit
  textarea.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      testBtn.click();
    }
  });

})();