/**
 * Elemental Evolves — ship layer (GitHub Pages / itch static).
 * Thin wrappers around the minified lab build: PWA register, tab pause,
 * localStorage extras, install chip, version stamp.
 */
(function () {
  'use strict';

  // --- Build stamp (rewritten at push time) ---
  var EE_SHIP_VERSION = '2026-09-15 7fca092';

  // Extra persist keys (lab already uses ee-muted, ee-best-run)
  var KEY_FACTION = 'ee-last-faction';
  var KEY_MATCH = 'ee-last-match';
  var KEY_HOWTO = 'ee-howto-seen';
  var KEY_CHIP = 'ee-install-chip-dismissed';

  var FACTIONS = ['Fire', 'Water', 'Earth', 'Light', 'Dark'];
  var FACTION_IDS = { fire: 'Fire', water: 'Water', earth: 'Earth', light: 'Light', dark: 'Dark' };

  // ---------------------------------------------------------------------------
  // Tab / background pause
  // Lab game exposes window.__ee with phase + togglePause(). Prefer that.
  // Fallback: gate requestAnimationFrame while document is hidden.
  // ---------------------------------------------------------------------------
  var pausedByShip = false;
  var rafWrapped = false;
  var nativeRaf = window.requestAnimationFrame.bind(window);
  var nativeCancel = window.cancelAnimationFrame.bind(window);
  var pendingRaf = [];

  function game() {
    return typeof window.__ee !== 'undefined' ? window.__ee : null;
  }

  function pauseForBackground() {
    var g = game();
    if (g && typeof g.togglePause === 'function' && g.phase === 'playing') {
      g.togglePause();
      pausedByShip = true;
      return;
    }
    // Fallback rAF gate (only if we could not use __ee)
    ensureRafGate(true);
  }

  function resumeFromBackground() {
    var g = game();
    if (pausedByShip && g && typeof g.togglePause === 'function' && g.phase === 'paused') {
      g.togglePause();
      pausedByShip = false;
      return;
    }
    pausedByShip = false;
    ensureRafGate(false);
  }

  function ensureRafGate(hidden) {
    if (!rafWrapped) {
      rafWrapped = true;
      window.requestAnimationFrame = function (cb) {
        if (document.hidden) {
          return nativeRaf(function (t) {
            // Drop callbacks while hidden; keep id space stable enough for cancel
            if (!document.hidden) cb(t);
          });
        }
        return nativeRaf(cb);
      };
      window.cancelAnimationFrame = nativeCancel;
    }
    // When becoming visible, schedule a no-op frame to wake loops
    if (!hidden) nativeRaf(function () {});
  }

  function onVisibility() {
    if (document.hidden) pauseForBackground();
    else resumeFromBackground();
  }

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', function () {
    pauseForBackground();
  });

  // ---------------------------------------------------------------------------
  // Persist helpers
  // ---------------------------------------------------------------------------
  function lsGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  }

  function factionFromText(text) {
    if (!text) return null;
    for (var i = 0; i < FACTIONS.length; i++) {
      // Word boundary-ish: faction name as its own line / bold label
      if (text.indexOf(FACTIONS[i]) !== -1) return FACTIONS[i];
    }
    return null;
  }

  function storeFaction(name) {
    if (!name) return;
    lsSet(KEY_FACTION, name);
  }

  function storeHowtoSeen() {
    lsSet(KEY_HOWTO, '1');
  }

  function storeMatchResult(payload) {
    try {
      lsSet(KEY_MATCH, JSON.stringify(payload));
    } catch (e) {}
  }

  // Event delegation: land buttons contain Fire/Water/Earth/Light/Dark
  document.addEventListener(
    'click',
    function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var btn = t.closest('button');
      if (!btn) return;
      var label = (btn.innerText || btn.textContent || '').replace(/\s+/g, ' ').trim();

      var faction = factionFromText(label);
      // Prefer short labels that look like land cards (name + blurb), not HUD
      if (faction && label.length < 80) {
        storeFaction(faction);
      }

      // How-to dismiss: dialog with "How to play" that gets closed
      if (/got it|close|dismiss/i.test(label)) {
        var root = btn.closest('[role="dialog"], .absolute');
        if (root && /how to play/i.test(root.innerText || '')) storeHowtoSeen();
      }
      // Opening how-to then leaving via Escape is handled separately
    },
    true
  );

  // Observe results UI (Victory / Defeat) appearing
  var resultSeen = false;
  function scanForResults() {
    var g = game();
    if (g && (g.phase === 'victory' || g.phase === 'defeat')) {
      if (!resultSeen) {
        resultSeen = true;
        var snap = typeof g.snapshot === 'function' ? g.snapshot() : null;
        storeMatchResult({
          phase: g.phase,
          message: g.message || '',
          at: Date.now(),
          faction: lsGet(KEY_FACTION) || null,
          score: snap && typeof snap.score === 'number' ? snap.score : undefined,
          kills: snap && typeof snap.kills === 'number' ? snap.kills : undefined
        });
      }
      return;
    }
    resultSeen = false;

    // DOM fallback if __ee missing
    var nodes = document.querySelectorAll('div, h1, h2, p');
    for (var i = 0; i < nodes.length; i++) {
      var txt = (nodes[i].textContent || '').trim();
      if (txt === 'Victory' || txt === 'Defeat') {
        storeMatchResult({ phase: txt.toLowerCase(), at: Date.now(), faction: lsGet(KEY_FACTION) });
        break;
      }
    }
  }

  // How-to seen: when KeyH closes or overlay disappears after being open
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' || ev.key === 'h' || ev.key === 'H') {
      // Heuristic: if how-to was visible, mark seen shortly after
      setTimeout(function () {
        var body = document.body && document.body.innerText;
        if (body && !/How to play[\s\S]{0,40}Tap the map/i.test(body)) {
          // only mark if previously had howto key unset and user interacted
        }
      }, 0);
    }
  });

  // Poll lightly for phase / howto overlay (cheap; ship-only)
  setInterval(scanForResults, 1200);

  // Mark howto seen when the howto panel is gone after having been present
  var howtoWasOpen = false;
  setInterval(function () {
    var text = document.body ? document.body.innerText || '' : '';
    var open = /How to play/.test(text) && /Tap the map to march|Short tap peels|Break the wall/i.test(text);
    if (open) howtoWasOpen = true;
    else if (howtoWasOpen) {
      storeHowtoSeen();
      howtoWasOpen = false;
    }
  }, 900);

  // Restore last-faction highlight on menu (visual ring via outline)
  function restoreFactionHighlight() {
    var last = lsGet(KEY_FACTION);
    if (!last) return;
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var t = (b.innerText || '').replace(/\s+/g, ' ');
      // Land cards look like "Fire The pack…"
      if (t.indexOf(last) === 0 || new RegExp('^\\s*' + last + '\\b').test(t)) {
        b.setAttribute('data-ee-last-faction', '1');
        b.style.outline = '2px solid rgba(255,255,255,0.55)';
        b.style.outlineOffset = '2px';
      } else if (b.getAttribute('data-ee-last-faction')) {
        b.removeAttribute('data-ee-last-faction');
        b.style.outline = '';
        b.style.outlineOffset = '';
      }
    }
  }
  setInterval(function () {
    var g = game();
    if (!g || g.phase === 'menu') restoreFactionHighlight();
  }, 1500);
  // First paint after hydrate
  setTimeout(restoreFactionHighlight, 800);
  setTimeout(restoreFactionHighlight, 2000);

  // ---------------------------------------------------------------------------
  // Install chip (never mention App Store / Play)
  // ---------------------------------------------------------------------------
  var deferredPrompt = null;

  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  function isIos() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function chipDismissed() {
    return lsGet(KEY_CHIP) === '1';
  }

  function dismissChip() {
    lsSet(KEY_CHIP, '1');
    var el = document.getElementById('ee-install-chip');
    if (el) el.hidden = true;
  }

  function ensureChip() {
    if (isStandalone() || chipDismissed()) return;
    var existing = document.getElementById('ee-install-chip');
    if (existing) return existing;

    var el = document.createElement('div');
    el.id = 'ee-install-chip';
    el.innerHTML =
      '<div class="ee-chip-row">' +
      '<div style="flex:1">' +
      '<div class="ee-chip-title">Install</div>' +
      '<div class="ee-chip-body" data-ee-chip-body></div>' +
      '<div class="ee-chip-actions" data-ee-chip-actions></div>' +
      '</div></div>';
    document.body.appendChild(el);
    return el;
  }

  function renderAndroidChip() {
    var el = ensureChip();
    if (!el) return;
    el.querySelector('[data-ee-chip-body]').textContent =
      'Add Elemental Evolves to your Home Screen for a full-screen play session.';
    var actions = el.querySelector('[data-ee-chip-actions]');
    actions.innerHTML = '';
    var installBtn = document.createElement('button');
    installBtn.className = 'ee-primary';
    installBtn.textContent = 'Install';
    installBtn.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        dismissChip();
      });
    });
    var later = document.createElement('button');
    later.textContent = 'Not now';
    later.addEventListener('click', dismissChip);
    actions.appendChild(installBtn);
    actions.appendChild(later);
  }

  function renderIosChip() {
    var el = ensureChip();
    if (!el) return;
    el.querySelector('[data-ee-chip-body]').innerHTML =
      'Play full-screen from your Home Screen:' +
      '<ol class="ee-chip-steps">' +
      '<li>Tap Share</li>' +
      '<li>Add to Home Screen</li>' +
      '<li>Tap Add</li>' +
      '<li>Open from Home Screen</li>' +
      '</ol>';
    var actions = el.querySelector('[data-ee-chip-actions]');
    actions.innerHTML = '';
    var ok = document.createElement('button');
    ok.className = 'ee-primary';
    ok.textContent = 'Got it';
    ok.addEventListener('click', dismissChip);
    actions.appendChild(ok);
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (!isIos()) renderAndroidChip();
  });

  // iPhone: show 4-step chip after a short delay (Safari only path)
  if (isIos() && !isStandalone() && !chipDismissed()) {
    setTimeout(renderIosChip, 1800);
  }

  // ---------------------------------------------------------------------------
  // Version stamp
  // ---------------------------------------------------------------------------
  function placeStamp() {
    var el = document.getElementById('ee-version-stamp');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ee-version-stamp';
      document.body.appendChild(el);
    }
    el.textContent = EE_SHIP_VERSION;
  }

  // ---------------------------------------------------------------------------
  // Service worker
  // ---------------------------------------------------------------------------
  function registerSw() {
    if (!('serviceWorker' in navigator)) return;
    // Prefer relative so project Pages (/elemental-evolves/) works
    navigator.serviceWorker.register('./sw.js').catch(function (err) {
      console.warn('[ee-ship] SW register failed', err);
    });
  }

  function boot() {
    placeStamp();
    registerSw();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
