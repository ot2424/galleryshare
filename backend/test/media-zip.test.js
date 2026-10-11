import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'galleryshare-test-'));
const oldCwd = process.cwd();
process.chdir(folder);
let failRead = false;
let failUpload = false;
let failStream = false;
let zip;
const objects = new Map();
const image = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#995522' } }).jpeg().toBuffer();
Object.assign(process.env, {
  R2_ENDPOINT: 'https://test.invalid', R2_BUCKET: 'test', R2_ACCESS_KEY_ID: 'test', R2_SECRET_ACCESS_KEY: 'test',
  BUNNY_STORAGE_HOST: 'https://test.invalid', BUNNY_STORAGE_ZONE: 'test', BUNNY_API_KEY: 'test', BUNNY_CDN_HOST: 'https://test.invalid'
});
const { r2 } = await import('../r2.js');
r2.send = async command => {
  if (command.constructor.name === 'PutObjectCommand') {
    const body = command.input.Body;
    objects.set(command.input.Key, Buffer.isBuffer(body) ? body : Buffer.from(body));
    return { ETag: 'test' };
  }
  if (failRead) throw new Error('NoSuchKey');
  if (failStream) return { Body: Readable.from((async function* () {
    yield Buffer.from('partial');
    throw new Error('interrupted R2 stream');
  })()) };
  return { Body: Readable.from([command.input.Key.includes('photo.jpg') ? image : Buffer.from('original media content')]) };
};
const { default: initDb } = await import('../database.js');
const { createZipBuilder } = await import('../createZipInBackground.js');
const { getStreamFromR2 } = await import('../r2.js');
const buildZip = createZipBuilder({ initDb, getStreamFromR2, uploadZipToBunny: async (_id, filename) => {
  zip = await fs.readFile(filename);
  return !failUpload;
} });
const { ensurePreview } = await import('../mediaPreview.js');
const db = await initDb();
const id = 'test-gallery';
await db.run('INSERT INTO galleries (id, expiresAt) VALUES (?, ?)', [id, Date.now() + 60000]);
await db.run('INSERT INTO files (galleryId, filename, originalname) VALUES (?, ?, ?)', [id, `${id}/media.mp4`, 'media.mp4']);

test('ZIP finishes, uploads complete content and deduplicates concurrent jobs', async () => {
  const first = buildZip(id);
  assert.equal(buildZip(id), first);
  await first;
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.ok(zip.includes(Buffer.from('original media content')));
  assert.ok(zip.includes(Buffer.from([0x50, 0x4b, 0x06, 0x06])), 'ZIP64 end record exists');
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.equal((await db.get('SELECT zipReady FROM galleries WHERE id = ?', [id])).zipReady, 1);
  await assert.rejects(fs.access(path.join(os.tmpdir(), `gallery-${id}.zip`)));
});

test('R2 failures mark ZIP error and clean temporary files', async () => {
  failRead = true;
  try { await assert.rejects(buildZip(id)); } finally { failRead = false; }
  const row = await db.get('SELECT * FROM galleries WHERE id = ?', [id]);
  assert.equal(row.zipError, 1);
  assert.equal(row.zipReady, 0);
  await assert.rejects(fs.access(path.join(os.tmpdir(), `gallery-${id}.zip`)));
});

test('interrupted R2 streams reject instead of leaving the ZIP stuck', async () => {
  failStream = true;
  try { await assert.rejects(buildZip(id), /interrupted R2 stream/); }
  finally { failStream = false; }
  assert.equal((await db.get('SELECT zipError FROM galleries WHERE id = ?', [id])).zipError, 1);
});

test('Bunny failure can be retried successfully', async () => {
  failUpload = true;
  try { await assert.rejects(buildZip(id)); } finally { failUpload = false; }
  assert.equal((await db.get('SELECT zipError FROM galleries WHERE id = ?', [id])).zipError, 1);
  await buildZip(id);
  assert.equal((await db.get('SELECT zipReady FROM galleries WHERE id = ?', [id])).zipReady, 1);
});

test('existing originals get small cached image variants', async () => {
  const inserted = await db.run('INSERT INTO files (galleryId, filename, originalname) VALUES (?, ?, ?)', [id, `${id}/photo.jpg`, 'photo.jpg']);
  const file = await db.get('SELECT * FROM files WHERE id = ?', [inserted.lastID]);
  const first = ensurePreview(db, file);
  assert.equal(ensurePreview(db, file), first);
  const result = await first;
  const preview = objects.get(result.preview);
  const thumb = [...objects.entries()].find(([key]) => key.includes('/thumbs/'))?.[1];
  assert.equal((await sharp(preview).metadata()).width, 1600);
  assert.equal((await sharp(thumb).metadata()).width, 480);
  assert.ok(thumb.length < image.length);
  const count = objects.size;
  await ensurePreview(db, file);
  assert.equal(objects.size, count);
});

test('insufficient disk space fails before streaming original files', async () => {
  const inserted = await db.run('INSERT INTO files (galleryId, filename, originalname, sizeBytes) VALUES (?, ?, ?, ?)',
    [id, 'too-large', 'large.mov', Number.MAX_SAFE_INTEGER]);
  try {
    await assert.rejects(buildZip(id), /Nicht genügend freier Speicher/);
    assert.equal((await db.get('SELECT zipError FROM galleries WHERE id = ?', [id])).zipError, 1);
  } finally { await db.run('DELETE FROM files WHERE id = ?', [inserted.lastID]); }
});

test.after(async () => {
  await db.close();
  process.chdir(oldCwd);
  await fs.rm(folder, { recursive: true, force: true });
});
