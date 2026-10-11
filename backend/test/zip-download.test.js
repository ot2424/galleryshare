import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createZipDownload } from '../zipDownload.js';

const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(60)]);
const sources = () => [{ url: 'https://cdn.invalid/zip', headers: {} },
  { url: 'https://storage.invalid/zip', headers: { AccessKey: 'server-only' } }];
function response(data, status = 200, headers = {}) {
  return { status, headers: new Headers({ 'Content-Length': String(data.length), ...headers }), body: Readable.from([data]) };
}
async function content(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test('35-byte error posing as a ZIP is rejected and authenticated storage is used', async () => {
  const calls = [];
  const open = createZipDownload({ sources, request: async (url, options) => {
    calls.push({ url, headers: options.headers });
    return url.includes('cdn') ? response(Buffer.alloc(35, 'x'), 200, { 'Content-Type': 'application/zip' }) : response(zip);
  } });
  const result = await open('gallery');
  assert.deepEqual(await content(result.body), zip);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].headers.AccessKey, undefined);
  assert.equal(calls[1].headers.AccessKey, 'server-only');
});

test('invalid responses from both sources fail before a download starts', async () => {
  const open = createZipDownload({ sources, request: async () => response(Buffer.from('{"error":"ZIP nicht verfügbar"}'), 200) });
  await assert.rejects(open('gallery'), error => error.rebuild && error.status === 502);
});

test('signature split across chunks is verified without losing any bytes', async () => {
  const open = createZipDownload({ sources, request: async () => ({
    status: 200, headers: new Headers(), body: Readable.from([zip.subarray(0, 1), zip.subarray(1, 3), zip.subarray(3)])
  }) });
  assert.deepEqual(await content((await open('gallery')).body), zip);
});

test('ZIP readiness probe accepts a valid 4-byte range with the full archive length', async () => {
  const open = createZipDownload({ sources, request: async () => response(zip.subarray(0, 4), 206,
    { 'Content-Range': `bytes 0-3/${zip.length}` }) });
  const result = await open('gallery', { range: 'bytes=0-3' });
  assert.deepEqual(await content(result.body), zip.subarray(0, 4));
});

test('resumed download validates the source prefix then preserves Content-Range', async () => {
  const calls = [];
  const open = createZipDownload({ sources, request: async (_url, options) => {
    calls.push(options.headers.Range);
    return options.headers.Range === 'bytes=0-3'
      ? response(zip.subarray(0, 4), 206, { 'Content-Range': 'bytes 0-3/64' })
      : response(zip.subarray(32), 206, { 'Content-Range': 'bytes 32-63/64' });
  } });
  const result = await open('gallery', { range: 'bytes=32-' });
  assert.deepEqual(calls, ['bytes=0-3', 'bytes=32-']);
  assert.equal(result.headers.get('content-range'), 'bytes 32-63/64');
  assert.deepEqual(await content(result.body), zip.subarray(32));
});

test('missing ZIP offers a rebuild while temporary storage failures do not', async () => {
  for (const status of [404, 503]) {
    const open = createZipDownload({ sources, request: async () => response(Buffer.from('error'), status) });
    await assert.rejects(open('gallery'), error => error.rebuild === (status === 404));
  }
});

test('invalid ranges return 416 and cancellation prevents fallback', async () => {
  let calls = 0;
  const controller = new AbortController();
  const open = createZipDownload({ sources, request: async () => {
    calls++;
    controller.abort();
    throw new Error('aborted');
  } });
  await assert.rejects(open('gallery', { range: 'bytes=0-3,5-8' }), error => error.status === 416);
  assert.equal(calls, 0);
  await assert.rejects(open('gallery', { signal: controller.signal }), /aborted/);
  assert.equal(calls, 1);
});

test('only the prefix is read before handing a large stream to the response', async () => {
  let reads = 0;
  const body = Readable.from((async function* () {
    for (let i = 0; i < 100; i++) { reads++; yield i === 0 ? zip : Buffer.alloc(65536); }
  })(), { highWaterMark: 1 });
  const open = createZipDownload({ sources, request: async () => ({ status: 200, headers: new Headers(), body }) });
  const result = await open('gallery');
  assert.ok(reads <= 2);
  result.body.destroy();
});
