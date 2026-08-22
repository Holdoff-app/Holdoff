/*
 * Floating Sadie + Dan companions
 * Injects two small chat-bubble stickers in the corner of every page.
 * Dismissible (per-tab via sessionStorage). Mobile-friendly.
 */
(function () {
  if (window.__holdoffCompanions) return;
  window.__holdoffCompanions = true;

  // Don't inject inside the actual companion chat page (would be redundant)
  if (/\/companion(\b|\/|\?)/.test(location.pathname)) return;

  // Respect a per-tab dismiss
  if (sessionStorage.getItem('hideFloatingCompanions') === '1') return;

  var css = ''
    + '.holdoff-companions{position:fixed;right:16px;bottom:16px;z-index:9990;display:flex;flex-direction:column;gap:10px;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}'
    + '.holdoff-companion{pointer-events:auto;display:flex;align-items:flex-end;gap:8px;transform:translateY(8px);opacity:0;transition:transform .35s ease,opacity .35s ease}'
    + '.holdoff-companion.show{transform:translateY(0);opacity:1}'
    + '.holdoff-companion .bubble{background:linear-gradient(135deg,#1a0033,#2d1b4e);color:#f0e6d2;border:1px solid rgba(167,139,250,.35);padding:8px 12px;border-radius:14px 14px 4px 14px;font-size:13px;max-width:200px;line-height:1.35;box-shadow:0 6px 20px rgba(0,0,0,.4);position:relative;display:none}'
    + '.holdoff-companion.expanded .bubble{display:block}'
    + '.holdoff-companion .bubble a{color:#c4b5fd;text-decoration:none;font-weight:600}'
    + '.holdoff-companion .bubble a:hover{text-decoration:underline}'
    + '.holdoff-companion .sticker{width:64px;height:64px;border-radius:50%;background:rgba(45,27,78,.55);border:2px solid rgba(167,139,250,.55);overflow:hidden;cursor:pointer;flex-shrink:0;box-shadow:0 6px 20px rgba(0,0,0,.5);backdrop-filter:blur(8px)}'
    + '.holdoff-companion .sticker img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;background:transparent}'
    + '.holdoff-companion .close{position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#2d1b4e;color:#f0e6d2;border:1px solid rgba(167,139,250,.5);font-size:12px;line-height:18px;text-align:center;cursor:pointer;display:none}'
    + '.holdoff-companion.expanded .close{display:block}'
    + '.holdoff-dismiss-all{pointer-events:auto;align-self:flex-end;font-size:10px;color:rgba(240,230,210,.45);background:transparent;border:none;cursor:pointer;padding:2px 6px}'
    + '.holdoff-dismiss-all:hover{color:#c4b5fd}'
    + '@media(max-width:480px){.holdoff-companion .sticker{width:54px;height:54px}.holdoff-companion .bubble{font-size:12px;max-width:160px}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var sadieLines = [
    "Hey 💜 want me to read the room?",
    "I notice patterns. Want to look together?",
    "I'm here whenever you need to pause.",
    "You don't have to send it right away."
  ];
  var danLines = [
    "Real talk — what's actually going on?",
    "I'll be the mirror you didn't ask for.",
    "What would your future self say here?",
    "Take the pause. Then decide."
  ];
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function makeCompanion(soul, line, imgSrc) {
    var companion = document.createElement('div');
    companion.className = 'holdoff-companion';
    companion.dataset.soul = soul;

    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.appendChild(document.createTextNode(line + ' '));
    var link = document.createElement('a');
    link.href = '/companion?soul=' + soul;
    link.textContent = 'Chat with ' + soul + ' \u2192';
    var closeSpan = document.createElement('span');
    closeSpan.className = 'close';
    closeSpan.title = 'hide';
    closeSpan.textContent = '\u00d7';
    bubble.appendChild(link);
    bubble.appendChild(closeSpan);

    var sticker = document.createElement('div');
    sticker.className = 'sticker';
    sticker.title = 'Chat with ' + soul;
    var img = document.createElement('img');
    img.src = imgSrc;
    img.alt = soul;
    sticker.appendChild(img);

    companion.appendChild(bubble);
    companion.appendChild(sticker);
    return companion;
  }

  var wrap = document.createElement('div');
  wrap.className = 'holdoff-companions';
  wrap.appendChild(makeCompanion('Dan', pick(danLines), '/assets/DAN_COMPANION.png'));
  wrap.appendChild(makeCompanion('Sadie', pick(sadieLines), '/assets/SADIE_COMPANION.png'));
  var dismissBtn = document.createElement('button');
  dismissBtn.className = 'holdoff-dismiss-all';
  dismissBtn.title = 'hide companions';
  dismissBtn.textContent = 'hide';
  wrap.appendChild(dismissBtn);

  function init() {
    document.body.appendChild(wrap);
    var nodes = wrap.querySelectorAll('.holdoff-companion');
    // Stagger entrance
    nodes.forEach(function (n, i) {
      setTimeout(function () { n.classList.add('show'); }, 250 + i * 200);
      n.querySelector('.sticker').addEventListener('click', function () {
        n.classList.toggle('expanded');
      });
      n.querySelector('.close').addEventListener('click', function (e) {
        e.stopPropagation();
        n.classList.remove('expanded');
      });
    });
    wrap.querySelector('.holdoff-dismiss-all').addEventListener('click', function () {
      sessionStorage.setItem('hideFloatingCompanions', '1');
      wrap.remove();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
