import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createVideoPreviews, runFfmpeg } from '../videoPreview.js';

function fixture(run) {
  const rows = new Map([1, 2, 3].map(id => [id, { id, galleryId: 'test', filename: `test/${id}.mov` }]));
  const uploads = [];
  const db = {
    get: async (_sql, [id]) => ({ ...rows.get(id) }),
    run: async (sql, [key, id]) => { rows.get(id)[sql.includes('thumbnail') ? 'thumbnail' : 'preview'] = key; }
  };
  const previews = createVideoPreviews({ sign: async key => `https://test.invalid/${key}`, run,
    upload: async (stream, key, type) => {
      let size = 0;
      for await (const chunk of stream) size += chunk.length;
      uploads.push({ key, type, size });
    }
  });
  return { previews, db, rows, uploads };
}

test('video cache deduplicates, publishes MP4 after upload and cleans temporary files', async () => {
  let output;
  let args;
  const { previews, db, rows, uploads } = fixture(async values => {
    args = values; output = values.at(-1); await fs.writeFile(output, 'encoded');
  });
  const file = rows.get(1);
  const first = previews.ensure(db, file);
  assert.equal(previews.ensure(db, file), first);
  assert.equal(previews.state(file), 'processing');
  const result = await first;
  assert.equal(previews.state(result), 'ready');
  assert.ok(args.includes('+faststart'));
  assert.ok(args.includes('libx264'));
  assert.equal(uploads[0].type, 'video/mp4');
  await assert.rejects(fs.access(output));
  await previews.ensure(db, result);
  assert.equal(uploads.length, 1);
});

test('encoding failure does not publish a cache entry and temporary output is removed', async () => {
  let output;
  const { previews, db, rows, uploads } = fixture(async args => {
    output = args.at(-1); await fs.writeFile(output, 'partial'); throw new Error('encoding failed');
  });
  await assert.rejects(previews.ensure(db, rows.get(1)), /encoding failed/);
  assert.equal(previews.state(rows.get(1)), 'error');
  assert.equal(uploads.length, 0);
  assert.equal(rows.get(1).preview, undefined);
  await assert.rejects(fs.access(output));
});

test('transcodes run one at a time while posters have an independent queue', async () => {
  let release;
  let active = 0;
  let max = 0;
  const wait = new Promise(resolve => { release = resolve; });
  const { previews, db, rows } = fixture(async args => {
    const output = args.at(-1);
    if (output.endsWith('.mp4')) {
      active++; max = Math.max(max, active); await wait; active--;
    }
    await fs.writeFile(output, 'encoded');
  });
  const first = previews.ensure(db, rows.get(1));
  const second = previews.ensure(db, rows.get(2));
  await previews.ensure(db, rows.get(3), 'thumbnail');
  release();
  await Promise.all([first, second]);
  assert.equal(max, 1);
});

test('missing FFmpeg reports a safe error without signed URL details', async () => {
  const previous = process.env.FFMPEG_PATH;
  process.env.FFMPEG_PATH = '/nonexistent-ffmpeg';
  try { await assert.rejects(runFfmpeg(['https://secret.invalid']), /FFmpeg nicht verfügbar/); }
  finally { if (previous === undefined) delete process.env.FFMPEG_PATH; else process.env.FFMPEG_PATH = previous; }
});
