(() => {
  const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0;
  if (!mobile) return;

  // Controls used by the original Bad Ice Cream SWF.
  const keys = {
    p1: { left: 37, right: 39, up: 38, down: 40, action: 13 },
    p2: { left: 65, right: 68, up: 87, down: 83, action: 189 },
  };
  const art = {
    left: 'assets/gamehub-controls/p1-left.png', right: 'assets/gamehub-controls/p1-right.png',
    up: 'assets/gamehub-controls/p1-up.png', down: 'assets/gamehub-controls/p1-down.png',
    p1Action: 'assets/gamehub-controls/p1-enter.png', p2Action: 'assets/gamehub-controls/p2-minus.png',
    p2Left: 'assets/gamehub-controls/p2-a.png', p2Right: 'assets/gamehub-controls/p2-d.png',
    p2Up: 'assets/gamehub-controls/p2-w.png', p2Down: 'assets/gamehub-controls/p2-s.png',
  };
  let target = null;
  let mode = null;
  let menuClicks = 0;
  let keyboardMode = '1p';
  const held = new Map(); // pointerId -> { element, code }

  const send = (type, code) => {
    if (target && typeof target.triggerKeyEvent === 'function') {
      target.triggerKeyEvent(type, code);
      return;
    }
    const names = {13:['Enter','Enter'],37:['ArrowLeft','ArrowLeft'],38:['ArrowUp','ArrowUp'],39:['ArrowRight','ArrowRight'],40:['ArrowDown','ArrowDown'],65:['a','KeyA'],68:['d','KeyD'],83:['s','KeyS'],87:['w','KeyW'],189:['-','Minus']};
    const [key, codeName] = names[code] || ['', ''];
    const event = new KeyboardEvent(type, { key, code: codeName, bubbles: true, cancelable: true });
    Object.defineProperty(event, 'keyCode', { get: () => code });
    Object.defineProperty(event, 'which', { get: () => code });
    window.dispatchEvent(event); document.dispatchEvent(event);
  };
  const releasePointer = (pointerId) => {
    const item = held.get(pointerId);
    if (!item) return;
    send('keyup', item.code);
    item.element.classList.remove('pressed');
    held.delete(pointerId);
  };
  const pressPointer = (pointerId, element) => {
    const code = Number(element.dataset.key);
    if (!code) return;
    const previous = held.get(pointerId);
    if (previous?.element === element) return;
    releasePointer(pointerId);
    held.set(pointerId, { element, code });
    send('keydown', code);
    element.classList.add('pressed');
  };

  const makeKey = (root, className, label, code, image) => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = `gamehub-key ${className}`; el.dataset.key = code; el.dataset.direction = label;
    el.setAttribute('aria-label', label); el.style.backgroundImage = `url("${image}")`;
    el.addEventListener('pointerdown', (event) => { event.preventDefault(); event.stopPropagation(); el.setPointerCapture?.(event.pointerId); pressPointer(event.pointerId, el); }, { passive: false });
    el.addEventListener('pointerup', (event) => { event.preventDefault(); releasePointer(event.pointerId); }, { passive: false });
    el.addEventListener('pointercancel', (event) => releasePointer(event.pointerId), { passive: false });
    root.appendChild(el);
    return el;
  };

  const buildControls = () => {
    if (!mode || document.getElementById('gamehub-mobile-controls')) return;
    const root = document.createElement('div'); root.id = 'gamehub-mobile-controls'; root.dataset.mode = mode;
    const p1 = document.createElement('div'); p1.className = 'gamehub-player-controls p1-controls';
    makeKey(p1, 'key-left', 'left', keys.p1.left, art.left); makeKey(p1, 'key-right', 'right', keys.p1.right, art.right);
    makeKey(p1, 'key-up', 'up', keys.p1.up, art.up); makeKey(p1, 'key-down', 'down', keys.p1.down, art.down);
    makeKey(p1, 'key-action', 'action', keys.p1.action, art.p1Action); root.appendChild(p1);
    if (mode === '2p') {
      const p2 = document.createElement('div'); p2.className = 'gamehub-player-controls p2-controls';
      makeKey(p2, 'key-left', 'left', keys.p2.left, art.p2Left); makeKey(p2, 'key-right', 'right', keys.p2.right, art.p2Right);
      makeKey(p2, 'key-up', 'up', keys.p2.up, art.p2Up); makeKey(p2, 'key-down', 'down', keys.p2.down, art.p2Down);
      makeKey(p2, 'key-action', 'action', keys.p2.action, art.p2Action); root.appendChild(p2);
    }
    document.body.appendChild(root);
  };

  // The SWF has two menu clicks: PLAY, then 1 PLAYER / 2 PLAYERS.
  // The second click's horizontal position identifies the selected mode.
  const observeMenuSelection = (event) => {
    if (mode || event.target.closest?.('#gamehub-mobile-controls')) return;
    if (event.type === 'keydown') {
      if (event.key === 'ArrowRight' || event.keyCode === 39) keyboardMode = '2p';
      if (event.key === 'ArrowLeft' || event.keyCode === 37) keyboardMode = '1p';
      if (event.key === 'Enter' || event.keyCode === 13) menuClicks++;
      if (menuClicks >= 2) { mode = keyboardMode; setTimeout(buildControls, 850); }
      return;
    }
    if (event.type === 'pointerup' && window.AVMPlayerPoki && !event.target.closest?.('#gamehub-mobile-controls')) {
      menuClicks++;
      // The first tap opens the main menu, the second taps PLAY, and the
      // third selects 1 PLAYER or 2 PLAYERS. Do not cover either menu.
      if (menuClicks >= 3) {
        const rect = document.querySelector('canvas')?.getBoundingClientRect() || { left: 0, width: window.innerWidth };
        mode = (event.clientX - rect.left) < rect.width / 2 ? '1p' : '2p';
        setTimeout(buildControls, 850);
      }
    }
  };
  document.addEventListener('pointerup', observeMenuSelection, true);
  document.addEventListener('keydown', observeMenuSelection, true);

  // Sliding over another directional key changes direction without lifting the finger.
  document.addEventListener('pointermove', (event) => {
    const item = held.get(event.pointerId);
    if (!item) return;
    const under = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('.gamehub-key');
    if (under && under !== item.element && under.dataset.direction !== 'action') pressPointer(event.pointerId, under);
  }, { passive: true });
  document.addEventListener('pointerup', (event) => releasePointer(event.pointerId), true);
  document.addEventListener('pointercancel', (event) => releasePointer(event.pointerId), true);
  window.addEventListener('pagehide', () => [...held.keys()].forEach(releasePointer));

  // The runtime target is optional; the bubbling KeyboardEvent fallback also works for this SWF.
  document.addEventListener('tOCParsed', (event) => { target = event.skinner?.target || null; }, { once: true });
})();
