import { Readable } from 'node:stream';
import fetch from 'node-fetch';
import { getBunnyZipSources } from './bunny.js';

export class ZipDownloadError extends Error {
  constructor(message, { rebuild = false, status = 502, contentRange } = {}) {
    super(message);
    Object.assign(this, { rebuild, status, contentRange });
  }
}

// Inspect only the first four bytes. Reinsert consumed chunks into a bounded
// stream so even 20-GB archives are never buffered in memory.
async function validateStart(response) {
  const length = Number(response.headers.get('content-length'));
  const contentRange = response.headers.get('content-range');
  if (response.status === 206 && !/^bytes 0-\d+\/\d+$/.test(contentRange || '')) {
    throw new ZipDownloadError('ZIP-Speicher lieferte einen ungültigen Dateibereich.');
  }
  const total = response.status === 206 ? Number(contentRange.split('/')[1]) : length;
  if ((Number.isFinite(total) && total > 0 && total < 22) || /json|text\/|html/i.test(response.headers.get('content-type') || '')) {
    throw new ZipDownloadError('Die gespeicherte Antwort ist keine gültige ZIP-Datei.', { rebuild: true });
  }
  const iterator = response.body[Symbol.asyncIterator]();
  const chunks = [];
  let bytes = 0;
  while (bytes < 4) {
    const next = await iterator.next();
    if (next.done) break;
    chunks.push(next.value);
    bytes += next.value.length;
  }
  const signature = Buffer.concat(chunks, bytes).subarray(0, 4);
  if (!signature.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    throw new ZipDownloadError('Die gespeicherte Antwort ist keine gültige ZIP-Datei.', { rebuild: true });
  }
  const body = Readable.from((async function* () {
    try {
      yield* chunks;
      while (true) {
        const next = await iterator.next();
        if (next.done) break;
        yield next.value;
      }
    } finally {
      await iterator.return?.();
      response.body.destroy();
    }
  })());
  body.once('close', () => response.body.destroy());
  return { status: response.status, headers: response.headers, body };
}

export function createZipDownload({ request = fetch, sources = getBunnyZipSources } = {}) {
  return async (galleryId, { signal, range } = {}) => {
    if (range && !/^bytes=(\d+-\d*|-\d+)$/.test(range)) {
      throw new ZipDownloadError('Ungültiger Download-Bereich.', { status: 416 });
    }
    let failure;
    for (const source of sources(galleryId)) {
      let response;
      try {
        const headers = { ...source.headers };
        if (range) headers.Range = range;
        // Resumed downloads start in the middle of an archive: verify its first
        // bytes separately before trusting this same source for a range response.
        if (range && !range.startsWith('bytes=0-')) {
          const probe = await request(source.url, { signal, headers: { ...source.headers, Range: 'bytes=0-3' } });
          try {
            if (![200, 206].includes(probe.status)) throw new ZipDownloadError('ZIP-Speicher momentan nicht erreichbar.', { rebuild: probe.status === 404 });
            const checked = await validateStart(probe);
            checked.body.destroy();
          } finally { probe.body?.destroy(); }
        }
        response = await request(source.url, { signal, headers });
        if (response.status === 416) throw new ZipDownloadError('Download-Bereich liegt außerhalb der Datei.', {
          status: 416, contentRange: response.headers.get('content-range')
        });
        if (![200, 206].includes(response.status)) {
          throw new ZipDownloadError('ZIP-Speicher momentan nicht erreichbar.', { rebuild: response.status === 404 });
        }
        const resumed = response.status === 206 && !/^bytes 0-/.test(response.headers.get('content-range') || '');
        if (resumed) {
          if (!range || range.startsWith('bytes=0-') || !/^bytes \d+-\d+\/\d+$/.test(response.headers.get('content-range') || '') || /json|text\/|html/i.test(response.headers.get('content-type') || '')) {
            throw new ZipDownloadError('ZIP-Speicher lieferte einen ungültigen Dateibereich.');
          }
          return response;
        }
        return await validateStart(response);
      } catch (error) {
        response?.body?.destroy();
        if (signal?.aborted || error.status === 416) throw error;
        failure = error instanceof ZipDownloadError ? error : new ZipDownloadError('ZIP-Speicher momentan nicht erreichbar.');
      }
    }
    throw failure || new ZipDownloadError('ZIP-Speicher nicht konfiguriert.');
  };
}

export const openZipDownload = createZipDownload();
