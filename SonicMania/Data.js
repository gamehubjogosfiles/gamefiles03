var Module = typeof Module !== 'undefined' ? Module : {};

if (!Module.expectedDataFileDownloads) Module.expectedDataFileDownloads = 0;
Module.expectedDataFileDownloads++;
(function () {
  var isPthread = typeof ENVIRONMENT_IS_PTHREAD !== 'undefined' && ENVIRONMENT_IS_PTHREAD;
  var isWasmWorker = typeof ENVIRONMENT_IS_WASM_WORKER !== 'undefined' && ENVIRONMENT_IS_WASM_WORKER;
  if (isPthread || isWasmWorker) return;

  var PACKAGE_NAME = 'Data.data';
  var PART_SIZES = [
    15728640, 15728640, 15728640, 15728640, 15728640, 15728640, 15728640,
    15728640, 15728640, 15728640, 15728640, 15728640, 15728640, 3896375
  ];
  var TOTAL_SIZE = 208368695;
  var progressByPart = new Array(PART_SIZES.length).fill(0);
  var lastPercent = -1;
  var lastUpdate = 0;

  function reportProgress(label) {
    var loaded = progressByPart.reduce(function (sum, value) { return sum + value; }, 0);
    var percent = Math.min(100, Math.floor(loaded * 100 / TOTAL_SIZE));
    var now = Date.now();
    if (percent !== lastPercent || now - lastUpdate >= 200 || loaded === TOTAL_SIZE) {
      lastPercent = percent;
      lastUpdate = now;
      if (typeof Module.gamehubProgress === 'function') {
        Module.gamehubProgress(loaded, TOTAL_SIZE, label || 'Downloading game data');
      } else if (typeof Module.setStatus === 'function') {
        Module.setStatus((label || 'Downloading game data') + ' (' + loaded + '/' + TOTAL_SIZE + ')');
      }
    }
  }

  function isRetryable(error) {
    return error && (error.retryable || error.name === 'TypeError');
  }

  async function fetchPart(partIndex) {
    var partName = 'Data.data.part' + partIndex;
    var expectedSize = PART_SIZES[partIndex];
    var url = new URL(partName, document.baseURI).href;

    for (var attempt = 0; attempt < 3; attempt++) {
      progressByPart[partIndex] = 0;
      reportProgress(attempt ? 'Retrying game data download' : 'Downloading game data');
      try {
        var response = await fetch(url, { cache: 'default' });
        if (!response.ok) {
          var httpError = new Error(partName + ': HTTP ' + response.status);
          httpError.retryable = response.status === 429 || response.status >= 500;
          throw httpError;
        }

        var bytes = new Uint8Array(expectedSize);
        var offset = 0;
        if (response.body && typeof response.body.getReader === 'function') {
          var reader = response.body.getReader();
          while (true) {
            var result = await reader.read();
            if (result.done) break;
            if (offset + result.value.byteLength > expectedSize) {
              var tooLarge = new Error(partName + ': received more bytes than expected');
              tooLarge.retryable = true;
              throw tooLarge;
            }
            bytes.set(result.value, offset);
            offset += result.value.byteLength;
            progressByPart[partIndex] = offset;
            reportProgress('Downloading game data');
          }
        } else {
          var buffer = await response.arrayBuffer();
          offset = buffer.byteLength;
          if (offset <= expectedSize) bytes.set(new Uint8Array(buffer), 0);
          progressByPart[partIndex] = Math.min(offset, expectedSize);
          reportProgress('Downloading game data');
        }

        if (offset !== expectedSize) {
          var shortFile = new Error(partName + ': expected ' + expectedSize + ' bytes, received ' + offset);
          shortFile.retryable = true;
          throw shortFile;
        }
        progressByPart[partIndex] = expectedSize;
        reportProgress('Downloading game data');
        return bytes;
      } catch (error) {
        progressByPart[partIndex] = 0;
        reportProgress(attempt < 2 ? 'Retrying game data download' : 'Game data download failed');
        if (attempt >= 2 || !isRetryable(error)) throw error;
        await new Promise(function (resolve) { setTimeout(resolve, 500 * (attempt + 1)); });
      }
    }
    throw new Error('Unable to load ' + partName);
  }

  async function fetchAndAssemble() {
    reportProgress('Downloading game data');
    var parts = await Promise.all(PART_SIZES.map(function (_, index) { return fetchPart(index); }));
    var assembled = new Uint8Array(TOTAL_SIZE);
    var offset = 0;
    for (var i = 0; i < parts.length; i++) {
      assembled.set(parts[i], offset);
      offset += parts[i].byteLength;
      parts[i] = null;
    }
    if (offset !== TOTAL_SIZE) throw new Error('Data package size mismatch: expected ' + TOTAL_SIZE + ', received ' + offset);
    reportProgress('Assembling game data');
    return assembled.buffer;
  }

  async function runWithFS(module) {
    var metadata = { files: [{ filename: '/Data.rsdk', start: 0, end: TOTAL_SIZE }] };
    for (var file of metadata.files) module.addRunDependency('fp ' + file.filename);
    module.addRunDependency('datafile_Data.data');
    if (!module.preloadResults) module.preloadResults = {};
    module.preloadResults[PACKAGE_NAME] = { fromCache: false };

    try {
      var arrayBuffer = await fetchAndAssemble();
      if (!arrayBuffer || arrayBuffer.byteLength !== TOTAL_SIZE) {
        throw new Error('Loading Data.rsdk failed: invalid assembled data size');
      }
      var byteArray = new Uint8Array(arrayBuffer);
      for (var packagedFile of metadata.files) {
        var data = byteArray.subarray(packagedFile.start, packagedFile.end);
        module.FS_createDataFile(packagedFile.filename, null, data, true, true, true);
        module.removeRunDependency('fp ' + packagedFile.filename);
      }
      module.removeRunDependency('datafile_Data.data');
      reportProgress('Game data ready');
    } catch (error) {
      if (typeof module.gamehubError === 'function') module.gamehubError(error);
      throw error;
    }
  }

  if (!Module.calledRun) {
    if (!Module.preRun) Module.preRun = [];
    Module.preRun.push(runWithFS);
  } else {
    runWithFS(Module);
  }
})();
