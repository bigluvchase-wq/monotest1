# Local PDF text extraction

Mozilla PDF.js `pdfjs-dist@4.10.38`, legacy browser distribution. Apache-2.0 license in LICENSE. Both main and worker modules are bundled as classic browser scripts with esbuild 0.25.12, target safari17. The worker handler is loaded locally into the same realm (PDF.js fake-worker mode), so WKWebView file URLs do not require cross-origin workers or ES module imports. No CDN is used at runtime. Library code is loaded only when a PDF is selected.

Source inputs:
- https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.mjs
- https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.mjs
- https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/LICENSE

Build each input with `esbuild --bundle --format=iife --target=safari17 --minify`, using `--global-name=pdfjsLib` for the main module and `--global-name=pdfjsWorker` for the worker module. Preserve the generated license comments. The unused Node-only import.meta branch warns during the browser IIFE build; it is not used in the app.

Caller disables eval, font rendering, offscreen canvas and worker network fetching. The application reads text items and coordinates only. Bank adapters and reconciliation are application code in pdf-reader.js/document-import.js, not PDF.js features. Updating the library requires rerunning the real-document extraction regression and device testing.
