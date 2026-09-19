/* import-worker.js — parses the reports off the main thread.
 *
 * 30,000 item lines must not freeze the interface on a phone. The page sends
 * the raw bytes, the worker decodes and classifies them and sends back a
 * finished dataset. The file itself never leaves the device, and it never
 * passes through the service worker.
 */
/* global importScripts, self */
'use strict';

importScripts('./import-express.js');

self.addEventListener('message', function (event) {
  var request = event.data || {};
  if (request.type !== 'import') return;

  try {
    var documents = request.files.map(function (file, index) {
      self.postMessage({ type: 'progress', step: index, total: request.files.length, name: file.name });
      var decoded = self.MSFA.importExpress.decodeBytes(file.buffer);
      return { name: file.name, text: decoded.text, encoding: decoded.encoding };
    });

    self.postMessage({ type: 'progress', step: request.files.length, total: request.files.length });
    var dataset = self.MSFA.importExpress.buildDataset(documents);
    self.postMessage({ type: 'done', dataset: dataset });
  } catch (error) {
    self.postMessage({ type: 'error', message: String(error && error.message ? error.message : error) });
  }
});
