/* GameHub local Clickteam bootstrap.
 * The original HTML5 export loads a CCH file and its media beside it. GameHub
 * stores the export in split local ZIP parts, so rebuild the archive in memory
 * and serve its entries through XHR before starting Runtime.js.
 */
(() => {
  'use strict';
  const game = window.__GAMEHUB_FNAF__ || {};
  const partCount = Number(game.parts || 20);
  const partBase = game.partBase || 'src/resources.zip.part';
  const colors = ['#ff3b30', '#ffcc00', '#0a84ff', '#bf5af2', '#ff9500', '#30d158'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const pct = document.getElementById('percentage');
  const bar = document.getElementById('bar');
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('MMFCanvas');
  const selection = document.getElementById('selection');
  const loader = document.querySelector('.loader');
  if (bar) { bar.style.borderColor = color; bar.style.backgroundColor = color; }
  if (pct) pct.style.color = color;
  const setProgress = (done, total, text) => {
    const value = total ? Math.min(100, Math.round(done / total * 100)) : 0;
    if (pct) pct.textContent = value + '%';
    if (bar) bar.style.width = value + '%';
    if (stage) stage.textContent = text || 'DOWNLOADING...';
  };
  const fail = (error) => {
    console.error('[GameHub FNAF bootstrap]', error);
    if (stage) stage.textContent = 'ERROR LOADING GAME';
    if (pct) pct.textContent = 'ERROR';
  };
  const getEntry = (zip, requested) => {
    const key = requested.replace(/^.*[\\/]/, '').toLowerCase();
    const names = Object.keys(zip.files);
    const name = names.find(n => n.toLowerCase() === requested.toLowerCase()) ||
      names.find(n => n.toLowerCase().endsWith('/' + key)) ||
      names.find(n => n.split('/').pop().toLowerCase() === key);
    return name ? zip.files[name] : null;
  };
  const installZipXHR = (zip) => {
    const NativeXHR = window.XMLHttpRequest;
    const nativeOpen = NativeXHR.prototype.open;
    const nativeSend = NativeXHR.prototype.send;
    const isResource = (url) => {
      try { return new URL(url, location.href).pathname.toLowerCase().includes('/resources/'); }
      catch (_) { return String(url).toLowerCase().includes('resources/'); }
    };
    NativeXHR.prototype.open = function(method, url, async, user, password) {
      this.__gamehubUrl = String(url);
      this.__gamehubLocal = isResource(url);
      if (!this.__gamehubLocal) return nativeOpen.call(this, method, url, async, user, password);
      this.__gamehubMethod = method; this.__gamehubAsync = async !== false;
      this.readyState = 1;
    };
    NativeXHR.prototype.send = function(body) {
      if (!this.__gamehubLocal) return nativeSend.call(this, body);
      const request = this;
      const requested = this.__gamehubUrl.split('?')[0].replace(/^.*\/resources\//i, '');
      const entry = getEntry(zip, requested);
      if (!entry) { setTimeout(() => { request.status = 404; request.readyState = 4; request.onerror?.(new Error('Missing ' + requested)); request.onreadystatechange?.(); }, 0); return; }
      entry.async('arraybuffer').then(buffer => {
        const type = requested.toLowerCase().endsWith('.png') ? 'image/png' :
          requested.toLowerCase().endsWith('.gif') ? 'image/gif' :
          requested.toLowerCase().endsWith('.ogg') ? 'audio/ogg' :
          requested.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream';
        const blob = new Blob([buffer], {type});
        const bytes = new Uint8Array(buffer);
        let binary = ''; const step = 0x8000;
        for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step));
        try { Object.defineProperty(request, 'status', {value: 200, configurable: true}); } catch (_) { request.status = 200; }
        try { Object.defineProperty(request, 'response', {value: request.responseType === 'blob' ? blob : buffer, configurable: true}); } catch (_) {}
        try { Object.defineProperty(request, 'responseText', {value: binary, configurable: true}); } catch (_) {}
        request.readyState = 4;
        setTimeout(() => { request.onreadystatechange?.(); request.onload?.(); }, 0);
      }).catch(fail);
    };
  };
  const startRuntime = () => {
    const script = document.createElement('script');
    script.src = 'src/Runtime.js';
    script.onload = () => {
      if (selection) selection.style.display = 'none';
      document.querySelectorAll('.glitch, .vignette').forEach(el => el.style.display = 'none');
      if (canvas) canvas.style.display = 'block';
      try { new window.Runtime('MMFCanvas', 'resources/' + (game.cch || 'FNAF1HTML5.cch')); }
      catch (error) { fail(error); }
    };
    script.onerror = () => fail(new Error('Runtime.js failed to load'));
    document.head.appendChild(script);
  };
  const load = async () => {
    setProgress(0, partCount, 'DOWNLOADING RESOURCES...');
    const buffers = [];
    for (let i = 1; i <= partCount; i++) {
      const response = await fetch(partBase + i, {cache: 'no-store'});
      if (!response.ok) throw new Error('Resource part ' + i + ' returned HTTP ' + response.status);
      buffers.push(await response.arrayBuffer());
      setProgress(i, partCount, 'DOWNLOADING RESOURCES...');
    }
    const archive = new Blob(buffers, {type: 'application/zip'});
    setProgress(partCount, partCount, 'EXTRACTING RESOURCES...');
    const zip = await JSZip.loadAsync(archive);
    installZipXHR(zip);
    const cch = Object.keys(zip.files).find(name => /\.cch$/i.test(name));
    if (cch) game.cch = cch.split('/').pop();
    setProgress(partCount, partCount, 'STARTING GAME...');
    startRuntime();
  };
  window.addEventListener('load', () => load().catch(fail), {once: true});
})();
