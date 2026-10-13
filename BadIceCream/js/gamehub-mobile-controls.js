(() => {
  const isTouch = navigator.maxTouchPoints > 0 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isTouch) return;

  const keyMap = {
    p1: { left: 37, right: 39, up: 38, down: 40, action: 13 },
    p2: { left: 65, right: 68, up: 87, down: 83, action: 32 },
  };
  let player = null;
  let gameClicks = 0;
  const held = new Map();

  function emit(type, code) {
    if (player && typeof player.triggerKeyEvent === 'function') {
      player.triggerKeyEvent(type, code);
      return;
    }
    const info = {
      13: ['Enter', 'Enter'], 32: [' ', 'Space'], 37: ['ArrowLeft', 'ArrowLeft'],
      38: ['ArrowUp', 'ArrowUp'], 39: ['ArrowRight', 'ArrowRight'], 40: ['ArrowDown', 'ArrowDown'],
      65: ['a', 'KeyA'], 68: ['d', 'KeyD'], 83: ['s', 'KeyS'], 87: ['w', 'KeyW'],
    }[code] || ['', ''];
    const event = new KeyboardEvent(type, { key: info[0], code: info[1], bubbles: true, cancelable: true });
    Object.defineProperties(event, { keyCode: { get: () => code }, which: { get: () => code } });
    window.dispatchEvent(event); document.dispatchEvent(event);
  }

  function release(pointerId) {
    const item = held.get(pointerId);
    if (!item) return;
    emit('keyup', item.code);
    item.el.classList.remove('pressed');
    held.delete(pointerId);
  }

  function press(pointerId, el) {
    const code = Number(el.dataset.key);
    if (!code) return;
    release(pointerId);
    held.set(pointerId, { el, code });
    emit('keydown', code);
    el.classList.add('pressed');
  }

  function button(root, cls, code, label, image) {
    const el = document.createElement('button');
    el.type = 'button'; el.className = `gamehub-key ${cls}`; el.dataset.key = code;
    el.setAttribute('aria-label', label); el.style.backgroundImage = `url("${image}")`;
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); press(e.pointerId, el); }, { passive: false });
    el.addEventListener('pointerup', e => { e.preventDefault(); release(e.pointerId); }, { passive: false });
    el.addEventListener('pointercancel', e => release(e.pointerId), { passive: false });
    root.appendChild(el);
    return el;
  }

  function build() {
    if (document.getElementById('gamehub-mobile-controls')) return;
    const root = document.createElement('div');
    root.id = 'gamehub-mobile-controls';
    root.innerHTML = '<div class="gamehub-controls-canvas"></div>';
    const stage = root.firstElementChild;
    const img = (name) => `assets/gamehub-controls/${name}.png`;

    button(stage, 'p1-action', keyMap.p1.action, 'Player 1 action', img('p1-enter'));
    button(stage, 'p1-up', keyMap.p1.up, 'Player 1 up', img('p1-up'));
    button(stage, 'p1-left', keyMap.p1.left, 'Player 1 left', img('p1-left'));
    button(stage, 'p1-down', keyMap.p1.down, 'Player 1 down', img('p1-down'));
    button(stage, 'p1-right', keyMap.p1.right, 'Player 1 right', img('p1-right'));
    button(stage, 'p2-action', keyMap.p2.action, 'Player 2 action', img('p2-space'));
    button(stage, 'p2-up', keyMap.p2.up, 'Player 2 up', img('p2-up'));
    button(stage, 'p2-left', keyMap.p2.left, 'Player 2 left', img('p2-left'));
    button(stage, 'p2-down', keyMap.p2.down, 'Player 2 down', img('p2-down'));
    button(stage, 'p2-right', keyMap.p2.right, 'Player 2 right', img('p2-right'));
    document.body.appendChild(root);
  }

  // No controls are rendered during the launcher/menu. Bad Ice Cream uses
  // three stage clicks: open menu, PLAY, then 1P/2P. The third click is the
  // actual player selection, so the same complete layout is shown afterwards.
  function observeStart(e) {
    if (document.getElementById('gamehub-mobile-controls') || !window.AVMPlayerPoki) return;
    if (e.type === 'keydown') {
      if (e.key === 'Enter' || e.keyCode === 13) gameClicks++;
    } else if (e.type === 'pointerup' && !e.target.closest?.('#gamehub-mobile-controls')) {
      gameClicks++;
    }
    if (gameClicks >= 3) setTimeout(build, 500);
  }
  document.addEventListener('pointerup', observeStart, true);
  document.addEventListener('keydown', observeStart, true);

  // Dragging from one directional key to another changes direction without
  // requiring the player to lift their finger.
  document.addEventListener('pointermove', e => {
    const active = held.get(e.pointerId);
    if (!active) return;
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.gamehub-key');
    if (over && over !== active.el && !over.classList.contains('p1-action') && !over.classList.contains('p2-action')) press(e.pointerId, over);
  }, { passive: true });
  document.addEventListener('pointerup', e => release(e.pointerId), true);
  document.addEventListener('pointercancel', e => release(e.pointerId), true);
  window.addEventListener('pagehide', () => [...held.keys()].forEach(release));
})();
