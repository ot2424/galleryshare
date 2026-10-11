import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadMultipart } from '../../frontend/src/lib/upload.js';

function mockFetch({ failPart = false, missingETag = false, controller } = {}) {
  const calls = [];
  let failed = false;
  globalThis.fetch = async (url, options) => {
    const data = options.body && typeof options.body === 'string' ? JSON.parse(options.body) : null;
    calls.push({ url, data, size: options.body?.size });
    if (url === '/api/multipart/start') return Response.json({ key: 'gallery/originals/video', uploadId: 'upload' });
    if (url === '/api/multipart/part') return Response.json({ url: `https://test.invalid/${data.partNumber}` });
    if (url.startsWith('https:')) {
      if (controller) { controller.abort(); throw new DOMException('Aborted', 'AbortError'); }
      if (failPart && !failed) { failed = true; return new Response('', { status: 503 }); }
      return new Response('', { headers: missingETag ? {} : { ETag: '"part"' } });
    }
    return Response.json({ success: true });
  };
  return calls;
}
const file = { name: 'large.mov', type: 'video/quicktime', size: 130 * 1024 * 1024,
  slice: (start, end) => ({ size: end - start }) };

test('large files upload in bounded chunks, retry failed parts and account bytes once', async () => {
  const original = globalThis.fetch;
  try {
    const calls = mockFetch({ failPart: true });
    const bytes = [];
    await uploadMultipart(file, 'gallery', new AbortController().signal, size => bytes.push(size));
    assert.deepEqual(bytes.sort((a, b) => a - b), [2 * 1024 * 1024, 64 * 1024 * 1024, 64 * 1024 * 1024]);
    assert.equal(calls.filter(call => call.url.startsWith('https:')).length, 4);
    assert.deepEqual(calls.find(call => call.url.endsWith('/complete')).data.parts.map(part => part.PartNumber), [1, 2, 3]);
    assert.ok(!calls.some(call => call.url.endsWith('/abort')));
  } finally { globalThis.fetch = original; }
});

test('missing exposed ETag aborts multipart upload instead of registering incomplete files', async () => {
  const original = globalThis.fetch;
  try {
    const calls = mockFetch({ missingETag: true });
    await assert.rejects(uploadMultipart(file, 'gallery', new AbortController().signal, () => {}), /ExposeHeaders/);
    assert.ok(calls.some(call => call.url.endsWith('/abort')));
    assert.ok(!calls.some(call => call.url.endsWith('/complete')));
  } finally { globalThis.fetch = original; }
});

test('user cancellation aborts remote multipart state', async () => {
  const original = globalThis.fetch;
  try {
    const controller = new AbortController();
    const calls = mockFetch({ controller });
    await assert.rejects(uploadMultipart(file, 'gallery', controller.signal, () => {}), { name: 'AbortError' });
    assert.ok(calls.some(call => call.url.endsWith('/abort')));
  } finally { globalThis.fetch = original; }
});


test('parallel parts finish out of order but complete in order, with a shared limit across files', async () => {
  const original = globalThis.fetch;
  let active = 0;
  let peak = 0;
  const completions = [];
  try {
    globalThis.fetch = async (url, options) => {
      if (url.startsWith('https:')) {
        active++; peak = Math.max(peak, active);
        const part = Number(url.split('/').at(-1));
        await new Promise(resolve => setTimeout(resolve, part === 1 ? 30 : 5));
        active--;
        return new Response('', { headers: { ETag: `"part-${part}"` } });
      }
      const data = JSON.parse(options.body);
      if (url.endsWith('/start')) return Response.json({ key: data.filename, uploadId: data.filename });
      if (url.endsWith('/part')) return Response.json({ url: `https://test.invalid/${data.partNumber}` });
      if (url.endsWith('/complete')) completions.push(data.parts);
      return Response.json({ success: true });
    };
    await Promise.all([1, 2].map(id => uploadMultipart({ ...file, name: `video-${id}.mov` }, 'gallery', new AbortController().signal, () => {})));
    assert.equal(peak, 3);
    assert.equal(active, 0);
    assert.equal(completions.length, 2);
    for (const parts of completions) {
      assert.deepEqual(parts.map(part => part.PartNumber), [1, 2, 3]);
      assert.deepEqual(parts.map(part => part.ETag), ['"part-1"', '"part-2"', '"part-3"']);
    }
  } finally { globalThis.fetch = original; }
});
