(() => {
  const isTouch = navigator.maxTouchPoints > 0 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isTouch) return;

  const keyMap = {
    p1: { left: 37, right: 39, up: 38, down: 40, action: 13 },
    p2: { left: 65, right: 68, up: 87, down: 83, action: 70 },
  };
  const held = new Map();
  let player = null;

  function emit(type, code) {
    if (player && typeof player.triggerKeyEvent === 'function') { player.triggerKeyEvent(type, code); return; }
    const info = {13:['Enter','Enter'],32:[' ','Space'],37:['ArrowLeft','ArrowLeft'],38:['ArrowUp','ArrowUp'],39:['ArrowRight','ArrowRight'],40:['ArrowDown','ArrowDown'],65:['a','KeyA'],68:['d','KeyD'],70:['f','KeyF'],83:['s','KeyS'],87:['w','KeyW']}[code] || ['', ''];
    const event = new KeyboardEvent(type, { key: info[0], code: info[1], bubbles: true, cancelable: true });
    Object.defineProperties(event, { keyCode: { get: () => code }, which: { get: () => code } });
    window.dispatchEvent(event); document.dispatchEvent(event);
  }
  function release(pointerId) { const item=held.get(pointerId); if (!item) return; emit('keyup',item.code); item.el.classList.remove('pressed'); held.delete(pointerId); }
  function press(pointerId, el) { const code=Number(el.dataset.key); if(!code)return; release(pointerId); held.set(pointerId,{el,code}); emit('keydown',code); el.classList.add('pressed'); }
  function button(root, cls, code, label, image, owner) {
    const el=document.createElement('button'); el.type='button'; el.className=`gamehub-key ${cls} player-${owner}`; el.dataset.key=code; el.setAttribute('aria-label',label); el.style.backgroundImage=`url("${image}")`;
    el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();press(e.pointerId,el)},{passive:false});
    el.addEventListener('pointerup',e=>{e.preventDefault();release(e.pointerId)},{passive:false});
    el.addEventListener('pointercancel',e=>release(e.pointerId),{passive:false}); root.appendChild(el); return el;
  }
  function build(mode) {
    let root=document.getElementById('gamehub-mobile-controls');
    if(!root){ root=document.createElement('div'); root.id='gamehub-mobile-controls'; root.innerHTML='<div class="gamehub-controls-canvas"></div>'; document.body.appendChild(root); }
    root.dataset.mode=mode;
    if(!root.dataset.built){
      const stage=root.firstElementChild, img=n=>`assets/gamehub-controls/${n}.png`;
      button(stage,'p1-action',keyMap.p1.action,'Player 1 action',img('p1-enter'),1); button(stage,'p1-up',keyMap.p1.up,'Player 1 up',img('p1-up'),1); button(stage,'p1-left',keyMap.p1.left,'Player 1 left',img('p1-left'),1); button(stage,'p1-down',keyMap.p1.down,'Player 1 down',img('p1-down'),1); button(stage,'p1-right',keyMap.p1.right,'Player 1 right',img('p1-right'),1);
      button(stage,'p2-action',keyMap.p2.action,'Player 2 action',img('p2-space'),2); button(stage,'p2-up',keyMap.p2.up,'Player 2 up',img('p2-up'),2); button(stage,'p2-left',keyMap.p2.left,'Player 2 left',img('p2-left'),2); button(stage,'p2-down',keyMap.p2.down,'Player 2 down',img('p2-down'),2); button(stage,'p2-right',keyMap.p2.right,'Player 2 right',img('p2-right'),2);
      root.dataset.built='1';
    }
  }
  window.gameHubBadIceCreamState = (state) => {
    const parts=String(state||'').split('|'); if(parts[0]!=='badicecream') return;
    const phase=parts[1], mode=parts[2]==='2'?'2p':'1p';
    if(phase!=='game'){ document.getElementById('gamehub-mobile-controls')?.remove(); return; }
    build(mode); const root=document.getElementById('gamehub-mobile-controls');
    root.querySelectorAll('.player-2').forEach(el=>el.hidden=mode!=='2p');
    root.querySelectorAll('.player-1').forEach(el=>el.classList.toggle('player-dead',parts[3]==='dead'));
    root.querySelectorAll('.player-2').forEach(el=>el.classList.toggle('player-dead',parts[4]==='dead'));
  };
  document.addEventListener('pointermove',e=>{const active=held.get(e.pointerId);if(!active)return;const over=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.gamehub-key');if(over&&over!==active.el&&!over.classList.contains('p1-action')&&!over.classList.contains('p2-action'))press(e.pointerId,over);},{passive:true});
  document.addEventListener('pointerup',e=>release(e.pointerId),true); document.addEventListener('pointercancel',e=>release(e.pointerId),true); window.addEventListener('pagehide',()=>[...held.keys()].forEach(release));
  document.addEventListener('tOCParsed',e=>{player=e.skinner?.target||null},{once:true});
})();
