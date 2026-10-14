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
    const numeric = key.match(/^(\d+)$/);
    const name = names.find(n => n.toLowerCase() === requested.toLowerCase()) ||
      names.find(n => n.toLowerCase().endsWith('/' + key)) ||
      names.find(n => n.split('/').pop().toLowerCase() === key) ||
      (numeric && names.find(n => new RegExp('\\.cc' + numeric[1] + '$', 'i').test(n)));
    return name ? zip.files[name] : null;
  };
  const installZipXHR = (zip) => {
    const NativeXHR = window.XMLHttpRequest;
    const isResource = (url) => {
      try { return new URL(url, location.href).pathname.toLowerCase().includes('/resources/'); }
      catch (_) { return String(url).toLowerCase().includes('resources/'); }
    };
    const makeType = (requested) => {
      const lower = requested.toLowerCase();
      if (lower.endsWith('.png')) return 'image/png';
      if (lower.endsWith('.gif')) return 'image/gif';
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
      if (lower.endsWith('.ogg')) return 'audio/ogg';
      if (lower.endsWith('.mp3')) return 'audio/mpeg';
      if (lower.endsWith('.wav')) return 'audio/wav';
      return 'application/octet-stream';
    };
    const fire = (request, type, event) => {
      request.dispatchEvent?.(new Event(type));
      request['on' + type]?.(event || new Event(type));
      request.onreadystatechange?.(event || new Event(type));
    };
    class ZipXHR extends EventTarget {
      constructor() {
        super();
        this.readyState = 0;
        this.status = 0;
        this.statusText = '';
        this.response = null;
        this.responseText = '';
        this.responseType = '';
        this.responseURL = '';
        this.timeout = 0;
        this.withCredentials = false;
        this.onload = null;
        this.onerror = null;
        this.onprogress = null;
        this.onreadystatechange = null;
        this.__url = '';
      }
      open(method, url, async = true) {
        this.__url = String(url);
        this.__method = method;
        this.__async = async !== false;
        this.responseURL = this.__url;
        this.readyState = 1;
        fire(this, 'readystatechange');
      }
      send() {
        const request = this;
        const requested = this.__url.split('?')[0].replace(/^.*\/resources\//i, '');
        const entry = getEntry(zip, requested);
        if (!entry) {
          setTimeout(() => {
            request.status = 404;
            request.statusText = 'Not Found';
            request.readyState = 4;
            fire(request, 'error', new Error('Missing ' + requested));
            fire(request, 'readystatechange');
          }, 0);
          return;
        }
        entry.async('arraybuffer').then(buffer => {
          const blob = new Blob([buffer], {type: makeType(requested)});
          const bytes = new Uint8Array(buffer);
          let binary = '';
          const step = 0x8000;
          for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step));
          request.status = 200;
          request.statusText = 'OK';
          request.response = request.responseType === 'blob' ? blob : buffer;
          request.responseText = binary;
          request.readyState = 4;
          fire(request, 'progress');
          fire(request, 'readystatechange');
          fire(request, 'load');
        }).catch(error => {
          request.status = 0;
          request.readyState = 4;
          fire(request, 'error', error);
          fire(request, 'readystatechange');
        });
      }
      abort() {}
      getResponseHeader(name) { return name.toLowerCase() === 'content-type' ? makeType(this.__url) : null; }
      getAllResponseHeaders() { return 'Content-Type: ' + makeType(this.__url) + ' ' + String.fromCharCode(13, 10); }
      setRequestHeader() {}
      overrideMimeType() {}
    }
    const XHR = function() {
      return new ZipXHR();
    };
    XHR.UNSENT = 0; XHR.OPENED = 1; XHR.HEADERS_RECEIVED = 2; XHR.LOADING = 3; XHR.DONE = 4;
    window.XMLHttpRequest = XHR;
    const installZipMedia = () => {
      const imageDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      const mediaDescriptor = typeof HTMLMediaElement !== 'undefined' ? Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src') : null;
      const resolveAsset = (value) => {
        try {
          const url = new URL(value, location.href);
          if (!url.pathname.toLowerCase().includes('/resources/')) return null;
          return getEntry(zip, url.pathname.replace(/^.*\/resources\//i, ''));
        } catch (_) { return null; }
      };
      const loadBlobURL = (element, setter, value) => {
        const entry = resolveAsset(value);
        if (!entry) { setter.call(element, value); return; }
        entry.async('blob').then(blob => {
          if (element.__gamehubAssetRequest === value) setter.call(element, URL.createObjectURL(blob));
        }).catch(() => {});
      };
      if (imageDescriptor?.set) {
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
          configurable: imageDescriptor.configurable,
          enumerable: imageDescriptor.enumerable,
          get: imageDescriptor.get,
          set(value) {
            this.__gamehubAssetRequest = String(value);
            loadBlobURL(this, imageDescriptor.set, String(value));
          }
        });
      }
      if (mediaDescriptor?.set) {
        Object.defineProperty(HTMLMediaElement.prototype, 'src', {
          configurable: mediaDescriptor.configurable,
          enumerable: mediaDescriptor.enumerable,
          get: mediaDescriptor.get,
          set(value) {
            this.__gamehubAssetRequest = String(value);
            loadBlobURL(this, mediaDescriptor.set, String(value));
          }
        });
      }
    };
    installZipMedia();
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
