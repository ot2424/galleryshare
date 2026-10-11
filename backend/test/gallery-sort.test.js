import test from 'node:test';
import assert from 'node:assert/strict';
import { sortGalleryFiles, dateFromFilename } from '../../frontend/src/lib/gallerySort.js';

test('date sorting uses file dates, upload fallback, ISO dates and puts undated files last', () => {
  const files = [
    { id: 4, originalname: 'a.jpg' },
    { id: 3, originalname: 'b.jpg', uploadedAt: '2026-10-03T00:00:00Z' },
    { id: 2, originalname: 'c.jpg', lastModified: Date.parse('2026-10-01'), uploadedAt: Date.parse('2026-10-04') },
    { id: 1, originalname: 'd.jpg', lastModified: 'invalid', uploadedAt: Date.parse('2026-10-02') }
  ];
  assert.deepEqual(sortGalleryFiles(files).map(f => f.id), [2, 1, 3, 4]);
  assert.deepEqual(sortGalleryFiles(files, 'date-desc').map(f => f.id), [3, 1, 2, 4]);
  assert.deepEqual(files.map(f => f.id), [4, 3, 2, 1]);
});

test('name sorting respects numbers and works in both directions', () => {
  const files = [{ originalname: 'IMG10.jpg' }, { originalname: 'img2.jpg' }, { filename: 'a.jpg' }];
  assert.deepEqual(sortGalleryFiles(files, 'name-asc'), [files[2], files[1], files[0]]);
  assert.deepEqual(sortGalleryFiles(files, 'name-desc'), [files[0], files[1], files[2]]);
});

test('legacy files use registration order when dates are unavailable', () => {
  const files = [{ id: 3 }, { id: 1 }, { id: 2 }];
  assert.deepEqual(sortGalleryFiles(files).map(f => f.id), [1, 2, 3]);
});

test('the display limit is applied after sorting the entire gallery by date', () => {
  const files = Array.from({ length: 120 }, (_, index) => ({
    id: index + 1,
    originalname: `IMG${index + 1}.jpg`,
    lastModified: Date.UTC(2026, 0, 120 - index)
  }));
  const sorted = sortGalleryFiles(files);
  assert.deepEqual(sorted.slice(0, 90).map(file => file.id),
    Array.from({ length: 90 }, (_, index) => 120 - index));
  assert.deepEqual(sorted.slice(0, 180).map(file => file.id),
    Array.from({ length: 120 }, (_, index) => 120 - index));
  assert.deepEqual(sortGalleryFiles(files, 'date-desc').slice(0, 90).map(file => file.id),
    Array.from({ length: 90 }, (_, index) => index + 1));
});

test('existing uploads use dates in camera names before modification or upload dates', () => {
  const files = [
    { id: 1, originalname: 'IMG_20261003_101530.jpg', lastModified: Date.UTC(2026, 9, 1) },
    { id: 2, originalname: 'IMG-20261001-WA0002.jpg' },
    { id: 3, originalname: '2026-10-02_09-15-00.jpg', uploadedAt: Date.UTC(2026, 9, 4) },
    { id: 4, originalname: 'IMG_20261003_091530.jpg' }
  ];
  assert.deepEqual(sortGalleryFiles(files).map(file => file.id), [2, 3, 4, 1]);
  assert.deepEqual(sortGalleryFiles(files, 'date-desc').map(file => file.id), [1, 4, 3, 2]);
});

test('filename dates reject impossible dates and unrelated camera counters', () => {
  for (const name of ['IMG_20260230.jpg', 'IMG_20261301.jpg', 'IMG_20261003_251530.jpg', 'IMG_1234.jpg', '1202610034.jpg']) {
    assert.equal(dateFromFilename(name), null, name);
  }
  assert.equal(dateFromFilename('IMG_20240229.jpg'), Date.UTC(2024, 1, 29));
});

test('undated camera sequences ignore parallel upload completion order', () => {
  const files = [{ id: 1, originalname: 'IMG_10.jpg' }, { id: 3, originalname: 'IMG_1.jpg' }, { id: 2, originalname: 'IMG_2.jpg' }];
  assert.deepEqual(sortGalleryFiles(files).map(file => file.id), [3, 2, 1]);
  assert.deepEqual(sortGalleryFiles(files, 'date-desc').map(file => file.id), [1, 2, 3]);
});
