(() => {
  const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0;
  if (!mobile) return;

  // Bad Ice Cream: P1 uses arrows + Space; P2 uses WASD + F.
  const keyMap = {
    p1: { left: 37, right: 39, up: 38, down: 40, action: 32 },
    p2: { left: 65, right: 68, up: 87, down: 83, action: 70 },
  };
  let target;
  let mode = '1p';
  const active = new Map();

  const browserKey = (code) => ({
    32: [' ', 'Space'], 37: ['ArrowLeft', 'ArrowLeft'], 38: ['ArrowUp', 'ArrowUp'],
    39: ['ArrowRight', 'ArrowRight'], 40: ['ArrowDown', 'ArrowDown'],
    65: ['a', 'KeyA'], 68: ['d', 'KeyD'], 70: ['f', 'KeyF'], 83: ['s', 'KeyS'], 87: ['w', 'KeyW'],
  }[code] || [String.fromCharCode(code), '']);
  const send = (type, code) => {
    if (target && typeof target.triggerKeyEvent === 'function') {
      target.triggerKeyEvent(type, code);
      return;
    }
    const [key, keyCode] = browserKey(code);
    const event = new KeyboardEvent(type, { key, code: keyCode, bubbles: true, cancelable: true });
    Object.defineProperty(event, 'keyCode', { get: () => code });
    Object.defineProperty(event, 'which', { get: () => code });
    window.dispatchEvent(event);
    document.dispatchEvent(event);
  };
  const stop = (id) => {
    const code = active.get(id);
    if (code == null) return;
    send('keyup', code);
    active.delete(id);
  };
  const start = (id, code) => {
    stop(id);
    active.set(id, code);
    send('keydown', code);
  };

  const button = (label, code, className) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `gamehub-touch-key ${className || ''}`;
    el.textContent = label;
    el.setAttribute('aria-label', label);
    const press = (event) => {
      event.preventDefault(); event.stopPropagation();
      el.setPointerCapture?.(event.pointerId); start(el, code); el.classList.add('pressed');
    };
    const release = (event) => {
      event.preventDefault(); stop(el); el.classList.remove('pressed');
    };
    el.addEventListener('pointerdown', press, { passive: false });
    el.addEventListener('pointerup', release, { passive: false });
    el.addEventListener('pointercancel', release, { passive: false });
    el.addEventListener('lostpointercapture', release, { passive: false });
    return el;
  };

  const addCluster = (root, player, side) => {
    const keys = keyMap[player];
    const cluster = document.createElement('div');
    cluster.className = `gamehub-touch-cluster ${side} ${player}`;
    cluster.append(button('◀', keys.left, 'left'), button('▶', keys.right, 'right'), button('▲', keys.up, 'up'), button('▼', keys.down, 'down'));
    root.appendChild(cluster);
  };
  const addAction = (root, player, side) => {
    const action = button('ICE', keyMap[player].action, `gamehub-touch-action ${side} ${player}`);
    action.title = 'Build / break ice'; root.appendChild(action);
  };

  const render = () => {
    if (document.getElementById('gamehub-mobile-controls')) return;
    const root = document.createElement('div'); root.id = 'gamehub-mobile-controls';
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'gamehub-touch-mode';
    toggle.textContent = mode.toUpperCase(); toggle.title = mode === '1p' ? 'Switch to 2-player controls' : 'Switch to 1-player controls';
    toggle.addEventListener('click', (event) => {
      event.preventDefault(); mode = mode === '1p' ? '2p' : '1p';
      document.getElementById('gamehub-mobile-controls')?.remove(); render();
    });
    root.appendChild(toggle);
    if (mode === '1p') { addAction(root, 'p1', 'left'); addCluster(root, 'p1', 'right'); }
    else { addCluster(root, 'p1', 'left'); addAction(root, 'p1', 'left'); addCluster(root, 'p2', 'right'); addAction(root, 'p2', 'right'); }
    document.body.appendChild(root);
  };

  // Some builds do not dispatch tOCParsed; the player is still ready once AVMPlayerPoki exists.
  const waitForPlayer = () => {
    if (window.AVMPlayerPoki || document.querySelector('canvas')) render();
    else setTimeout(waitForPlayer, 250);
  };
  waitForPlayer();
  document.addEventListener('tOCParsed', (event) => { target = event.skinner?.target; render(); }, { once: true });
  window.addEventListener('pagehide', () => active.forEach((code, id) => stop(id)));
})();
